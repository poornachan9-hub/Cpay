#!/usr/bin/env python3
"""Generate a realistic synthetic custom-loan dataset and train multiple local risk models.

This is a fallback path when external Aave/Compound data is unavailable or not
compatible with the project's custom lending flow.

The key design goal is to avoid a deterministic target formula where the label is
created directly from the same features used for prediction. Instead, each loan
receives a latent risk factor and a probabilistic outcome.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover
    XGBClassifier = None

try:
    from catboost import CatBoostClassifier
except Exception:  # pragma: no cover
    CatBoostClassifier = None

FEATURE_COLUMNS = [
    "amount_usdc",
    "collateral_kg",
    "collateral_ratio",
    "term_days",
    "repayment_history_score",
    "days_to_deadline",
    "late_payment_count",
    "previous_repayments",
    "liquidity_buffer",
]
TARGET_COLUMN = "loan_outcome"


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + np.exp(-z))


def generate_dataset(output_path: Path, rows: int = 5000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    records: list[dict[str, Any]] = []

    for _ in range(rows):
        amount_usdc = float(np.clip(rng.lognormal(mean=9.0, sigma=0.85), 200.0, 120000.0))
        collateral_value_usdc = float(np.clip(amount_usdc * rng.uniform(0.9, 4.8), 150.0, 220000.0))
        collateral_kg = float(np.clip(collateral_value_usdc / rng.uniform(12.0, 25.0), 50.0, 18000.0))
        term_days = int(rng.integers(14, 210))
        wallet_age_days = int(rng.integers(30, 1800))
        wallet_tx_count = int(rng.integers(4, 500))
        borrow_frequency = float(rng.beta(2.2, 3.8))
        repayment_frequency = float(rng.beta(2.7, 2.5))
        previous_loans = int(rng.poisson(1.7))
        previous_repaid_loans = int(rng.binomial(previous_loans, max(0.2, min(0.9, rng.beta(3.2, 2.0)))))
        previous_liquidated_loans = int(rng.binomial(max(0, previous_loans - previous_repaid_loans), max(0.05, min(0.6, rng.beta(1.9, 4.5)))))
        previous_default = int(rng.binomial(1, 0.12 + 0.08 * (previous_liquidated_loans > 0)))
        repayment_ratio = float(np.clip(rng.beta(3.5, 2.0), 0.1, 0.98))
        average_repayment_delay_days = float(np.clip(rng.gamma(shape=2.2, scale=4.5), 0.0, 30.0))
        liquidity_buffer = float(np.clip(rng.normal(32.0, 12.0), 1.0, 90.0))
        collateral_volatility = float(np.clip(rng.beta(2.0, 4.5), 0.02, 0.8))
        days_to_deadline = int(rng.integers(-20, term_days + 20))
        late_payment_count = int(rng.poisson(0.5 + max(0.0, (1.0 - repayment_ratio)) * 2.5))
        previous_repayments = float(np.clip(rng.normal(45.0, 30.0), 0.0, 100.0))
        repayment_history_score = float(np.clip(100.0 * repayment_ratio - 18.0 * average_repayment_delay_days + 12.0 * (wallet_age_days / 365.0), 0.0, 100.0))

        collateral_ratio = collateral_value_usdc / max(amount_usdc, 1.0)
        debt_to_collateral_ratio = amount_usdc / max(collateral_value_usdc, 1.0)

        # Latent risk is a realistic, overlapping signal rather than a direct rule.
        latent_risk = (
            1.5 * (1.0 / max(collateral_ratio, 0.25))
            + 1.2 * debt_to_collateral_ratio
            + 1.3 * max(0.0, 1.0 - repayment_ratio)
            + 0.7 * (previous_liquidated_loans / max(previous_loans + 1, 1))
            + 0.9 * previous_default
            + 1.0 * min(1.0, late_payment_count / 5.0)
            + 0.8 * min(1.0, average_repayment_delay_days / 20.0)
            + 0.7 * (1.0 / max(1.0 + wallet_age_days / 365.0, 1.1))
            + 0.6 * collateral_volatility
            + 0.4 * (1.0 / max(1.0 + (wallet_tx_count / 150.0), 1.0))
            + 0.6 * max(0.0, 1.0 - liquidity_buffer / 60.0)
            + rng.normal(0.0, 0.55)
        )
        base_probability = sigmoid(-2.3 + 0.6 * latent_risk)

        # Keep the problem overlapping so the model must learn patterns instead of
        # simply inverting a handcrafted formula.
        outcome_probability = float(np.clip(base_probability, 0.02, 0.94))
        default_flag = int(rng.binomial(1, outcome_probability))

        records.append(
            {
                "amount_usdc": round(amount_usdc, 2),
                "collateral_kg": round(collateral_kg, 2),
                "collateral_ratio": round(collateral_ratio, 6),
                "term_days": term_days,
                "repayment_history_score": round(repayment_history_score, 4),
                "days_to_deadline": days_to_deadline,
                "late_payment_count": late_payment_count,
                "previous_repayments": round(previous_repayments, 4),
                "liquidity_buffer": round(liquidity_buffer, 4),
                "loan_outcome": default_flag,
                "default_flag": default_flag,
                "outcome_probability": round(outcome_probability, 6),
                "latent_risk": round(latent_risk, 6),
            }
        )

    frame = pd.DataFrame(records)
    frame = frame.drop_duplicates(subset=FEATURE_COLUMNS + [TARGET_COLUMN]).reset_index(drop=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)
    return frame


def build_model_specs() -> list[dict[str, Any]]:
    models: list[dict[str, Any]] = [
        {
            "name": "dummy",
            "estimator": Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="median")),
                    ("model", DummyClassifier(strategy="stratified")),
                ]
            ),
        }
    ]

    models.append(
        {
            "name": "logistic_regression",
            "estimator": Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="median")),
                    ("model", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
                ]
            ),
        }
    )

    models.append(
        {
            "name": "random_forest",
            "estimator": Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="median")),
                    (
                        "model",
                        RandomForestClassifier(
                            n_estimators=400,
                            random_state=42,
                            min_samples_leaf=2,
                            class_weight="balanced",
                            n_jobs=-1,
                        ),
                    ),
                ]
            ),
        }
    )

    if XGBClassifier is not None:
        models.append(
            {
                "name": "xgboost",
                "estimator": Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        (
                            "model",
                            XGBClassifier(
                                n_estimators=400,
                                max_depth=4,
                                learning_rate=0.06,
                                subsample=0.9,
                                colsample_bytree=0.9,
                                objective="binary:logistic",
                                eval_metric="logloss",
                                random_state=42,
                                n_jobs=1,
                            ),
                        ),
                    ]
                ),
            }
        )

    if CatBoostClassifier is not None:
        models.append(
            {
                "name": "catboost",
                "estimator": Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        (
                            "model",
                            CatBoostClassifier(
                                loss_function="Logloss",
                                verbose=False,
                                random_seed=42,
                                depth=6,
                                learning_rate=0.08,
                                iterations=500,
                            ),
                        ),
                    ]
                ),
            }
        )

    return models


def compute_metrics(y_true: pd.Series, y_pred: np.ndarray, probabilities: np.ndarray) -> dict[str, float]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).astype(int).tolist(),
    }


def prepare_data(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    X = frame[FEATURE_COLUMNS].copy()
    y = frame[TARGET_COLUMN].astype(int)
    return X, y


def evaluate_models(frame: pd.DataFrame, output_dir: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    X, y = prepare_data(frame)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    model_reports: list[dict[str, Any]] = []
    test_metrics: dict[str, dict[str, Any]] = {}
    selected_model_name = ""
    selected_model = None
    selected_summary = None

    for model_spec in build_model_specs():
        name = model_spec["name"]
        estimator = model_spec["estimator"]

        # 5-fold cross-validation
        cv_results = cross_validate(
            estimator,
            X,
            y,
            cv=cv,
            scoring={
                "accuracy": "accuracy",
                "precision": "precision",
                "recall": "recall",
                "f1": "f1",
                "roc_auc": "roc_auc",
            },
            n_jobs=None,
            return_train_score=True,
        )

        cv_summary = {
            "mean_accuracy": float(np.mean(cv_results["test_accuracy"])),
            "std_accuracy": float(np.std(cv_results["test_accuracy"])),
            "mean_precision": float(np.mean(cv_results["test_precision"])),
            "mean_recall": float(np.mean(cv_results["test_recall"])),
            "mean_f1": float(np.mean(cv_results["test_f1"])),
            "mean_roc_auc": float(np.mean(cv_results["test_roc_auc"])),
            "train_accuracy": float(np.mean(cv_results["train_accuracy"])),
        }

        estimator.fit(X_train, y_train)
        probabilities = estimator.predict_proba(X_test)[:, 1]
        predictions = (probabilities >= 0.5).astype(int)
        metrics = compute_metrics(y_test, predictions, probabilities)
        test_metrics[name] = metrics

        model_reports.append(
            {
                "model": name,
                "cross_validation": cv_summary,
                "test": metrics,
            }
        )

        if selected_model is None:
            selected_model = clone(estimator)
            selected_model_name = name
            selected_summary = metrics
        else:
            candidate_score = metrics["roc_auc"] + metrics["f1"]
            current_score = selected_summary["roc_auc"] + selected_summary["f1"]
            if candidate_score > current_score:
                selected_model = clone(estimator)
                selected_model_name = name
                selected_summary = metrics

    selected_model.fit(X_train, y_train)
    final_probability = selected_model.predict_proba(X_test)[:, 1]
    final_prediction = (final_probability >= 0.5).astype(int)
    final_metrics = compute_metrics(y_test, final_prediction, final_probability)

    model_object = selected_model.named_steps["model"]
    if hasattr(model_object, "feature_importances_"):
        importances = np.asarray(model_object.feature_importances_)
    elif hasattr(model_object, "coef_"):
        importances = np.abs(np.asarray(model_object.coef_)).ravel()
    else:
        importances = np.zeros(len(FEATURE_COLUMNS), dtype=float)

    feature_importance = (
        pd.DataFrame({"feature": FEATURE_COLUMNS, "importance": importances})
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    selected_model_path = output_dir / "synthetic_custom_loan_model.joblib"
    joblib.dump(selected_model, selected_model_path)

    (output_dir / "synthetic_custom_loan_feature_columns.json").write_text(
        json.dumps(FEATURE_COLUMNS, indent=2), encoding="utf-8"
    )
    (output_dir / "synthetic_custom_loan_model_metadata.json").write_text(
        json.dumps(
            {
                "model_name": selected_model_name,
                "target_column": TARGET_COLUMN,
                "feature_columns": FEATURE_COLUMNS,
                "dataset_rows": int(len(frame)),
                "train_rows": int(len(X_train)),
                "test_rows": int(len(X_test)),
                "split_seed": 42,
                "generation_note": "Synthetic simulated loan scenarios; not real-world borrower performance.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    metrics_payload = {
        "model_name": selected_model_name,
        "model_version": "synthetic-custom-loan-v2",
        "decision_threshold": 0.5,
        "accuracy": float(final_metrics["accuracy"]),
        "precision": float(final_metrics["precision"]),
        "recall": float(final_metrics["recall"]),
        "f1": float(final_metrics["f1"]),
        "roc_auc": float(final_metrics["roc_auc"]),
        "balanced_accuracy": float(final_metrics["balanced_accuracy"]),
        "confusion_matrix": final_metrics["confusion_matrix"],
        "total_rows": int(len(frame)),
        "positive_rate": float(y.mean()),
        "training_vs_test": {
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
        },
        "synthetic_disclaimer": "Model trained and evaluated on synthetically generated loan scenarios. Metrics are for demonstration and benchmarking only and do not represent real-world borrower performance.",
    }
    (output_dir / "synthetic_custom_loan_metrics.json").write_text(json.dumps(metrics_payload, indent=2), encoding="utf-8")

    summary_report = {
        "dataset_summary": {
            "rows": int(len(frame)),
            "positive_rate": float(y.mean()),
            "negative_rate": float(1.0 - y.mean()),
            "features": FEATURE_COLUMNS,
        },
        "cross_validation": {entry["model"]: entry["cross_validation"] for entry in model_reports},
        "test_metrics": {entry["model"]: entry["test"] for entry in model_reports},
        "selected_model": {
            "model_name": selected_model_name,
            "metrics": final_metrics,
        },
    }
    (output_dir / "synthetic_custom_loan_summary.json").write_text(json.dumps(summary_report, indent=2), encoding="utf-8")
    (output_dir / "synthetic_custom_loan_feature_importance.json").write_text(
        json.dumps(feature_importance.to_dict(orient="records"), indent=2), encoding="utf-8"
    )
    summary_report["selected_model"]["feature_importance"] = feature_importance.to_dict(orient="records")
    (output_dir / "synthetic_custom_loan_summary.json").write_text(json.dumps(summary_report, indent=2), encoding="utf-8")

    return metrics_payload, summary_report, model_reports


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a realistic synthetic custom-loan dataset and train multiple models.")
    parser.add_argument("--rows", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--data-path",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "synthetic-custom-loan" / "custom_loan_risk.csv",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "model-artifacts" / "synthetic_custom_loan_risk",
    )
    args = parser.parse_args()

    frame = generate_dataset(output_path=args.data_path, rows=args.rows, seed=args.seed)
    metrics, summary, _ = evaluate_models(frame, output_dir=args.output_dir)
    print(json.dumps({"selected_model": metrics["model_name"], "metrics": {k: metrics[k] for k in ["accuracy", "precision", "recall", "f1", "roc_auc", "balanced_accuracy", "positive_rate"]}}, indent=2))
    print(json.dumps({"dataset_summary": summary["dataset_summary"]}, indent=2))


if __name__ == "__main__":
    main()
