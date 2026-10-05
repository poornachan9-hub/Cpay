// scripts/search_reproducible_failures.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const POLYGON_RPC = "https://polygon.drpc.org";
const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);

function decodeRevert(err) {
  const reason = err?.reason;
  const rawData = err?.data || err?.error?.data;
  if (reason && typeof reason === "string" && !reason.includes("missing revert data")) {
    return reason;
  }
  const hex = typeof rawData === "string" ? rawData : (rawData?.data || "");
  if (hex.startsWith("0x08c379a0")) {
    try {
      return ethers.utils.defaultAbiCoder.decode(["string"], "0x" + hex.slice(10))[0];
    } catch (_) {}
  }
  if (hex.startsWith("0x4e487b71")) {
    try {
      const code = ethers.utils.defaultAbiCoder.decode(["uint256"], "0x" + hex.slice(10))[0];
      return `Panic(0x${code.toString(16)})`;
    } catch (_) {}
  }
  return err.message || "Unknown error";
}

async function getMLPrediction(to, gasLimit, gasPriceGwei, valueNative) {
  try {
    const res = await fetch("http://localhost:3000/api/predict-tx-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        gas_limit: gasLimit,
        gas_price_gwei: gasPriceGwei,
        value_native: valueNative,
      }),
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const csvPath = path.join(__dirname, "..", "polygon-ml-dataset", "data", "polygon_transactions_50000.csv");
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let header = null;
  const failures = [];

  for await (const line of rl) {
    if (!header) {
      header = line.split(",");
      continue;
    }
    const cols = line.split(",");
    // success is col 11
    if (cols[11] === "0") {
      failures.push({
        tx_hash: cols[0],
        block_number: parseInt(cols[2]),
        sender: cols[3],
        receiver: cols[4],
        value_native: parseFloat(cols[5]),
        gas_limit: parseInt(cols[6]),
        gas_used: parseInt(cols[7]),
        gas_price_gwei: parseFloat(cols[8]),
        nonce: parseInt(cols[9]),
        domain: cols[13],
      });
    }
  }

  console.log(`Loaded ${failures.length} total failures from CSV.`);

  // Test across domains, especially USDT, Seaport, Uniswap
  const reproducibleReverts = [];
  const inconclusive = [];
  const stateChanged = [];

  // Let's test a sample of up to 40 failures across domains
  const sample = [
    ...failures.filter(f => f.domain === "usdt"),
    ...failures.filter(f => f.domain === "marketplace").slice(0, 15),
    ...failures.filter(f => f.domain === "uniswap").slice(0, 15),
  ];

  console.log(`Testing ${sample.length} failures for current state reproducibility...`);

  for (let i = 0; i < sample.length; i++) {
    const f = sample[i];
    try {
      const tx = await provider.getTransaction(f.tx_hash);
      if (!tx) continue;

      let simStatus = "SUCCESS";
      let revertReason = null;
      try {
        await provider.call({
          from: tx.from,
          to: tx.to,
          data: tx.data,
          value: tx.value,
          gasLimit: tx.gasLimit,
        });
      } catch (err) {
        simStatus = "REVERTED";
        revertReason = decodeRevert(err);
      }

      const ml = await getMLPrediction(tx.to, f.gas_limit, f.gas_price_gwei, f.value_native);

      const entry = {
        tx_hash: f.tx_hash,
        domain: f.domain,
        from: tx.from,
        to: tx.to,
        selector: tx.data ? tx.data.slice(0, 10) : "0x",
        calldata: tx.data,
        gas_limit: f.gas_limit,
        gas_price_gwei: f.gas_price_gwei,
        value_native: f.value_native,
        historical_gas_used: f.gas_used,
        sim_status: simStatus,
        revert_reason: revertReason,
        ml_prediction: ml,
      };

      if (simStatus === "REVERTED") {
        if (revertReason && !revertReason.includes("missing revert data")) {
          console.log(`[FOUND REPRODUCIBLE REVERT] ${f.domain.toUpperCase()} ${f.tx_hash}: ${revertReason}`);
          console.log(`   ML Prob: ${(ml.failure_probability * 100).toFixed(1)}% | Outcome: ${ml.predicted_outcome}`);
          reproducibleReverts.push(entry);
        } else {
          inconclusive.push(entry);
        }
      } else {
        stateChanged.push(entry);
      }
    } catch (e) {
      // ignore individual RPC glitches
    }
  }

  console.log(`\nSUMMARY:`);
  console.log(`Reproducible with Decoded Revert: ${reproducibleReverts.length}`);
  console.log(`Inconclusive (Missing Revert Data): ${inconclusive.length}`);
  console.log(`State Changed / Succeeded Today: ${stateChanged.length}`);

  fs.writeFileSync(
    path.join(__dirname, "..", "polygon-ml-dataset", "reproducible_reverts.json"),
    JSON.stringify(reproducibleReverts, null, 2)
  );
}

main().catch(console.error);
