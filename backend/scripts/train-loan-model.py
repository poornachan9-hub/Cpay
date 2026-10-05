import argparse
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, average_precision_score, balanced_accuracy_score, confusion_matrix, f1_score, precision_recall_curve, precision_score, recall_score
from xgboost import XGBClassifier
from loan_model import FEATURES as INSTALLMENT_FEATURES, TARGET, load_installments, prepare_installments, split_by_borrower


SCRIPT_DIR = Path(__file__).resolve().parent
def main():
    parser = argparse.ArgumentParser(
        description="Train and evaluate installment punctuality on Home Credit data"
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=SCRIPT_DIR / "data" / "home-credit" / "installments_payments.csv",
        help="Path to Kaggle Home Credit installments_payments.csv",
    )
    args = parser.parse_args()
    installments = load_installments(args.csv)
    data = prepare_installments(installments)
    train, validation, test = split_by_borrower(data)

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
        scale_pos_weight=float(
            (train[TARGET] == 0).sum() / max(1, (train[TARGET] == 1).sum())
        ),
    )
    model.fit(train[INSTALLMENT_FEATURES], train[TARGET])

    validation_probabilities = model.predict_proba(validation[INSTALLMENT_FEATURES])[:, 1]
    validation_precision, validation_recall, validation_thresholds = precision_recall_curve(
        validation[TARGET], validation_probabilities
    )
    validation_f1 = (
        2 * validation_precision[:-1] * validation_recall[:-1]
        / (validation_precision[:-1] + validation_recall[:-1] + 1e-12)
    )
    decision_threshold = float(validation_thresholds[np.argmax(validation_f1)])

    probabilities = model.predict_proba(test[INSTALLMENT_FEATURES])[:, 1]
    predictions = (probabilities >= decision_threshold).astype(int)
    majority_class = int(train[TARGET].mode().iloc[0])
    baseline_predictions = np.full(len(test), majority_class)
    true_on_time, false_late, false_on_time, true_late = confusion_matrix(
        test[TARGET], predictions, labels=[0, 1]
    ).ravel()

    metrics = {
        "model_version": "home-credit-installment-xgboost-v1",
        "dataset": "Home Credit Default Risk / installments_payments.csv",
        "target": "late_or_missed installment (1) vs on-time installment (0)",
        "accuracy": float(accuracy_score(test[TARGET], predictions)),
        "precision_late_or_missed": float(
            precision_score(test[TARGET], predictions, zero_division=0)
        ),
        "recall_late_or_missed": float(
            recall_score(test[TARGET], predictions, zero_division=0)
        ),
        "f1_late_or_missed": float(f1_score(test[TARGET], predictions, zero_division=0)),
        "macro_f1": float(f1_score(test[TARGET], predictions, average="macro", zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(test[TARGET], predictions)),
        "pr_auc": float(average_precision_score(test[TARGET], probabilities)),
        "decision_threshold": decision_threshold,
        "training_records": int(len(train)),
        "validation_records": int(len(validation)),
        "test_records": int(len(test)),
        "training_borrowers": int(train["borrower_id"].nunique()),
        "validation_borrowers": int(validation["borrower_id"].nunique()),
        "test_borrowers": int(test["borrower_id"].nunique()),
        "test_class_counts": {
            "on_time": int((test[TARGET] == 0).sum()),
            "late_or_missed": int((test[TARGET] == 1).sum()),
        },
        "majority_baseline_accuracy": float(
            accuracy_score(test[TARGET], baseline_predictions)
        ),
        "majority_baseline_macro_f1": float(
            f1_score(test[TARGET], baseline_predictions, average="macro", zero_division=0)
        ),
        "limitations": "Research benchmark only; Home Credit borrowers are not CryptoPay or Polygon users.",
    }

    artifact_directory = SCRIPT_DIR / "model-artifacts"
    artifact_directory.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, artifact_directory / "loan_installment_model.joblib")
    (artifact_directory / "loan_metrics.json").write_text(
        json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
    )
    (artifact_directory / "loan_confusion_matrix.json").write_text(
        json.dumps(
            {
                "labels": {"0": "on_time", "1": "late_or_missed"},
                "true_on_time_predicted_on_time": int(true_on_time),
                "true_on_time_predicted_late_or_missed": int(false_late),
                "true_late_or_missed_predicted_on_time": int(false_on_time),
                "true_late_or_missed_predicted_late_or_missed": int(true_late),
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
            zip(INSTALLMENT_FEATURES, model.feature_importances_.tolist()),
            key=lambda item: item[1],
            reverse=True,
        )
    ]
    (artifact_directory / "loan_feature_importance.json").write_text(
        json.dumps(feature_importance, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()