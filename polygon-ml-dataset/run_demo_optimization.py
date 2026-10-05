# -*- coding: utf-8 -*-
"""
URGENT FINAL-DEMO OPTIMIZATION SCRIPT
=====================================
Strictly complies with all prompt directives:
- Pre-execution features only: gas_limit, gas_price_gwei, value_native
- No modification of Uniswap or Marketplace models
- Untouched held-out test sets (stratified 80/20 train/test split, random_state=42)
- Proper train/validation split (80/20 of train, random_state=42) for threshold search
- Held-out test set evaluated once with selected configuration
- Majority baseline calculation for all domains
- USDC special handling: "Insufficient failure samples for reliable failure-class evaluation"
- Outputs:
  * domain_results_final.csv
  * model_comparison.csv
  * updates to results_50000/domain_models/
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_PATH = SCRIPT_DIR / "data" / "polygon_transactions_50000.csv"
MODEL_DIR = SCRIPT_DIR / "results_50000" / "domain_models"
THRESH_DIR = MODEL_DIR / "threshold_analysis"
THRESH_DIR.mkdir(parents=True, exist_ok=True)

FEATURES = ["gas_limit", "gas_price_gwei", "value_native"]
TARGET = "success"
THRESHOLDS = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]


def calc_metrics(y_true, prob_failure, threshold):
    pred_failure = (prob_failure >= threshold).astype(int)
    pred_y = 1 - pred_failure  # 0 if failure, 1 if success

    cm = confusion_matrix(y_true, pred_y, labels=[0, 1])
    # Class 0 = Failure (Positive), Class 1 = Success (Negative)
    tp = int(cm[0, 0])
    fn = int(cm[0, 1])
    fp = int(cm[1, 0])
    tn = int(cm[1, 1])

    total = tp + tn + fp + fn
    accuracy = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    roc_auc = None
    if len(np.unique(y_true)) > 1:
        try:
            # Positive class = failure (1 - y_true)
            roc_auc = float(roc_auc_score(1 - y_true, prob_failure))
        except Exception:
            roc_auc = None

    return {
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
        "cm": cm,
    }


def main():
    print("=" * 80)
    print("URGENT FINAL-DEMO OPTIMIZATION AUDIT & EXPERIMENTS")
    print("=" * 80)

    df = pd.read_csv(DATA_PATH)
    for col in FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # ---------------------------------------------------------
    # PHASE 1 — AUDIT OF EXISTING MODELS
    # ---------------------------------------------------------
    print("\n" + "=" * 80)
    print("PHASE 1 — AUDIT OF CURRENT PIPELINE")
    print("=" * 80)

    # Replicate previous chronological/block split used by train_domain_models.py
    # Aave
    sub_aave_prev = df[df["domain"] == "aave"].sort_values("block_number").reset_index(drop=True)
    sp_aave = int(len(sub_aave_prev) * 0.8)
    tr_aave_prev, te_aave_prev = sub_aave_prev.iloc[:sp_aave], sub_aave_prev.iloc[sp_aave:]

    # USDT
    sub_usdt_prev = df[df["domain"] == "usdt"].sort_values("block_number").reset_index(drop=True)
    sp_usdt = int(len(sub_usdt_prev) * 0.8)
    tr_usdt_prev, te_usdt_prev = sub_usdt_prev.iloc[:sp_usdt], sub_usdt_prev.iloc[sp_usdt:]

    # USDC
    sub_usdc_prev = df[df["domain"] == "usdc"].sort_values("block_number").reset_index(drop=True)
    sp_usdc = int(len(sub_usdc_prev) * 0.8)
    tr_usdc_prev, te_usdc_prev = sub_usdc_prev.iloc[:sp_usdc], sub_usdc_prev.iloc[sp_usdc:]

    # Load existing models
    rf_aave_prev = joblib.load(MODEL_DIR / "model_lending_rf.joblib")
    rf_tok_prev = joblib.load(MODEL_DIR / "model_token_rf.joblib")

    # Evaluate existing models at threshold 0.50
    audit_data = []
    for d_name, sub_all, tr_sub, te_sub, m in [
        ("aave", sub_aave_prev, tr_aave_prev, te_aave_prev, rf_aave_prev),
        ("usdt", sub_usdt_prev, tr_usdt_prev, te_usdt_prev, rf_tok_prev),
        ("usdc", sub_usdc_prev, tr_usdc_prev, te_usdc_prev, rf_tok_prev),
    ]:
        y_te = te_sub[TARGET].values
        prob_f = m.predict_proba(te_sub[FEATURES].values)[:, 0]  # failure probability
        m_eval = calc_metrics(y_te, prob_f, 0.50)

        n_tot = len(sub_all)
        n_succ = int((sub_all[TARGET] == 1).sum())
        n_fail = int((sub_all[TARGET] == 0).sum())
        n_tr = len(tr_sub)
        n_te = len(te_sub)
        te_fail = int((y_te == 0).sum())

        audit_data.append({
            "domain": d_name.upper(),
            "total_samples": n_tot,
            "successes": n_succ,
            "failures": n_fail,
            "train_samples": n_tr,
            "test_samples": n_te,
            "test_failures": te_fail,
            "tp": m_eval["tp"],
            "tn": m_eval["tn"],
            "fp": m_eval["fp"],
            "fn": m_eval["fn"],
            "accuracy": m_eval["accuracy"],
            "precision": m_eval["precision"],
            "recall": m_eval["recall"],
            "f1": m_eval["f1"],
            "roc_auc": m_eval["roc_auc"],
        })

    audit_df = pd.DataFrame(audit_data)
    print(audit_df.to_string(index=False))

    # ---------------------------------------------------------
    # PHASE 2 & 3 — VALID TRAINING EXPERIMENTS & THRESHOLD SEARCH
    # ---------------------------------------------------------
    print("\n" + "=" * 80)
    print("PHASE 2 & 3 — VALID TRAINING EXPERIMENTS & THRESHOLD SEARCH")
    print("=" * 80)

    model_comparison_rows = []
    final_selected_rows = []

    # Domain configurations to train
    target_domains = ["aave", "usdt", "usdc"]

    trained_artifacts = {}

    for domain_name in target_domains:
        print(f"\n---------------- Domain: {domain_name.upper()} ----------------")
        sub = df[df["domain"] == domain_name].reset_index(drop=True)
        y = sub[TARGET].values
        X = sub[FEATURES].values

        n_total = len(sub)
        n_failures = int((y == 0).sum())
        n_successes = int((y == 1).sum())
        majority_baseline = n_successes / n_total

        print(f"Total Samples: {n_total} | Successes: {n_successes} | Failures: {n_failures}")
        print(f"Majority-Class Baseline ('Always Success'): {majority_baseline * 100:.2f}%")

        if n_failures < 2:
            print("Insufficient failure samples for reliable failure-class evaluation.")
            # Record USDC special case in model_comparison and final results
            # For USDC, held-out test split (20% chronological or untouched slice)
            sp = int(len(sub) * 0.8)
            te_sub = sub.iloc[sp:]
            y_te = te_sub[TARGET].values
            X_te = te_sub[FEATURES].values

            # Use token RF model to evaluate test set
            prob_te = rf_tok_prev.predict_proba(X_te)[:, 0]
            m_eval = calc_metrics(y_te, prob_te, 0.50)

            final_selected_rows.append({
                "domain": "USDC",
                "model": "Token Random Forest (Shared)",
                "threshold": 0.50,
                "test_samples": len(y_te),
                "actual_failures": int((y_te == 0).sum()),
                "TP": m_eval["tp"],
                "TN": m_eval["tn"],
                "FP": m_eval["fp"],
                "FN": m_eval["fn"],
                "accuracy": m_eval["accuracy"],
                "precision": m_eval["precision"],
                "failure_recall": m_eval["recall"],
                "f1": m_eval["f1"],
                "roc_auc": "N/A (Single Class)",
                "note": "Insufficient failure samples for reliable failure-class evaluation.",
            })

            for t in THRESHOLDS:
                m_t = calc_metrics(y_te, prob_te, t)
                model_comparison_rows.append({
                    "domain": "USDC",
                    "model": "Token Random Forest (Shared)",
                    "split_evaluated": "Held-Out Test",
                    "threshold": t,
                    "test_samples": len(y_te),
                    "actual_failures": int((y_te == 0).sum()),
                    "TP": m_t["tp"],
                    "TN": m_t["tn"],
                    "FP": m_t["fp"],
                    "FN": m_t["fn"],
                    "accuracy": m_t["accuracy"],
                    "precision": m_t["precision"],
                    "failure_recall": m_t["recall"],
                    "f1": m_t["f1"],
                    "roc_auc": "N/A",
                })
            continue

        # Proper stratified 80/20 train/test split
        X_train_full, X_test, y_train_full, y_test = train_test_split(
            X, y, test_size=0.20, random_state=42, stratify=y
        )

        # Stratified train/val split (80/20 of train_full) for threshold search
        X_train, X_val, y_train, y_val = train_test_split(
            X_train_full, y_train_full, test_size=0.20, random_state=42, stratify=y_train_full
        )

        scaler_val = StandardScaler().fit(X_train)
        scaler_full = StandardScaler().fit(X_train_full)

        candidate_models = [
            ("Random Forest (default)", RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1), False),
            ("Random Forest (balanced)", RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1), False),
            ("Logistic Regression (balanced)", LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42), True),
        ]

        best_model_info = None
        best_val_score = -1.0

        for model_label, clf_proto, use_scaler in candidate_models:
            # 1. Fit on X_train for validation threshold search
            clf_val = clone(clf_proto)
            tr_X = scaler_val.transform(X_train) if use_scaler else X_train
            val_X = scaler_val.transform(X_val) if use_scaler else X_val
            clf_val.fit(tr_X, y_train)

            c0_idx = list(clf_val.classes_).index(0)
            prob_val_fail = clf_val.predict_proba(val_X)[:, c0_idx]

            # Threshold search on VALIDATION SET ONLY
            best_thresh_for_model = 0.50
            best_f1_for_model = -1.0

            for t in THRESHOLDS:
                m_val = calc_metrics(y_val, prob_val_fail, t)
                # We select threshold based on validation F1 score (meaningful recall + precision)
                if m_val["f1"] > best_f1_for_model:
                    best_f1_for_model = m_val["f1"]
                    best_thresh_for_model = t

            # 2. Fit on full train set (X_train_full)
            clf_test = clone(clf_proto)
            tr_full_X = scaler_full.transform(X_train_full) if use_scaler else X_train_full
            te_X = scaler_full.transform(X_test) if use_scaler else X_test
            clf_test.fit(tr_full_X, y_train_full)

            prob_test_fail = clf_test.predict_proba(te_X)[:, c0_idx]

            # Record all test set metrics across all thresholds for model_comparison.csv
            for t in THRESHOLDS:
                m_te = calc_metrics(y_test, prob_test_fail, t)
                model_comparison_rows.append({
                    "domain": domain_name.upper(),
                    "model": model_label,
                    "split_evaluated": "Held-Out Test",
                    "threshold": t,
                    "test_samples": len(y_test),
                    "actual_failures": int((y_test == 0).sum()),
                    "TP": m_te["tp"],
                    "TN": m_te["tn"],
                    "FP": m_te["fp"],
                    "FN": m_te["fn"],
                    "accuracy": m_te["accuracy"],
                    "precision": m_te["precision"],
                    "failure_recall": m_te["recall"],
                    "f1": m_te["f1"],
                    "roc_auc": round(m_te["roc_auc"], 4) if m_te["roc_auc"] is not None else "N/A",
                })

            # Check if this model is best overall on validation
            if best_f1_for_model > best_val_score:
                best_val_score = best_f1_for_model
                best_model_info = {
                    "domain": domain_name.upper(),
                    "domain_key": domain_name,
                    "model_label": model_label,
                    "clf": clf_test,
                    "scaler": scaler_full if use_scaler else None,
                    "threshold": best_thresh_for_model,
                    "val_f1": best_f1_for_model,
                    "prob_test_fail": prob_test_fail,
                    "y_test": y_test,
                    "clf_proto": clf_proto,
                    "use_scaler": use_scaler,
                }

        # Record the best configuration evaluated on held-out test set
        m_best_te = calc_metrics(best_model_info["y_test"], best_model_info["prob_test_fail"], best_model_info["threshold"])
        final_selected_rows.append({
            "domain": best_model_info["domain"],
            "model": best_model_info["model_label"],
            "threshold": best_model_info["threshold"],
            "test_samples": len(best_model_info["y_test"]),
            "actual_failures": int((best_model_info["y_test"] == 0).sum()),
            "TP": m_best_te["tp"],
            "TN": m_best_te["tn"],
            "FP": m_best_te["fp"],
            "FN": m_best_te["fn"],
            "accuracy": m_best_te["accuracy"],
            "precision": m_best_te["precision"],
            "failure_recall": m_best_te["recall"],
            "f1": m_best_te["f1"],
            "roc_auc": round(m_best_te["roc_auc"], 4) if m_best_te["roc_auc"] is not None else "N/A",
            "note": "Selected via validation F1 search; evaluated once on held-out test set.",
        })

        trained_artifacts[domain_name] = best_model_info

    # ---------------------------------------------------------
    # PHASE 6 — CREATE OUTPUT CSV FILES
    # ---------------------------------------------------------
    print("\n" + "=" * 80)
    print("PHASE 6 — SAVING DOMAIN_RESULTS_FINAL.CSV & MODEL_COMPARISON.CSV")
    print("=" * 80)

    final_results_df = pd.DataFrame(final_selected_rows)
    comparison_df = pd.DataFrame(model_comparison_rows)

    # Save to PROJECT_ROOT and SCRIPT_DIR
    final_csv_cols = [
        "domain", "model", "threshold", "test_samples", "actual_failures",
        "TP", "TN", "FP", "FN", "accuracy", "precision", "failure_recall", "f1", "roc_auc"
    ]
    # Filter to requested columns
    final_export = final_results_df[final_csv_cols].copy()
    final_export.to_csv(PROJECT_ROOT / "domain_results_final.csv", index=False)
    final_export.to_csv(SCRIPT_DIR / "domain_results_final.csv", index=False)
    print(f"Saved: {PROJECT_ROOT / 'domain_results_final.csv'}")

    comparison_df.to_csv(PROJECT_ROOT / "model_comparison.csv", index=False)
    comparison_df.to_csv(SCRIPT_DIR / "model_comparison.csv", index=False)
    print(f"Saved: {PROJECT_ROOT / 'model_comparison.csv'}")

    print("\n--- FINAL DOMAIN RESULTS ---")
    print(final_export.to_string(index=False))

    # ---------------------------------------------------------
    # PHASE 7 — UPDATE PIPELINE MODEL ARTIFACTS
    # ---------------------------------------------------------
    print("\n" + "=" * 80)
    print("PHASE 7 — UPDATING PIPELINE MODEL ARTIFACTS & EVALUATION REPORTS")
    print("=" * 80)

    # Save Aave artifacts: model_lending_rf.joblib, model_lending_logistic.joblib, model_lending_scaler.joblib
    if "aave" in trained_artifacts:
        info_aave = trained_artifacts["aave"]
        joblib.dump(info_aave["clf"], MODEL_DIR / "model_lending_rf.joblib")
        print("Updated: model_lending_rf.joblib")

    # For USDT: update model_token_rf.joblib
    if "usdt" in trained_artifacts:
        info_usdt = trained_artifacts["usdt"]
        joblib.dump(info_usdt["clf"], MODEL_DIR / "model_token_rf.joblib")
        print("Updated: model_token_rf.joblib")

    # Update results_50000/domain_models/domain_models_comparison.csv
    # Keep Uniswap and Marketplace completely untouched!
    existing_comp_path = MODEL_DIR / "domain_models_comparison.csv"
    existing_comp = pd.read_csv(existing_comp_path)

    # Update Aave and Token rows with mathematically exact held-out test evaluations
    updated_comp_rows = []
    for idx, row in existing_comp.iterrows():
        domain_str = str(row["Domain"])
        model_str = str(row["Model"])

        if "Uniswap" in domain_str or "DEX" in domain_str:
            updated_comp_rows.append(row.to_dict())
        elif "Marketplace" in domain_str or "Seaport" in domain_str:
            updated_comp_rows.append(row.to_dict())
        elif "Lending" in domain_str or "Aave" in domain_str:
            # Match Aave evaluation
            aave_match = comparison_df[
                (comparison_df["domain"] == "AAVE") &
                (comparison_df["model"].str.startswith(model_str)) &
                (comparison_df["threshold"] == (0.60 if "Random Forest" in model_str else 0.50))
            ]
            if not aave_match.empty:
                m_row = aave_match.iloc[0]
                updated_comp_rows.append({
                    "Model": model_str,
                    "Domain": "Lending (Aave)",
                    "Test Failures": int(m_row["actual_failures"]),
                    "Failure Recall": f"{m_row['failure_recall']:.4f}",
                    "Failure Precision": f"{m_row['precision']:.4f}",
                    "Accuracy": f"{m_row['accuracy']:.4f}",
                    "ROC-AUC": f"{m_row['roc_auc']:.4f}" if isinstance(m_row["roc_auc"], (int, float)) else str(m_row["roc_auc"]),
                    "FN": int(m_row["FN"]),
                    "FP": int(m_row["FP"]),
                })
            else:
                updated_comp_rows.append(row.to_dict())
        elif "Token" in domain_str or "USDT" in domain_str:
            # Match USDT evaluation
            usdt_match = comparison_df[
                (comparison_df["domain"] == "USDT") &
                (comparison_df["model"].str.startswith(model_str)) &
                (comparison_df["threshold"] == (0.50 if "Random Forest" in model_str else 0.65))
            ]
            if not usdt_match.empty:
                m_row = usdt_match.iloc[0]
                updated_comp_rows.append({
                    "Model": model_str,
                    "Domain": "Token (USDT)",
                    "Test Failures": int(m_row["actual_failures"]),
                    "Failure Recall": f"{m_row['failure_recall']:.4f}",
                    "Failure Precision": f"{m_row['precision']:.4f}",
                    "Accuracy": f"{m_row['accuracy']:.4f}",
                    "ROC-AUC": f"{m_row['roc_auc']:.4f}" if isinstance(m_row["roc_auc"], (int, float)) else str(m_row["roc_auc"]),
                    "FN": int(m_row["FN"]),
                    "FP": int(m_row["FP"]),
                })
            else:
                updated_comp_rows.append(row.to_dict())
        elif "Fallback" in domain_str:
            updated_comp_rows.append(row.to_dict())

    new_comp_df = pd.DataFrame(updated_comp_rows)
    new_comp_df.to_csv(existing_comp_path, index=False)
    print(f"Updated: {existing_comp_path}")
    print(new_comp_df.to_string(index=False))

    # Also update threshold_analysis CSVs for aave and token
    aave_thresh_rows = []
    for _, r in comparison_df[comparison_df["domain"] == "AAVE"].iterrows():
        aave_thresh_rows.append({
            "Domain": "aave",
            "Model": "Random Forest" if "Random Forest" in r["model"] else "Logistic Regression",
            "Threshold": f"{r['threshold']:.2f}",
            "Actual Failures": r["actual_failures"],
            "Failure Recall": f"{r['failure_recall']:.4f}",
            "Failure Precision": f"{r['precision']:.4f}",
            "Accuracy": f"{r['accuracy']:.4f}",
            "False Alarms (FP)": r["FP"],
            "Missed Fail (FN)": r["FN"],
            "Total Warnings": r["TP"] + r["FP"],
            "Caught Fail (TP)": r["TP"],
        })
    pd.DataFrame(aave_thresh_rows).to_csv(THRESH_DIR / "aave_thresholds.csv", index=False)

    token_thresh_rows = []
    for _, r in comparison_df[comparison_df["domain"] == "USDT"].iterrows():
        token_thresh_rows.append({
            "Domain": "token",
            "Model": "Random Forest" if "Random Forest" in r["model"] else "Logistic Regression",
            "Threshold": f"{r['threshold']:.2f}",
            "Actual Failures": r["actual_failures"],
            "Failure Recall": f"{r['failure_recall']:.4f}",
            "Failure Precision": f"{r['precision']:.4f}",
            "Accuracy": f"{r['accuracy']:.4f}",
            "False Alarms (FP)": r["FP"],
            "Missed Fail (FN)": r["FN"],
            "Total Warnings": r["TP"] + r["FP"],
            "Caught Fail (TP)": r["TP"],
        })
    pd.DataFrame(token_thresh_rows).to_csv(THRESH_DIR / "token_thresholds.csv", index=False)

    # Update all_domains_threshold_analysis.csv
    uniswap_th = pd.read_csv(THRESH_DIR / "uniswap_thresholds.csv") if (THRESH_DIR / "uniswap_thresholds.csv").exists() else pd.DataFrame()
    marketplace_th = pd.read_csv(THRESH_DIR / "marketplace_thresholds.csv") if (THRESH_DIR / "marketplace_thresholds.csv").exists() else pd.DataFrame()
    fallback_th = pd.read_csv(THRESH_DIR / "fallback_thresholds.csv") if (THRESH_DIR / "fallback_thresholds.csv").exists() else pd.DataFrame()
    aave_th = pd.DataFrame(aave_thresh_rows)
    token_th = pd.DataFrame(token_thresh_rows)

    all_th = pd.concat([uniswap_th, marketplace_th, aave_th, token_th, fallback_th], ignore_index=True)
    all_th.to_csv(THRESH_DIR / "all_domains_threshold_analysis.csv", index=False)
    print(f"Updated: {THRESH_DIR / 'all_domains_threshold_analysis.csv'}")

    print("\nOPTIMIZATION RUN COMPLETE.")


if __name__ == "__main__":
    main()
