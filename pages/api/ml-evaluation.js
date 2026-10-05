import fs from "fs";
import path from "path";

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((header, idx) => {
      const val = values[idx] !== undefined ? values[idx] : "";
      const num = Number(val);
      row[header] = !isNaN(num) && val !== "" ? num : val;
    });
    return row;
  });
}

function resolveFile(candidates) {
  const root = process.cwd();
  for (const relPath of candidates) {
    const absPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
    if (fs.existsSync(absPath)) {
      return { absPath, relPath };
    }
  }
  return null;
}

// Actual model architecture verified from polygon-ml-dataset/predict_tx.py
const DOMAIN_MODEL_ARCHITECTURE = {
  uniswap: {
    domainKey: "uniswap",
    domainName: "Uniswap (DEX)",
    assignedModelType: "Random Forest",
    assignedModelName: "Random Forest (DEX Domain Model)",
    configuredThreshold: 0.50,
    isML: true,
    routingReason: "Nonlinear interactions between gas_limit and pool liquidity depth. 83.5% failure recall.",
    testTotalTxs: 2000,
    testActualFailures: 266,
    testActualSuccesses: 1734,
    featureImportances: [
      { feature: "gas_limit", importance: 0.7169 },
      { feature: "gas_price_gwei", importance: 0.2778 },
      { feature: "value_native", importance: 0.0052 },
    ],
  },
  marketplace: {
    domainKey: "marketplace",
    domainName: "Seaport (Marketplace)",
    assignedModelType: "Logistic Regression",
    assignedModelName: "Logistic Regression (Marketplace Domain Model)",
    configuredThreshold: 0.60,
    isML: true,
    routingReason: "Threshold 0.60 provides optimal precision (68.1%) and slashes false alarms from 195 down to 23.",
    testTotalTxs: 2000,
    testActualFailures: 150,
    testActualSuccesses: 1850,
    standardizedCoefficients: [
      { feature: "value_native", coef: 1.1397 },
      { feature: "gas_price_gwei", coef: 0.0529 },
      { feature: "gas_limit", coef: -0.2284 },
    ],
    featureImportances: null, // Logistic Regression uses linear coefficients, not tree Gini importance
  },
  token: {
    domainKey: "token",
    domainName: "Tokens (USDT/USDC)",
    assignedModelType: "Random Forest",
    assignedModelName: "Random Forest (Token Domain Model)",
    configuredThreshold: 0.40,
    isML: true,
    routingReason: "Standard ERC-20 transfer behavior. 70.0% precision with 77.8% failure recall (7/9 caught) across held-out test records.",
    testTotalTxs: 1979,
    testActualFailures: 9,
    testActualSuccesses: 1970,
    featureImportances: [
      { feature: "gas_price_gwei", importance: 0.5314 },
      { feature: "gas_limit", importance: 0.4686 },
      { feature: "value_native", importance: 0.0000 },
    ],
  },
  aave: {
    domainKey: "aave",
    domainName: "Aave (Lending)",
    assignedModelType: "Random Forest",
    assignedModelName: "Random Forest (Lending Domain Benchmark)",
    productionRouting: "Rule-Based Engine (RPC On-Chain Simulation)",
    configuredThreshold: 0.60,
    isML: true,
    routingReason: "Aave empirical ML evaluation achieves 99.5% accuracy and 75.0% precision with 42.9% failure recall (6/14 caught). Production system augments static ML with live RPC simulation.",
    testTotalTxs: 2000,
    testActualFailures: 14,
    testActualSuccesses: 1986,
    featureImportances: [
      { feature: "gas_price_gwei", importance: 0.5296 },
      { feature: "gas_limit", importance: 0.4704 },
      { feature: "value_native", importance: 0.0000 },
    ],
  },
  fallback: {
    domainKey: "fallback",
    domainName: "Fallback (All Domains)",
    assignedModelType: "Random Forest",
    assignedModelName: "Random Forest (Fallback General Model)",
    configuredThreshold: 0.50,
    isML: true,
    routingReason: "General fallback ensemble for contracts outside top verified domains across 49,714 Polygon PoS records.",
    testTotalTxs: 9944,
    testActualFailures: 448,
    testActualSuccesses: 9496,
    featureImportances: [
      { feature: "gas_limit", importance: 0.6066 },
      { feature: "gas_price_gwei", importance: 0.3460 },
      { feature: "value_native", importance: 0.0474 },
    ],
  },
};

// Empirical learning curve data across 10k and 50k benchmark runs
const LEARNING_CURVE_DATA = [
  {
    datasetSize: "10,000 txs",
    sizeNum: 10000,
    trainRecords: 8000,
    testRecords: 2000,
    model: "Random Forest",
    trainAccuracy: 0.999,
    valAccuracy: 0.9450,
    valRecall: 0.7444,
    rocAuc: 0.9786,
    note: "10k Chronological Benchmark (Includes nonce feature)",
  },
  {
    datasetSize: "49,714 txs",
    sizeNum: 49714,
    trainRecords: 39770,
    testRecords: 9944,
    model: "Random Forest",
    trainAccuracy: 0.998,
    valAccuracy: 0.9587,
    valRecall: 0.4487,
    rocAuc: 0.8738,
    note: "50k Multi-Domain Held-Out Benchmark (Strict pre-execution only, no nonce)",
  },
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const comparisonCandidate = resolveFile([
      path.join("polygon-ml-dataset", "results_50000", "domain_models", "domain_models_comparison.csv"),
      path.join("polygon-ml-dataset", "results_10000", "domain_models_comparison.csv"),
      path.join("polygon-ml-dataset", "results", "model_comparison.csv"),
    ]);

    const thresholdCandidate = resolveFile([
      path.join("polygon-ml-dataset", "results_50000", "domain_models", "threshold_analysis", "all_domains_threshold_analysis.csv"),
      path.join("polygon-ml-dataset", "results_10000", "threshold_analysis", "all_domains_threshold_analysis.csv"),
    ]);

    if (!comparisonCandidate) {
      return res.status(404).json({
        error: "Evaluation comparison CSV file not found on server.",
      });
    }

    const comparisonContent = fs.readFileSync(comparisonCandidate.absPath, "utf-8");
    const comparisonStat = fs.statSync(comparisonCandidate.absPath);
    const domainComparison = parseCsv(comparisonContent);

    let thresholdAnalysis = [];
    let thresholdSource = null;
    let thresholdMtime = null;

    if (thresholdCandidate) {
      const thresholdContent = fs.readFileSync(thresholdCandidate.absPath, "utf-8");
      const thresholdStat = fs.statSync(thresholdCandidate.absPath);
      thresholdAnalysis = parseCsv(thresholdContent);
      thresholdSource = thresholdCandidate.relPath.replace(/\\/g, "/");
      thresholdMtime = thresholdStat.mtime.toISOString();
    }

    // Normalized comparison rows
    const normalizedComparison = domainComparison.map((row) => {
      const domainRaw = String(row["Domain"] || "");
      let domainKey = domainRaw.toLowerCase();
      let displayName = domainRaw;

      if (domainRaw.includes("Uniswap") || domainRaw.includes("DEX")) {
        domainKey = "uniswap";
        displayName = "Uniswap (DEX)";
      } else if (domainRaw.includes("Seaport") || domainRaw.includes("Marketplace")) {
        domainKey = "marketplace";
        displayName = "Seaport (Marketplace)";
      } else if (domainRaw.includes("Aave") || domainRaw.includes("Lending")) {
        domainKey = "aave";
        displayName = "Aave (Lending)";
      } else if (domainRaw.includes("Token") || domainRaw.includes("USDT")) {
        domainKey = "token";
        displayName = "Tokens (USDT/USDC)";
      } else if (domainRaw.includes("Fallback") || domainRaw.includes("All Domains")) {
        domainKey = "fallback";
        displayName = "Fallback (All Domains)";
      }

      const testFailures = Number(row["Test Failures"] || 0);
      const fn = Number(row["FN"] || 0);
      const fp = Number(row["FP"] || 0);
      const tp = testFailures - fn;
      const recall = Number(row["Failure Recall"] || 0);
      const precision = Number(row["Failure Precision"] || 0);
      const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

      const arch = DOMAIN_MODEL_ARCHITECTURE[domainKey];
      const isAssigned = arch && (arch.assignedModelType === row["Model"]);

      return {
        model: row["Model"],
        domain: displayName,
        domainKey,
        isAssignedModel: isAssigned,
        testFailures,
        failureRecall: recall,
        failurePrecision: precision,
        f1Score: f1,
        accuracy: Number(row["Accuracy"] || 0),
        rocAuc: Number(row["ROC-AUC"] || 0),
        fn,
        fp,
        tp,
      };
    });

    // Threshold sweep rows enriched with FPR for ROC & Precision-Recall curves
    const normalizedThresholds = thresholdAnalysis.map((row) => {
      const domainRaw = String(row["Domain"] || "").toLowerCase();
      let displayName = domainRaw;
      if (domainRaw === "uniswap") displayName = "Uniswap (DEX)";
      else if (domainRaw === "marketplace") displayName = "Seaport (Marketplace)";
      else if (domainRaw === "aave") displayName = "Aave (Lending)";
      else if (domainRaw === "token") displayName = "Tokens (USDT/USDC)";
      else if (domainRaw === "fallback") displayName = "Fallback (All Domains)";

      const arch = DOMAIN_MODEL_ARCHITECTURE[domainRaw] || {};
      const totalSucc = arch.testActualSuccesses || 2000;
      const fp = Number(row["False Alarms (FP)"] || 0);
      const tp = Number(row["Caught Fail (TP)"] || 0);
      const fn = Number(row["Missed Fail (FN)"] || 0);
      const actualFailures = Number(row["Actual Failures"] || 0);

      const recall = Number(row["Failure Recall"] || 0); // TPR
      const precision = Number(row["Failure Precision"] || 0);
      const fpr = totalSucc > 0 ? fp / totalSucc : 0; // FPR = FP / N
      const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

      return {
        domain: displayName,
        domainKey: domainRaw,
        model: row["Model"],
        threshold: Number(row["Threshold"] || 0.5),
        actualFailures,
        failureRecall: recall,
        failurePrecision: precision,
        f1Score: f1,
        accuracy: Number(row["Accuracy"] || 0),
        falseAlarms: fp,
        missedFail: fn,
        totalWarnings: Number(row["Total Warnings"] || 0),
        caughtFail: tp,
        fpr,
        tpr: recall,
      };
    });

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    return res.status(200).json({
      success: true,
      metadata: {
        comparisonSource: comparisonCandidate.relPath.replace(/\\/g, "/"),
        comparisonLastModified: comparisonStat.mtime.toISOString(),
        thresholdSource,
        thresholdLastModified: thresholdMtime,
        domainRowCount: normalizedComparison.length,
        thresholdRowCount: normalizedThresholds.length,
      },
      architecture: DOMAIN_MODEL_ARCHITECTURE,
      learningCurve: LEARNING_CURVE_DATA,
      comparison: normalizedComparison,
      thresholds: normalizedThresholds,
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to load ML evaluation files: ${error.message}`,
    });
  }
}
