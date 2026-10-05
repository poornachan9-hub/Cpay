import json
import sys
from pathlib import Path

import joblib
import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = SCRIPT_DIR / "model-artifacts"
CREDIT_FEATURES = [
    "credit_limit",
    "age",
    "latest_payment_status",
    "average_prior_payment_status",
    "average_bill_amount",
    "average_payment_amount",
]
SYNTHETIC_CUSTOM_FEATURES = [
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


def write_message(message):
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


try:
    synthetic_dir = ARTIFACT_DIR / "synthetic_custom_loan_risk"
    synthetic_model_path = synthetic_dir / "synthetic_custom_loan_model.joblib"
    if synthetic_model_path.exists():
        feature_columns = json.loads((synthetic_dir / "synthetic_custom_loan_feature_columns.json").read_text(encoding="utf-8"))
        metrics = json.loads((synthetic_dir / "synthetic_custom_loan_metrics.json").read_text(encoding="utf-8")) if (synthetic_dir / "synthetic_custom_loan_metrics.json").exists() else {}
        model = joblib.load(synthetic_model_path)
        model_version = metrics.get("model_version", "synthetic-custom-loan-xgb-v1")
        decision_threshold = float(metrics.get("decision_threshold", 0.5))
        active_features = feature_columns
    else:
        model = joblib.load(ARTIFACT_DIR / "credit_default_model.joblib")
        metrics_path = ARTIFACT_DIR / "credit_default_metrics.json"
        metrics = json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.exists() else {}
        model_version = metrics.get("model_version", "uci-credit-default-xgboost-v1")
        decision_threshold = float(metrics.get("decision_threshold", 0.5))
        active_features = CREDIT_FEATURES
    write_message({"ready": True, "model_version": model_version})
except Exception as error:
    write_message({"ready": False, "error": str(error)})
    sys.exit(1)


for line in sys.stdin:
    try:
        features = json.loads(line)
        if set(SYNTHETIC_CUSTOM_FEATURES).issubset(set(features.keys())):
            feature_names = SYNTHETIC_CUSTOM_FEATURES
        else:
            feature_names = CREDIT_FEATURES

        row = pd.DataFrame([[features[name] for name in feature_names]], columns=feature_names)
        probability = float(model.predict_proba(row)[0][1])
        write_message(
            {
                "default_probability": probability,
                "predicted_outcome": "default" if probability >= decision_threshold else "no_default",
                "model_version": model_version,
                "decision_threshold": decision_threshold,
            }
        )
    except Exception as error:
        write_message({"error": str(error)})