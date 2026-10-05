# -*- coding: utf-8 -*-
"""
Polygon Pre-Transaction Threshold & Probability Calibration Analysis
====================================================================
Evaluates existing trained domain models at failure probability thresholds:
0.50, 0.60, 0.70, 0.80, 0.90

Evaluates both Logistic Regression and Random Forest.
Saves CSV reports to: results_50000/domain_models/threshold_analysis/
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PATH = SCRIPT_DIR / "data" / "polygon_transactions_50000.csv"
MODEL_DIR = SCRIPT_DIR / "results_50000" / "domain_models"
OUT_DIR = MODEL_DIR / "threshold_analysis"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FEATURES = ["gas_limit", "gas_price_gwei", "value_native"]
TARGET = "success"
THRESHOLDS = [0.50, 0.60, 0.70, 0.80, 0.90]


def get_test_partitions():
    df = pd.read_csv(DATA_PATH)
    for col in FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # 1. Uniswap
    sub_uni = df[df["domain"] == "uniswap"].sort_values("block_number").reset_index(drop=True)
    te_uni = sub_uni.iloc[int(len(sub_uni) * 0.8):]

    # 2. Marketplace
    sub_mkt = df[df["domain"] == "marketplace"].sort_values("block_number").reset_index(drop=True)
    te_mkt = sub_mkt.iloc[int(len(sub_mkt) * 0.8):]

    # 3. Aave
    sub_aave = df[df["domain"] == "aave"].sort_values("block_number").reset_index(drop=True)
    te_aave = sub_aave.iloc[int(len(sub_aave) * 0.8):]

    # 4. Token (USDT + USDC)
    sub_usdt = df[df["domain"] == "usdt"].sort_values("block_number").reset_index(drop=True)
    sub_usdc = df[df["domain"] == "usdc"].sort_values("block_number").reset_index(drop=True)
    te_usdt = sub_usdt.iloc[int(len(sub_usdt) * 0.8):]
    te_usdc = sub_usdc.iloc[int(len(sub_usdc) * 0.8):]
    te_tok = pd.concat([te_usdt, te_usdc], ignore_index=True)

    # 5. Fallback (All)
    te_all = pd.concat([te_uni, te_mkt, te_aave, te_tok], ignore_index=True)

    return {
        "uniswap": (te_uni, "model_dex"),
        "marketplace": (te_mkt, "model_marketplace"),
        "aave": (te_aave, "model_lending"),
        "token": (te_tok, "model_token"),
        "fallback": (te_all, "model_fallback"),
    }


def analyze_thresholds(domain_name, te_df, model_prefix):
    y_true = te_df[TARGET].values
    X_raw = te_df[FEATURES].values

    scaler = joblib.load(MODEL_DIR / f"{model_prefix}_scaler.joblib")
    lr = joblib.load(MODEL_DIR / f"{model_prefix}_logistic.joblib")
    rf = joblib.load(MODEL_DIR / f"{model_prefix}_rf.joblib")

    X_sc = scaler.transform(X_raw)

    # Probabilities of FAILURE (Class 0) = 1.0 - Prob(Class 1)
    # predict_proba returns [prob_class_0, prob_class_1]
    prob_fail_lr = lr.predict_proba(X_sc)[:, 0]
    prob_fail_rf = rf.predict_proba(X_raw)[:, 0]

    rows = []
    actual_failures = int((y_true == 0).sum())
    actual_successes = int((y_true == 1).sum())

    for model_name, prob_fail in [("Random Forest", prob_fail_rf), ("Logistic Regression", prob_fail_lr)]:
        for t in THRESHOLDS:
            # Predict failure if prob_failure >= threshold
            pred_fail = (prob_fail >= t).astype(int)
            # Map to target: 0 if predicted failure, 1 if predicted success
            pred_y = 1 - pred_fail

            cm = confusion_matrix(y_true, pred_y, labels=[0, 1])
            tp_fail = int(cm[0, 0])  # Actual Fail, Pred Fail
            fn_fail = int(cm[0, 1])  # Actual Fail, Pred Succ (Missed Failure)
            fp_fail = int(cm[1, 0])  # Actual Succ, Pred Fail (False Alarm)
            tn_fail = int(cm[1, 1])  # Actual Succ, Pred Succ (True Success)

            total_warnings = tp_fail + fp_fail
            rec_fail = tp_fail / (tp_fail + fn_fail) if (tp_fail + fn_fail) > 0 else 0.0
            prec_fail = tp_fail / total_warnings if total_warnings > 0 else 0.0
            acc = (tp_fail + tn_fail) / len(y_true)

            rows.append({
                "Domain": domain_name,
                "Model": model_name,
                "Threshold": f"{t:.2f}",
                "Actual Failures": actual_failures,
                "Failure Recall": f"{rec_fail:.4f}",
                "Failure Precision": f"{prec_fail:.4f}",
                "Accuracy": f"{acc:.4f}",
                "False Alarms (FP)": fp_fail,
                "Missed Fail (FN)": fn_fail,
                "Total Warnings": total_warnings,
                "Caught Fail (TP)": tp_fail,
            })

    res_df = pd.DataFrame(rows)
    res_df.to_csv(OUT_DIR / f"{domain_name}_thresholds.csv", index=False)
    return res_df


def main():
    print("=" * 70)
    print("PROBABILITY CALIBRATION & THRESHOLD ANALYSIS")
    print("=" * 70)

    partitions = get_test_partitions()
    all_results = []

    for d_name, (te_df, prefix) in partitions.items():
        print(f"\nProcessing domain: {d_name.upper()} (Test size: {len(te_df)}, Failures: {sum(te_df[TARGET]==0)})")
        res_df = analyze_thresholds(d_name, te_df, prefix)
        all_results.append(res_df)

        # Print Random Forest thresholds
        print(f"--- Random Forest Calibration ({d_name.upper()}) ---")
        rf_sub = res_df[res_df["Model"] == "Random Forest"][["Threshold", "Actual Failures", "Caught Fail (TP)", "Missed Fail (FN)", "False Alarms (FP)", "Total Warnings", "Failure Recall", "Failure Precision", "Accuracy"]]
        print(rf_sub.to_string(index=False))

        # Print Logistic Regression thresholds
        print(f"\n--- Logistic Regression Calibration ({d_name.upper()}) ---")
        lr_sub = res_df[res_df["Model"] == "Logistic Regression"][["Threshold", "Actual Failures", "Caught Fail (TP)", "Missed Fail (FN)", "False Alarms (FP)", "Total Warnings", "Failure Recall", "Failure Precision", "Accuracy"]]
        print(lr_sub.to_string(index=False))

    master_df = pd.concat(all_results, ignore_index=True)
    master_df.to_csv(OUT_DIR / "all_domains_threshold_analysis.csv", index=False)
    print(f"\nSaved full master report: {OUT_DIR / 'all_domains_threshold_analysis.csv'}")


if __name__ == "__main__":
    main()
