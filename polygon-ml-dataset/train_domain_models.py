# -*- coding: utf-8 -*-
"""
Polygon Domain-Aware ML Architecture Training & Validation
==========================================================
Models:
1. DEX Model         : Trained on Uniswap V3 SwapRouter
2. Marketplace Model : Trained on OpenSea Seaport 1.5
3. Lending Model     : Trained on Aave V3 Pool
4. Token Model       : Trained on USDT + USDC combined
5. Fallback Model    : Trained on all 5 domains pooled

Features (Strictly Pre-Execution, Nonce Excluded):
- gas_limit
- gas_price_gwei
- value_native

Output: results_50000/domain_models/
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
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
OUT_DIR = SCRIPT_DIR / "results_50000" / "domain_models"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FEATURES = ["gas_limit", "gas_price_gwei", "value_native"]
TARGET = "success"


def eval_metrics(y_true, y_pred, y_prob=None):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    # Class 0 = Failure, Class 1 = Success
    # cm: [[Actual:0 Pred:0, Actual:0 Pred:1],
    #      [Actual:1 Pred:0, Actual:1 Pred:1]]
    tp_fail = int(cm[0, 0])  # Caught failure
    fn_fail = int(cm[0, 1])  # Missed failure
    fp_fail = int(cm[1, 0])  # False alarm
    tn_fail = int(cm[1, 1])  # True success

    acc = accuracy_score(y_true, y_pred)
    rec_fail = recall_score(y_true, y_pred, pos_label=0, zero_division=0)
    prec_fail = precision_score(y_true, y_pred, pos_label=0, zero_division=0)
    rec_succ = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
    prec_succ = precision_score(y_true, y_pred, pos_label=1, zero_division=0)
    f1_macro = f1_score(y_true, y_pred, average="macro", zero_division=0)

    roc_auc = None
    if y_prob is not None and len(np.unique(y_true)) > 1:
        try:
            roc_auc = roc_auc_score(y_true, y_prob)
        except Exception:
            roc_auc = None

    return {
        "acc": acc,
        "rec_fail": rec_fail,
        "prec_fail": prec_fail,
        "rec_succ": rec_succ,
        "prec_succ": prec_succ,
        "f1_macro": f1_macro,
        "roc_auc": roc_auc,
        "cm": cm,
        "tp": tp_fail,
        "fn": fn_fail,
        "fp": fp_fail,
        "tn": tn_fail,
    }


def train_eval_domain(name, X_tr, y_tr, X_te, y_te, save_prefix):
    scaler = StandardScaler()
    X_tr_sc = scaler.fit_transform(X_tr)
    X_te_sc = scaler.transform(X_te)

    # 1. Logistic Regression (Primary)
    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    lr.fit(X_tr_sc, y_tr)
    pred_lr = lr.predict(X_te_sc)
    prob_lr = lr.predict_proba(X_te_sc)[:, 1]
    m_lr = eval_metrics(y_te, pred_lr, prob_lr)

    # 2. Random Forest (Comparison)
    rf = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1)
    rf.fit(X_tr, y_tr)
    pred_rf = rf.predict(X_te)
    prob_rf = rf.predict_proba(X_te)[:, 1]
    m_rf = eval_metrics(y_te, pred_rf, prob_rf)

    # Save artifacts
    joblib.dump(scaler, OUT_DIR / f"{save_prefix}_scaler.joblib")
    joblib.dump(lr, OUT_DIR / f"{save_prefix}_logistic.joblib")
    joblib.dump(rf, OUT_DIR / f"{save_prefix}_rf.joblib")

    return m_lr, m_rf


def print_model_details(name, domain, m_lr, m_rf, n_test, n_fail, n_succ):
    fail_rate = 100.0 * n_fail / n_test if n_test else 0.0
    print(f"\n=======================================================")
    print(f"MODEL: {name} (Domain: {domain})")
    print(f"=======================================================")
    print(f"Test Rows: {n_test} | Failures: {n_fail} ({fail_rate:.2f}%) | Successes: {n_succ}")

    for model_name, m in [("Logistic Regression (Primary)", m_lr), ("Random Forest (Comparison)", m_rf)]:
        auc_str = f"{m['roc_auc']:.4f}" if m['roc_auc'] is not None else "N/A"
        print(f"\n-- {model_name} --")
        print(f"  Accuracy        : {m['acc']:.4f}")
        print(f"  Failure Recall  : {m['rec_fail']:.4f}")
        print(f"  Failure Prec    : {m['prec_fail']:.4f}")
        print(f"  Success Recall  : {m['rec_succ']:.4f}")
        print(f"  F1 Score (Macro): {m['f1_macro']:.4f}")
        print(f"  ROC-AUC         : {auc_str}")
        print(f"  Confusion Matrix (Class 0=Fail, Class 1=Succ):")
        print(f"                 Pred:Fail(0)  Pred:Succ(1)")
        print(f"  Actual:Fail(0)        {m['tp']:>5}         {m['fn']:>5}  (Missed Failures: {m['fn']})")
        print(f"  Actual:Succ(1)        {m['fp']:>5}         {m['tn']:>5}  (False Alarms: {m['fp']})")


def main():
    print("=" * 70)
    print("DOMAIN-AWARE PRE-TRANSACTION ML PIPELINE VALIDATION")
    print("=" * 70)

    df = pd.read_csv(DATA_PATH)
    for col in FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    results_table = []

    # 1. DEX MODEL (Uniswap)
    sub_uni = df[df["domain"] == "uniswap"].sort_values("block_number").reset_index(drop=True)
    sp = int(len(sub_uni) * 0.8)
    tr_uni, te_uni = sub_uni.iloc[:sp], sub_uni.iloc[sp:]
    m_lr_uni, m_rf_uni = train_eval_domain(
        "DEX Model", tr_uni[FEATURES].values, tr_uni[TARGET].values,
        te_uni[FEATURES].values, te_uni[TARGET].values, "model_dex"
    )
    print_model_details("DEX Model", "Uniswap", m_lr_uni, m_rf_uni, len(te_uni), sum(te_uni[TARGET]==0), sum(te_uni[TARGET]==1))

    # 2. MARKETPLACE MODEL (Seaport)
    sub_mkt = df[df["domain"] == "marketplace"].sort_values("block_number").reset_index(drop=True)
    sp = int(len(sub_mkt) * 0.8)
    tr_mkt, te_mkt = sub_mkt.iloc[:sp], sub_mkt.iloc[sp:]
    m_lr_mkt, m_rf_mkt = train_eval_domain(
        "Marketplace Model", tr_mkt[FEATURES].values, tr_mkt[TARGET].values,
        te_mkt[FEATURES].values, te_mkt[TARGET].values, "model_marketplace"
    )
    print_model_details("Marketplace Model", "Seaport", m_lr_mkt, m_rf_mkt, len(te_mkt), sum(te_mkt[TARGET]==0), sum(te_mkt[TARGET]==1))

    # 3. LENDING MODEL (Aave)
    sub_aave = df[df["domain"] == "aave"].sort_values("block_number").reset_index(drop=True)
    sp = int(len(sub_aave) * 0.8)
    tr_aave, te_aave = sub_aave.iloc[:sp], sub_aave.iloc[sp:]
    m_lr_aave, m_rf_aave = train_eval_domain(
        "Lending Model", tr_aave[FEATURES].values, tr_aave[TARGET].values,
        te_aave[FEATURES].values, te_aave[TARGET].values, "model_lending"
    )
    print_model_details("Lending Model", "Aave", m_lr_aave, m_rf_aave, len(te_aave), sum(te_aave[TARGET]==0), sum(te_aave[TARGET]==1))

    # 4. TOKEN MODEL (USDT + USDC together)
    sub_usdt = df[df["domain"] == "usdt"].sort_values("block_number").reset_index(drop=True)
    sub_usdc = df[df["domain"] == "usdc"].sort_values("block_number").reset_index(drop=True)
    sp_t = int(len(sub_usdt) * 0.8)
    sp_c = int(len(sub_usdc) * 0.8)
    tr_tok = pd.concat([sub_usdt.iloc[:sp_t], sub_usdc.iloc[:sp_c]], ignore_index=True)
    te_tok = pd.concat([sub_usdt.iloc[sp_t:], sub_usdc.iloc[sp_c:]], ignore_index=True)
    m_lr_tok, m_rf_tok = train_eval_domain(
        "Token Model", tr_tok[FEATURES].values, tr_tok[TARGET].values,
        te_tok[FEATURES].values, te_tok[TARGET].values, "model_token"
    )
    print_model_details("Token Model", "USDT+USDC", m_lr_tok, m_rf_tok, len(te_tok), sum(te_tok[TARGET]==0), sum(te_tok[TARGET]==1))

    # 5. GENERAL FALLBACK MODEL (All domains)
    tr_all = pd.concat([tr_uni, tr_mkt, tr_aave, tr_tok], ignore_index=True)
    te_all = pd.concat([te_uni, te_mkt, te_aave, te_tok], ignore_index=True)
    m_lr_gen, m_rf_gen = train_eval_domain(
        "Fallback Model", tr_all[FEATURES].values, tr_all[TARGET].values,
        te_all[FEATURES].values, te_all[TARGET].values, "model_fallback"
    )
    print_model_details("Fallback Model", "All Domains", m_lr_gen, m_rf_gen, len(te_all), sum(te_all[TARGET]==0), sum(te_all[TARGET]==1))

    # Build concise comparison table
    runs = [
        ("Logistic Regression", "DEX", "Uniswap", len(te_uni), sum(te_uni[TARGET]==0), m_lr_uni),
        ("Random Forest", "DEX", "Uniswap", len(te_uni), sum(te_uni[TARGET]==0), m_rf_uni),
        ("Logistic Regression", "Marketplace", "Seaport", len(te_mkt), sum(te_mkt[TARGET]==0), m_lr_mkt),
        ("Random Forest", "Marketplace", "Seaport", len(te_mkt), sum(te_mkt[TARGET]==0), m_rf_mkt),
        ("Logistic Regression", "Lending", "Aave", len(te_aave), sum(te_aave[TARGET]==0), m_lr_aave),
        ("Random Forest", "Lending", "Aave", len(te_aave), sum(te_aave[TARGET]==0), m_rf_aave),
        ("Logistic Regression", "Token", "USDT+USDC", len(te_tok), sum(te_tok[TARGET]==0), m_lr_tok),
        ("Random Forest", "Token", "USDT+USDC", len(te_tok), sum(te_tok[TARGET]==0), m_rf_tok),
        ("Logistic Regression", "Fallback", "All Domains", len(te_all), sum(te_all[TARGET]==0), m_lr_gen),
        ("Random Forest", "Fallback", "All Domains", len(te_all), sum(te_all[TARGET]==0), m_rf_gen),
    ]

    for model, m_type, dom, n_te, n_f, m in runs:
        auc_str = f"{m['roc_auc']:.4f}" if m['roc_auc'] is not None else "N/A"
        results_table.append({
            "Model": model,
            "Domain": f"{m_type} ({dom})",
            "Test Failures": n_f,
            "Failure Recall": f"{m['rec_fail']:.4f}",
            "Failure Precision": f"{m['prec_fail']:.4f}",
            "Accuracy": f"{m['acc']:.4f}",
            "ROC-AUC": auc_str,
            "FN": m["fn"],
            "FP": m["fp"],
        })

    table_df = pd.DataFrame(results_table)
    print("\n" + "=" * 70)
    print("CONCISE DOMAIN-AWARE ARCHITECTURE COMPARISON TABLE")
    print("=" * 70)
    print(table_df.to_string(index=False))

    table_df.to_csv(OUT_DIR / "domain_models_comparison.csv", index=False)
    print(f"\nResults saved under: {OUT_DIR / 'domain_models_comparison.csv'}")


if __name__ == "__main__":
    main()
