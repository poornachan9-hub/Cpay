// lib/mlMetricsData.js
// Verified results extracted directly from 50k transaction experiments
// Source: results_50000/experiments_summary.csv & results_50000/domain_models/threshold_analysis/

export const CONFUSION_MATRICES = {
  pooled_lr: {
    id: "pooled_lr",
    title: "Overall Pooled Logistic Regression",
    subtitle: "50k Multi-Domain Pooled (No Nonce, Threshold 0.50)",
    modelType: "Logistic Regression (Standardized)",
    features: "gas_limit, gas_price_gwei, value_native",
    testRecords: 9944,
    metrics: {
      accuracy: 0.7605,
      failureRecall: 0.8259,
      failurePrecision: 0.1384,
      rocAuc: 0.7947,
      falseAlarmCount: 2304,
    },
    matrix: {
      actualFail: {
        total: 448,
        predFail: 370, // TP
        predSucc: 78,  // FN
      },
      actualSucc: {
        total: 9496,
        predFail: 2304, // FP (False Alarm)
        predSucc: 7192, // TN
      },
    },
    observations: "High failure recall (82.6%) but incurs 2,304 false alarms due to cross-domain feature misalignment.",
    status: "Pooled Baseline",
  },

  pooled_rf: {
    id: "pooled_rf",
    title: "Overall Pooled Random Forest",
    subtitle: "50k Multi-Domain Pooled (No Nonce, Threshold 0.50)",
    modelType: "Random Forest (n=100)",
    features: "gas_limit, gas_price_gwei, value_native",
    testRecords: 9944,
    metrics: {
      accuracy: 0.9587,
      failureRecall: 0.4487,
      failurePrecision: 0.5507,
      rocAuc: 0.8738,
      falseAlarmCount: 164,
    },
    matrix: {
      actualFail: {
        total: 448,
        predFail: 201, // TP
        predSucc: 247, // FN
      },
      actualSucc: {
        total: 9496,
        predFail: 164, // FP
        predSucc: 9332, // TN
      },
    },
    observations: "Substantially fewer false alarms (164 vs 2,304 for LR) but misses 55.1% of failures when trained on pooled data.",
    status: "Pooled Comparison",
  },

  uniswap_rf: {
    id: "uniswap_rf",
    title: "Uniswap Domain Model",
    subtitle: "DEX Model on Uniswap V3 SwapRouter (Threshold 0.50)",
    modelType: "Random Forest (Domain-Trained)",
    features: "gas_limit, gas_price_gwei, value_native",
    testRecords: 2000,
    metrics: {
      accuracy: 0.9210,
      failureRecall: 0.8346,
      failurePrecision: 0.6607,
      rocAuc: 0.9275,
      falseAlarmCount: 114,
    },
    matrix: {
      actualFail: {
        total: 266,
        predFail: 222, // TP
        predSucc: 44,  // FN
      },
      actualSucc: {
        total: 1734,
        predFail: 114, // FP
        predSucc: 1620, // TN
      },
    },
    observations: "Optimal trade-off for DEX routing: catches 83.5% of failures with strong 66.1% precision.",
    status: "Production Validated",
  },

  marketplace_lr: {
    id: "marketplace_lr",
    title: "Marketplace Domain Model",
    subtitle: "OpenSea / Seaport 1.5 Model (Logistic Regression, Threshold 0.60)",
    modelType: "Logistic Regression (Standardized)",
    features: "gas_limit, gas_price_gwei, value_native",
    testRecords: 2000,
    metrics: {
      accuracy: 0.9380,
      failureRecall: 0.3267,
      failurePrecision: 0.6806,
      rocAuc: 0.7970,
      falseAlarmCount: 23,
    },
    matrix: {
      actualFail: {
        total: 150,
        predFail: 49,  // TP
        predSucc: 101, // FN
      },
      actualSucc: {
        total: 1850,
        predFail: 23,  // FP
        predSucc: 1827, // TN
      },
    },
    observations: "At threshold 0.60, false alarms plummet from 195 to 23 (88.2% reduction), raising precision to 68.1%.",
    status: "Production Validated",
  },

  token_rf: {
    id: "token_rf",
    title: "Token Domain Model",
    subtitle: "USDT + USDC Combined Transfers (Random Forest, Threshold 0.50)",
    modelType: "Random Forest (Domain-Trained)",
    features: "gas_limit, gas_price_gwei, value_native",
    testRecords: 3943,
    metrics: {
      accuracy: 0.9995,
      failureRecall: 0.7500,
      failurePrecision: 1.0000,
      rocAuc: 0.9996,
      falseAlarmCount: 0,
    },
    matrix: {
      actualFail: {
        total: 8,
        predFail: 6, // TP
        predSucc: 2, // FN
      },
      actualSucc: {
        total: 3935,
        predFail: 0, // FP (0 False Alarms)
        predSucc: 3935, // TN
      },
    },
    observations: "Flawless specificity: 0 false alarms across 3,935 successful token transfers while catching 75% of failures.",
    status: "Production Validated",
  },

  aave_limitation: {
    id: "aave_limitation",
    title: "Aave Lending Limitation (Non-ML Path)",
    subtitle: "Aave V3 Lending Pool (Random Forest vs Logistic Regression)",
    modelType: "Limitation Proof -> Routes to RPC State Simulation",
    features: "gas_limit, gas_price_gwei, value_native",
    testRecords: 2000,
    metrics: {
      accuracy: 0.9890,
      failureRecall: 0.1250, // RF catches only 3 of 24
      failurePrecision: 0.7500,
      rocAuc: 0.8778,
      falseAlarmCount: 1,
    },
    matrix: {
      actualFail: {
        total: 24,
        predFail: 3,  // RF TP (misses 21 of 24!)
        predSucc: 21, // RF FN
      },
      actualSucc: {
        total: 1976,
        predFail: 1,  // RF FP
        predSucc: 1975, // RF TN
      },
    },
    lrComparison: {
      predFail: 0,  // LR caught 0 of 24 (0% recall)
      predSucc: 24,
      falseAlarms: 358,
    },
    observations: "Empirical proof: RF misses 87.5% and LR misses 100% of failures. Lending protocol reverts depend on collateral health factor and oracle state, NOT gas limits. Routed to RPC state engine.",
    status: "Non-ML Path Validated",
  },
};
