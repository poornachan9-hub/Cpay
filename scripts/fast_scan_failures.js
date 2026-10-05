// scripts/fast_scan_failures.js
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

  console.log(`Loaded ${failures.length} total failures.`);

  // Prioritize diversity across domains: USDT, Uniswap, Marketplace, Aave
  const sample = [
    ...failures.filter(f => f.domain === "usdt"), // all 46 USDT
    ...failures.filter(f => f.domain === "marketplace").slice(0, 30),
    ...failures.filter(f => f.domain === "uniswap").slice(0, 30),
    ...failures.filter(f => f.domain === "aave").slice(0, 15),
  ];

  console.log(`Testing ${sample.length} failures across all domains...`);

  const revertsFound = [];
  const stateChanged = [];
  const inconclusive = [];

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

      const item = {
        tx_hash: f.tx_hash,
        domain: f.domain,
        sender: tx.from,
        receiver: tx.to,
        selector: tx.data ? tx.data.slice(0, 10) : "0x",
        calldata: tx.data,
        gas_limit: f.gas_limit,
        gas_price_gwei: f.gas_price_gwei,
        value_native: f.value_native,
        historical_gas_used: f.gas_used,
        sim_status: simStatus,
        revert_reason: revertReason,
      };

      if (simStatus === "REVERTED") {
        if (revertReason && !revertReason.includes("missing revert data")) {
          console.log(`[REPRODUCIBLE REVERT #${revertsFound.length + 1}] Domain=${f.domain.toUpperCase()} Tx=${f.tx_hash}`);
          console.log(`   Selector=${item.selector} | GasLimit=${f.gas_limit} | GasPrice=${f.gas_price_gwei.toFixed(2)} Gwei`);
          console.log(`   Revert Reason: ${revertReason}\n`);
          revertsFound.push(item);
        } else {
          inconclusive.push(item);
        }
      } else {
        stateChanged.push(item);
      }
    } catch (e) {
      // skip
    }
  }

  console.log("=========================================================================");
  console.log("SCAN COMPLETE:");
  console.log(`- Reproducible Reverts: ${revertsFound.length}`);
  console.log(`- Succeeded on Current State: ${stateChanged.length}`);
  console.log(`- Inconclusive (Missing Revert Data): ${inconclusive.length}`);
  console.log("=========================================================================");

  fs.writeFileSync(
    path.join(__dirname, "..", "polygon-ml-dataset", "reproducible_reverts.json"),
    JSON.stringify(revertsFound, null, 2)
  );
}

main().catch(console.error);
