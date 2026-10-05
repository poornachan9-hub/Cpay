// scripts/inspect_historical_failures.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const POLYGON_RPC = "https://polygon.drpc.org";
const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);

const candidates = [
  { label: "USDT-1", hash: "0xaaf0964d71284cdb7cc71c398fb695f5205c8fa5cfbd0c165518053c97d7c0ef", expectedDomain: "token" },
  { label: "USDT-2", hash: "0x0bde953df21b2415a91750e98e9452ee115b2aafea24d91d65586ec7fd762811", expectedDomain: "token" },
  { label: "USDT-3", hash: "0x906404a64f1973802ee05d776bf7289abaffd4c609a8d655196d0ed94a6110eb", expectedDomain: "token" },
  { label: "USDC-1", hash: "0xb59e8339c8e19da2760f1c2dcbea8a25205e36af85b9d5616ecbcbb1b67ccdd3", expectedDomain: "token" },
  { label: "UNI-1",  hash: "0xb109424b6e9ddeb38011227b723da260412b53ceb75403aa534e9dd98969b28a", expectedDomain: "uniswap" },
  { label: "SEAPORT-1", hash: "0xf6078380904b65e4d49ccdcd4f777c0d1abc3046df5075a1c7043c6a44e398eb", expectedDomain: "marketplace" },
];

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

async function run() {
  console.log("=========================================================================");
  console.log("  HISTORICAL DATASET FAILURE CANDIDATE INSPECTION & SIMULATION           ");
  console.log("=========================================================================\n");

  const results = [];

  for (const c of candidates) {
    console.log(`>>> Analyzing ${c.label} (${c.hash})...`);
    const tx = await provider.getTransaction(c.hash);
    const rcpt = await provider.getTransactionReceipt(c.hash);

    if (!tx || !rcpt) {
      console.log(`Could not find tx or receipt for ${c.hash}`);
      continue;
    }

    const gasLimit = tx.gasLimit.toNumber();
    const gasPriceGwei = parseFloat(ethers.utils.formatUnits(tx.gasPrice, "gwei"));
    const valueNative = parseFloat(ethers.utils.formatEther(tx.value));
    const to = tx.to;
    const from = tx.from;
    const data = tx.data;
    const histSuccess = rcpt.status === 1;

    // 1. Run ML Prediction strictly on pre-execution features
    const ml = await getMLPrediction(to, gasLimit, gasPriceGwei, valueNative);

    // 2. Independently simulate on current state via eth_call
    let simOutcome = "SUCCESS";
    let simReason = null;
    try {
      await provider.call({
        from,
        to,
        data,
        value: tx.value,
        gasLimit: tx.gasLimit,
      });
    } catch (err) {
      simOutcome = "REVERTED";
      simReason = decodeRevert(err);
    }

    // 3. Classify reproducibility
    let classification = "";
    if (simOutcome === "REVERTED") {
      if (simReason.includes("missing revert data")) {
        classification = "D. INCONCLUSIVE";
      } else {
        classification = "A. REPRODUCIBLE AND VALID";
      }
    } else {
      classification = "C. HISTORICAL STATE DEPENDENT / NOT REPRODUCIBLE";
    }

    const report = {
      label: c.label,
      tx_hash: c.hash,
      from,
      to,
      selector: data.slice(0, 10),
      data_length_bytes: (data.length - 2) / 2,
      gas_limit: gasLimit,
      gas_price_gwei: gasPriceGwei,
      value_native: valueNative,
      historical_status: histSuccess ? "SUCCESS (1)" : "FAILED (0)",
      historical_gas_used: rcpt.gasUsed.toNumber(),
      ml_domain: ml.domain,
      ml_model: ml.model_used,
      ml_failure_prob: ml.failure_probability,
      ml_predicted_outcome: ml.predicted_outcome,
      simulation_outcome: simOutcome,
      simulation_reason: simReason,
      classification,
    };

    results.push(report);

    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);
    console.log(`   Selector: ${report.selector} (Bytes: ${report.data_length_bytes})`);
    console.log(`   Features: GasLimit=${gasLimit}, GasPrice=${gasPriceGwei.toFixed(2)} Gwei, Value=${valueNative} POL`);
    console.log(`   Historical: ${report.historical_status}, GasUsed=${report.historical_gas_used}`);
    console.log(`   ML Prediction: Outcome=${ml.predicted_outcome}, Prob=${(ml.failure_probability * 100).toFixed(1)}%, Model=${ml.model_used}`);
    console.log(`   Current Simulation: ${simOutcome} -> Reason: ${simReason}`);
    console.log(`   Classification: ${classification}\n`);
  }

  fs.writeFileSync(
    path.join(__dirname, "..", "polygon-ml-dataset", "historical_failure_candidates.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("Saved full report to polygon-ml-dataset/historical_failure_candidates.json");
}

run().catch(console.error);
