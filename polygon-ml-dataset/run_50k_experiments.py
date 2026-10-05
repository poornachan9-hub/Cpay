# -*- coding: utf-8 -*-
"""
Polygon 50k Multi-Domain Transaction Failure Prediction Experiments
===================================================================
Experiments:
1. Naive Global Chronological Split (demonstrating throughput mismatch)
2. Primary: Domain-Stratified Chronological Split (Overall + Per-Domain)
3. Cross-Domain Generalization (Train: Uniswap+Aave+USDT+USDC, Test: Marketplace)
4. Nonce Ablation (Primary experiment: with nonce vs without nonce)

Features (Strictly Pre-Execution):
- gas_limit
- gas_price_gwei
- value_native
- nonce (ablated in Exp 4)
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PATH = SCRIPT_DIR / "data" / "polygon_transactions_50000.csv"
RESULTS_DIR = SCRIPT_DIR / "results_50000"
RESULTS_DIR.mkdir(exist_ok=True)

TARGET = "success"
BASE_FEATURES = ["gas_limit", "gas_price_gwei", "value_native"]
FULL_FEATURES = ["gas_limit", "gas_price_gwei", "value_native", "nonce"]
DOMAINS = ["uniswap", "aave", "marketplace", "usdt", "usdc"]


def evaluate_predictions(y_true, y_pred, y_prob=None):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    # cm: [[Actual:0 Pred:0, Actual:0 Pred:1],
    #      [Actual:1 Pred:0, Actual:1 Pred:1]]
    tn_fail = int(cm[0, 0])  # Actual Fail, Pred Fail
    fn_fail = int(cm[0, 1])  # Actual Fail, Pred Success (Missed Failure)
    fp_fail = int(cm[1, 0])  # Actual Success, Pred Fail (False Alarm)
    tp_succ = int(cm[1, 1])  # Actual Success, Pred Success

    acc = accuracy_score(y_true, y_pred)
    prec_succ = precision_score(y_true, y_pred, pos_label=1, zero_division=0)
    rec_succ = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
    prec_fail = precision_score(y_true, y_pred, pos_label=0, zero_division=0)
    rec_fail = recall_score(y_true, y_pred, pos_label=0, zero_division=0)
    f1_macro = f1_score(y_true, y_pred, average="macro", zero_division=0)
    f1_succ = f1_score(y_true, y_pred, pos_label=1, zero_division=0)
    f1_fail = f1_score(y_true, y_pred, pos_label=0, zero_division=0)

    roc_auc = None
    if y_prob is not None and len(np.unique(y_true)) > 1:
        try:
            roc_auc = roc_auc_score(y_true, y_prob)
        except Exception:
            roc_auc = None

    return {
        "accuracy": acc,
        "precision_succ": prec_succ,
        "recall_succ": rec_succ,
        "precision_fail": prec_fail,
        "recall_fail": rec_fail,
        "f1_macro": f1_macro,
        "f1_succ": f1_succ,
        "f1_fail": f1_fail,
        "roc_auc": roc_auc,
        "cm": cm,
        "tn_fail": tn_fail,
        "fn_fail": fn_fail,
        "fp_fail": fp_fail,
        "tp_succ": tp_succ,
    }


def train_and_eval(X_train, y_train, X_test, y_test):
    # Scale for Logistic Regression
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    # 1. Logistic Regression
    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    lr.fit(X_train_sc, y_train)
    y_pred_lr = lr.predict(X_test_sc)
    y_prob_lr = lr.predict_proba(X_test_sc)[:, 1]
    res_lr = evaluate_predictions(y_test, y_pred_lr, y_prob_lr)
    res_lr["model_obj"] = lr
    res_lr["scaler_obj"] = scaler

    # 2. Random Forest
    rf = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    y_pred_rf = rf.predict(X_test)
    y_prob_rf = rf.predict_proba(X_test)[:, 1]
    res_rf = evaluate_predictions(y_test, y_pred_rf, y_prob_rf)
    res_rf["model_obj"] = rf

    return res_lr, res_rf


def format_row(exp_name, model_name, res, domain="ALL"):
    auc_str = f"{res['roc_auc']:.4f}" if res['roc_auc'] is not None else "N/A"
    return {
        "Experiment": exp_name,
        "Domain": domain,
        "Model": model_name,
        "Accuracy": f"{res['accuracy']:.4f}",
        "Prec(Succ)": f"{res['precision_succ']:.4f}",
        "Rec(Succ)": f"{res['recall_succ']:.4f}",
        "Rec(Fail)": f"{res['recall_fail']:.4f}",
        "Prec(Fail)": f"{res['precision_fail']:.4f}",
        "F1(Macro)": f"{res['f1_macro']:.4f}",
        "ROC-AUC": auc_str,
        "TP(Succ)": res["tp_succ"],
        "FP(Succ)": res["fn_fail"],
        "TN(Succ)": res["tn_fail"],
        "FN(Succ)": res["fp_fail"],
        "CaughtFail(TP0)": res["tn_fail"],
        "MissedFail(FN0)": res["fn_fail"],
    }


def main():
    print("=" * 70)
    print("POLYGON 50K ML EXPERIMENTS (PRE-EXECUTION FEATURES ONLY)")
    print("=" * 70)

    df = pd.read_csv(DATA_PATH)
    print(f"Loaded dataset: {DATA_PATH.name} ({len(df)} rows)")

    # Ensure numeric
    for col in FULL_FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    summary_table_rows = []

    # =========================================================================
    # EXPERIMENT 1: NAIVE GLOBAL CHRONOLOGICAL
    # =========================================================================
    print("\n" + "=" * 70)
    print("EXPERIMENT 1: NAIVE GLOBAL CHRONOLOGICAL SPLIT (80/20)")
    print("=" * 70)
    df_sorted = df.sort_values("block_number").reset_index(drop=True)
    split_g = int(len(df_sorted) * 0.8)
    tr_g = df_sorted.iloc[:split_g]
    te_g = df_sorted.iloc[split_g:]

    print(f"Train size: {len(tr_g)} | Test size: {len(te_g)}")
    print("Test set domain composition:")
    for d, c in te_g['domain'].value_counts().items():
        print(f"  {d:12}: {c} rows ({(c/len(te_g))*100:.1f}%)")

    res_lr_1, res_rf_1 = train_and_eval(
        tr_g[FULL_FEATURES].values, tr_g[TARGET].values,
        te_g[FULL_FEATURES].values, te_g[TARGET].values
    )
    summary_table_rows.append(format_row("Exp 1 (Naive Global)", "Logistic Regression", res_lr_1))
    summary_table_rows.append(format_row("Exp 1 (Naive Global)", "Random Forest", res_rf_1))

    # =========================================================================
    # EXPERIMENT 2: PRIMARY DOMAIN-STRATIFIED CHRONOLOGICAL
    # =========================================================================
    print("\n" + "=" * 70)
    print("EXPERIMENT 2: PRIMARY DOMAIN-STRATIFIED CHRONOLOGICAL SPLIT")
    print("=" * 70)

    train_domain_dfs = []
    test_domain_dfs = []

    for d in DOMAINS:
        sub = df[df["domain"] == d].sort_values("block_number").reset_index(drop=True)
        split_d = int(len(sub) * 0.8)
        train_domain_dfs.append(sub.iloc[:split_d])
        test_domain_dfs.append(sub.iloc[split_d:])

    train_p = pd.concat(train_domain_dfs, ignore_index=True)
    test_p = pd.concat(test_domain_dfs, ignore_index=True)

    print(f"Primary Train size: {len(train_p)} rows ({sum(train_p[TARGET]==0)} failures)")
    print(f"Primary Test size : {len(test_p)} rows ({sum(test_p[TARGET]==0)} failures)")

    res_lr_2, res_rf_2 = train_and_eval(
        train_p[FULL_FEATURES].values, train_p[TARGET].values,
        test_p[FULL_FEATURES].values, test_p[TARGET].values
    )
    summary_table_rows.append(format_row("Exp 2 (Primary Overall)", "Logistic Regression", res_lr_2))
    summary_table_rows.append(format_row("Exp 2 (Primary Overall)", "Random Forest", res_rf_2))

    # Per-Domain Breakdown on Primary Test Set
    per_domain_results = []
    for d, te_sub in zip(DOMAINS, test_domain_dfs):
        X_sub = te_sub[FULL_FEATURES].values
        y_sub = te_sub[TARGET].values
        X_sub_sc = res_lr_2["scaler_obj"].transform(X_sub)

        # LR on domain
        pred_lr = res_lr_2["model_obj"].predict(X_sub_sc)
        prob_lr = res_lr_2["model_obj"].predict_proba(X_sub_sc)[:, 1]
        ev_lr = evaluate_predictions(y_sub, pred_lr, prob_lr)
        summary_table_rows.append(format_row("Exp 2 (Per Domain)", "Logistic Regression", ev_lr, domain=d))

        # RF on domain
        pred_rf = res_rf_2["model_obj"].predict(X_sub)
        prob_rf = res_rf_2["model_obj"].predict_proba(X_sub)[:, 1]
        ev_rf = evaluate_predictions(y_sub, pred_rf, prob_rf)
        summary_table_rows.append(format_row("Exp 2 (Per Domain)", "Random Forest", ev_rf, domain=d))

    # =========================================================================
    # EXPERIMENT 3: CROSS-DOMAIN GENERALIZATION
    # =========================================================================
    print("\n" + "=" * 70)
    print("EXPERIMENT 3: CROSS-DOMAIN GENERALIZATION (Train: 4 domains, Test: Marketplace)")
    print("=" * 70)
    train_cd = df[df["domain"] != "marketplace"]
    test_cd = df[df["domain"] == "marketplace"]
    print(f"Train size (Uniswap+Aave+USDT+USDC): {len(train_cd)} rows ({sum(train_cd[TARGET]==0)} failures)")
    print(f"Test size (Marketplace / Seaport)  : {len(test_cd)} rows ({sum(test_cd[TARGET]==0)} failures)")

    res_lr_3, res_rf_3 = train_and_eval(
        train_cd[FULL_FEATURES].values, train_cd[TARGET].values,
        test_cd[FULL_FEATURES].values, test_cd[TARGET].values
    )
    summary_table_rows.append(format_row("Exp 3 (Cross-Domain)", "Logistic Regression", res_lr_3, domain="Marketplace"))
    summary_table_rows.append(format_row("Exp 3 (Cross-Domain)", "Random Forest", res_rf_3, domain="Marketplace"))

    # =========================================================================
    # EXPERIMENT 4: NONCE ABLATION (WITH vs WITHOUT NONCE ON PRIMARY SPLIT)
    # =========================================================================
    print("\n" + "=" * 70)
    print("EXPERIMENT 4: NONCE ABLATION (WITH vs WITHOUT NONCE ON PRIMARY SPLIT)")
    print("=" * 70)

    # 4A: With Nonce is already res_lr_2 and res_rf_2
    summary_table_rows.append(format_row("Exp 4A (With Nonce)", "Logistic Regression", res_lr_2))
    summary_table_rows.append(format_row("Exp 4A (With Nonce)", "Random Forest", res_rf_2))

    # 4B: Without Nonce
    res_lr_4b, res_rf_4b = train_and_eval(
        train_p[BASE_FEATURES].values, train_p[TARGET].values,
        test_p[BASE_FEATURES].values, test_p[TARGET].values
    )
    summary_table_rows.append(format_row("Exp 4B (No Nonce)", "Logistic Regression", res_lr_4b))
    summary_table_rows.append(format_row("Exp 4B (No Nonce)", "Random Forest", res_rf_4b))

    # Compile Summary DataFrame
    summary_df = pd.DataFrame(summary_table_rows)
    print("\n" + "=" * 70)
    print("COMPLETE EXPERIMENTAL RESULTS SUMMARY TABLE")
    print("=" * 70)
    print(summary_df.to_string(index=False))

    summary_df.to_csv(RESULTS_DIR / "experiments_summary.csv", index=False)
    print(f"\nSaved CSV: {RESULTS_DIR / 'experiments_summary.csv'}")

    # Feature Importance for Exp 2 (Primary) & Exp 4B (No Nonce)
    fi_full = pd.DataFrame({
        "feature": FULL_FEATURES,
        "rf_importance": res_rf_2["model_obj"].feature_importances_,
        "lr_standardized_coef": res_lr_2["model_obj"].coef_[0],
    }).sort_values("rf_importance", ascending=False)
    fi_full.to_csv(RESULTS_DIR / "feature_importance_primary.csv", index=False)
    print("\nPrimary Feature Importances / Coefficients:")
    print(fi_full.to_string(index=False))

    fi_base = pd.DataFrame({
        "feature": BASE_FEATURES,
        "rf_importance": res_rf_4b["model_obj"].feature_importances_,
        "lr_standardized_coef": res_lr_4b["model_obj"].coef_[0],
    }).sort_values("rf_importance", ascending=False)
    fi_base.to_csv(RESULTS_DIR / "feature_importance_no_nonce.csv", index=False)
    print("\nAblated (No Nonce) Feature Importances / Coefficients:")
    print(fi_base.to_string(index=False))


if __name__ == "__main__":
    main()
