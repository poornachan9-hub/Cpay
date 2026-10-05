import argparse
import json
from pathlib import Path
from urllib.request import urlretrieve

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier


SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PATH = SCRIPT_DIR / "data" / "uci-credit-default" / "data.csv"
DATA_URL = "https://archive.ics.uci.edu/static/public/350/data.csv"
FEATURES = [
    "credit_limit",
    "age",
    "latest_payment_status",
    "average_prior_payment_status",
    "average_bill_amount",
    "average_payment_amount",
]


def load_credit_default_data(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        urlretrieve(DATA_URL, csv_path)

    source = pd.read_csv(csv_path)
    required_columns = ["X1", "X5", *[f"X{column}" for column in range(6, 24)], "Y"]
    missing_columns = sorted(set(required_columns).difference(source.columns))
    if missing_columns:
        raise ValueError(f"UCI dataset is missing columns: {', '.join(missing_columns)}")

    frame = pd.DataFrame(
        {
            "credit_limit": source["X1"],
            "age": source["X5"],
            "latest_payment_status": source["X6"],
            "average_prior_payment_status": source[
                [f"X{column}" for column in range(7, 12)]
            ].mean(axis=1),
            "average_bill_amount": source[
                [f"X{column}" for column in range(12, 18)]
            ].mean(axis=1),
            "average_payment_amount": source[
                [f"X{column}" for column in range(18, 24)]
            ].mean(axis=1),
            "default": source["Y"],
        }
    )
    if frame.isna().any().any() or not set(frame["default"].unique()).issubset({0, 1}):
        raise ValueError("UCI dataset contains missing values or unexpected target labels")
    return frame


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train a credit-card default research model on the UCI dataset"
    )
    parser.add_argument("--csv", type=Path, default=DATA_PATH)
    args = parser.parse_args()

    data = load_credit_default_data(args.csv)
    development, test = train_test_split(
        data,
        test_size=0.2,
        random_state=42,
        stratify=data["default"],
    )
    train, validation = train_test_split(
        development,
        test_size=0.2,
        random_state=42,
        stratify=development["default"],
    )

    model = XGBClassifier(
        n_estimators=350,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=3.0,
        objective="binary:logistic",
        eval_metric="aucpr",
        random_state=42,
        n_jobs=1,
        scale_pos_weight=float((train["default"] == 0).sum() / (train["default"] == 1).sum()),
    )
    model.fit(train[FEATURES], train["default"])

    validation_probabilities = model.predict_proba(validation[FEATURES])[:, 1]
    validation_precision, validation_recall, thresholds = precision_recall_curve(
        validation["default"], validation_probabilities
    )
    validation_f1 = (
        2 * validation_precision[:-1] * validation_recall[:-1]
        / (validation_precision[:-1] + validation_recall[:-1] + 1e-12)
    )
    decision_threshold = float(thresholds[np.argmax(validation_f1)])

    test_probabilities = model.predict_proba(test[FEATURES])[:, 1]
    predictions = (test_probabilities >= decision_threshold).astype(int)
    true_no_default, false_default, false_no_default, true_default = confusion_matrix(
        test["default"], predictions, labels=[0, 1]
    ).ravel()
    majority_predictions = np.full(len(test), int(train["default"].mode().iloc[0]))
    metrics = {
        "model_version": "uci-credit-default-xgboost-v1",
        "dataset": "UCI Default of Credit Card Clients (DOI: 10.24432/C55S3H)",
        "target": "default payment next month",
        "accuracy": float(accuracy_score(test["default"], predictions)),
        "precision_default": float(precision_score(test["default"], predictions, zero_division=0)),
        "recall_default": float(recall_score(test["default"], predictions, zero_division=0)),
        "f1_default": float(f1_score(test["default"], predictions, zero_division=0)),
        "macro_f1": float(f1_score(test["default"], predictions, average="macro", zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(test["default"], predictions)),
        "pr_auc": float(average_precision_score(test["default"], test_probabilities)),
        "decision_threshold": decision_threshold,
        "training_records": int(len(train)),
        "validation_records": int(len(validation)),
        "test_records": int(len(test)),
        "test_class_counts": {
            "no_default": int((test["default"] == 0).sum()),
            "default": int((test["default"] == 1).sum()),
        },
        "majority_baseline_accuracy": float(
            accuracy_score(test["default"], majority_predictions)
        ),
        "majority_baseline_macro_f1": float(
            f1_score(test["default"], majority_predictions, average="macro", zero_division=0)
        ),
        "limitations": "Research benchmark on Taiwanese credit-card clients; not CryptoPay borrowers or a lending decision tool.",
    }

    artifact_directory = SCRIPT_DIR / "model-artifacts"
    artifact_directory.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, artifact_directory / "credit_default_model.joblib")
    (artifact_directory / "credit_default_metrics.json").write_text(
        json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
    )
    (artifact_directory / "credit_default_confusion_matrix.json").write_text(
        json.dumps(
            {
                "labels": {"0": "no_default", "1": "default"},
                "true_no_default_predicted_no_default": int(true_no_default),
                "true_no_default_predicted_default": int(false_default),
                "true_default_predicted_no_default": int(false_no_default),
                "true_default_predicted_default": int(true_default),
                "test_records": int(len(test)),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    feature_importance = [
        {"feature": feature, "importance": float(importance)}
        for feature, importance in sorted(
            zip(FEATURES, model.feature_importances_.tolist()),
            key=lambda item: item[1],
            reverse=True,
        )
    ]
    (artifact_directory / "credit_default_feature_importance.json").write_text(
        json.dumps(feature_importance, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
