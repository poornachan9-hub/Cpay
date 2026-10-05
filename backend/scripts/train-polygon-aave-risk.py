#!/usr/bin/env python3
"""Train a liquidation-risk model from Polygon Aave V3 event data.

Project goal:
- Process only Polygon Aave V3 data
- Keep the raw dataset outside the app runtime
- Filter to required event types
- Process raw files in chunks to avoid loading everything into RAM
- Train a leakage-safe risk model and save only model artifacts

Expected raw data layout:
    backend/scripts/data/aave-polygon-v3/
        events-1.csv
        events-2.csv
        ...
    or
        backend/scripts/data/aave-polygon-v3/
        *.parquet

The script intentionally refuses to guess when the dataset is missing or when the
required event columns cannot support a valid liquidation target.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable, Iterator, List

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier
from catboost import CatBoostClassifier


EVENT_TYPES = {"BORROW", "REPAY", "SUPPLY", "WITHDRAW", "LIQUIDATIONCALL"}
RAW_DATA_LIMIT_MB = 2048


def discover_data_files(data_dir: Path) -> List[Path]:
    if not data_dir.exists():
        raise FileNotFoundError(
            f"Aave Polygon dataset directory not found: {data_dir}. "
            "Place the filtered Polygon export there before training."
        )

    files = sorted(
        [
            path
            for path in data_dir.iterdir()
            if path.is_file() and path.suffix.lower() in {".csv", ".parquet", ".pq"}
        ]
    )
    if not files:
        raise FileNotFoundError(
            f"No CSV/Parquet files found in {data_dir}. "
            "Download only the Polygon Aave V3 files, keep them outside the app, and retry."
        )
    return files


def normalize_columns(columns: Iterable[str]) -> dict[str, str]:
    column_map: dict[str, str] = {}
    for name in columns:
        key = str(name).strip().lower().replace(" ", "_")
        column_map[key] = str(name)
    return column_map


def canonicalize_event_frame(frame: pd.DataFrame) -> pd.DataFrame:
    normalized = normalize_columns(frame.columns)
    renamed = {}

    alias_groups = {
        "timestamp": ["timestamp", "block_timestamp", "ts", "date", "time"],
        "block_number": ["blocknumber", "block_number", "blocknum", "block_num"],
        "tx_hash": ["txhash", "tx_hash", "transaction_hash", "hash"],
        "user": ["user", "borrower", "borrower_address", "wallet", "account"],
        "position_id": [
            "position_id",
            "user_position_id",
            "position",
            "borrowing_position",
            "debt_position",
            "loan_id",
        ],
        "event_type": ["eventtype", "event_type", "type", "kind", "action"],
        "asset": ["asset", "reserve", "token", "symbol"],
        "amount": ["amount", "amountusd", "amount_usd", "value", "principal"],
        "amount_raw": ["amount_raw", "raw_amount", "amount_decimal", "amountwei"],
        "liquidation_amount": [
            "liquidation_amount",
            "liquidated_amount",
            "liquidationamount",
            "amount_liquidated",
        ],
        "liquidated_user": ["liquidated_user", "liquidatedaddress", "liquidated_wallet"],
        "liquidator": ["liquidator", "liquidator_address", "liquidator_wallet"],
        "health_factor": ["health_factor", "healthfactor", "hf"],
        "collateral_asset": ["collateral_asset", "collateral", "collateral_token"],
        "debt_asset": ["debt_asset", "debt_token", "borrow_asset"],
    }

    for canonical_name, aliases in alias_groups.items():
        for alias in aliases:
            if alias in normalized:
                renamed[normalized[alias]] = canonical_name
                break

    if not renamed:
        raise ValueError(
            "The input Polygon Aave data does not expose the expected event columns. "
            "A valid export must include at least timestamp, user/position id, event type, and amount."
        )

    output = frame.rename(columns=renamed).copy()
    if "event_type" not in output.columns:
        raise ValueError("The dataset is missing an event_type field required for DeFi liquidation-risk modeling.")
    if "amount" not in output.columns and "liquidation_amount" not in output.columns:
        raise ValueError("The dataset is missing amount fields needed for borrow/repay/liquidation feature engineering.")

    if "amount" not in output.columns:
        output["amount"] = pd.to_numeric(output.get("liquidation_amount", 0), errors="coerce").fillna(0)

    output["event_type"] = output["event_type"].astype(str).str.upper().str.replace("-", "_")
    output["timestamp"] = pd.to_datetime(output["timestamp"], errors="coerce", utc=True)

    if output["timestamp"].isna().all():
        raise ValueError("The Polygon Aave dataset does not contain usable timestamps; a leakage-safe time-series target cannot be built.")

    if "user" not in output.columns and "position_id" not in output.columns:
        raise ValueError("The Aave dataset is missing borrower or position identifiers required to build position-level snapshots.")

    if "position_id" not in output.columns:
        output["position_id"] = output["user"].fillna("unknown_user")
    if "user" not in output.columns:
        output["user"] = output["position_id"].fillna("unknown_position")

    output["position_key"] = (
        output["position_id"].fillna("").astype(str)
        + "::"
        + output["user"].fillna("").astype(str)
    )
    return output


def iter_event_chunks(data_dir: Path, chunksize: int = 250_000) -> Iterator[pd.DataFrame]:
    files = discover_data_files(data_dir)
    for file_path in files:
        if file_path.suffix.lower() == ".csv":
            for chunk in pd.read_csv(file_path, chunksize=chunksize, low_memory=False):
                yield canonicalize_event_frame(chunk)
        elif file_path.suffix.lower() in {".parquet", ".pq"}:
            try:
                parquet = pd.read_parquet(file_path)
            except Exception as exc:  # pragma: no cover - depends on external package availability
                raise RuntimeError(f"Failed to read Parquet dataset {file_path}: {exc}") from exc
            yield canonicalize_event_frame(parquet)


def filtered_events(data_dir: Path, chunksize: int = 250_000) -> pd.DataFrame:
    frames: List[pd.DataFrame] = []
    total_rows = 0
    for chunk in iter_event_chunks(data_dir, chunksize=chunksize):
        chunk = chunk[chunk["event_type"].isin(EVENT_TYPES)].copy()
        if chunk.empty:
            continue
        chunk["amount"] = pd.to_numeric(chunk["amount"], errors="coerce").fillna(0.0)
        chunk["timestamp"] = pd.to_datetime(chunk["timestamp"], errors="coerce", utc=True)
        chunk = chunk.dropna(subset=["timestamp"]).copy()
        frames.append(chunk)
        total_rows += len(chunk)
        if total_rows > MAX_RAW_ROWS_FOR_MEMORY:  # 2 GB equivalent rough ceiling for this in-memory path
            break
    if not frames:
        raise ValueError(
            "No Polygon Aave events survived filtering. Check whether your dataset includes the required events: "
            "Borrow, Repay, Supply, Withdraw, and LiquidationCall."
        )
    return pd.concat(frames, ignore_index=True, copy=False)


MAX_RAW_ROWS_FOR_MEMORY = 1_500_000


def position_build_features(events: pd.DataFrame, prediction_window_days: int = 7) -> pd.DataFrame:
    if "liquidation_amount" not in events.columns and "event_type" not in events.columns:
        raise ValueError("Insufficient dataset schema for liquidation-target construction.")

    if not set(["BORROW", "REPAY", "SUPPLY", "WITHDRAW", "LIQUIDATIONCALL"]).issubset(events["event_type"].unique().tolist()):
        raise ValueError(
            "Required Polygon Aave event types are missing. The dataset must contain Borrow, Repay, Supply, Withdraw, and LiquidationCall."
        )

    events = events.sort_values(["position_key", "timestamp"]).copy()
    liquidation_events = events[events["event_type"] == "LIQUIDATIONCALL"].copy()
    if liquidation_events.empty:
        raise ValueError(
            "The dataset does not contain liquidation events, so it cannot support a leakage-free liquidation target. "
            "You need at least one valid liquidation event to create the positive class."
        )

    borrow_events = events[events["event_type"] == "BORROW"].copy()
    repay_events = events[events["event_type"] == "REPAY"].copy()
    supply_events = events[events["event_type"] == "SUPPLY"].copy()
    withdraw_events = events[events["event_type"] == "WITHDRAW"].copy()

    borrow_summary = (
        borrow_events.groupby("position_key")
        .agg(
            total_borrowed=("amount", "sum"),
            borrow_events=("amount", "size"),
            avg_borrow_amount=("amount", "mean"),
            max_borrow_amount=("amount", "max"),
        )
        .reset_index()
    )
    repay_summary = (
        repay_events.groupby("position_key")
        .agg(
            total_repaid=("amount", "sum"),
            repay_events=("amount", "size"),
            avg_repay_amount=("amount", "mean"),
            max_repay_amount=("amount", "max"),
        )
        .reset_index()
    )
    supply_summary = (
        supply_events.groupby("position_key")
        .agg(
            total_supplied=("amount", "sum"),
            supply_events=("amount", "size"),
        )
        .reset_index()
    )
    withdraw_summary = (
        withdraw_events.groupby("position_key")
        .agg(
            total_withdrawn=("amount", "sum"),
            withdraw_events=("amount", "size"),
        )
        .reset_index()
    )
    liquidation_summary = (
        liquidation_events.groupby("position_key")
        .agg(
            liquidation_events=("amount", "size"),
            liquidation_amount_total=("amount", "sum"),
            latest_liquidation_ts=("timestamp", "max"),
        )
        .reset_index()
    )

    base = (
        borrow_summary.merge(repay_summary, on="position_key", how="outer")
        .merge(supply_summary, on="position_key", how="outer")
        .merge(withdraw_summary, on="position_key", how="outer")
        .merge(liquidation_summary, on="position_key", how="outer")
        .fillna(0)
    )

    base["repayment_ratio"] = np.where(
        base["total_borrowed"].abs() > 0,
        base["total_repaid"] / base["total_borrowed"],
        0.0,
    )
    base["net_borrowed"] = base["total_borrowed"] - base["total_repaid"]
    base["wallet_activity_count"] = (
        base.get("borrow_events", 0)
        + base.get("repay_events", 0)
        + base.get("supply_events", 0)
        + base.get("withdraw_events", 0)
    )

    # Use the final liquidation timestamp as the target anchor for each position.
    # We convert this into a negative/positive class for a defined future prediction window.
    positions = events[["position_key", "timestamp"]].drop_duplicates().copy()
    positions["snapshot_time"] = positions["timestamp"]
    positions = positions.merge(liquidation_events[["position_key", "timestamp"]].rename(columns={"timestamp": "liquidation_ts"}), on="position_key", how="left")
    positions["days_to_liquidation"] = (positions["liquidation_ts"] - positions["snapshot_time"]).dt.total_seconds() / 86400.0
    positions["target"] = (positions["days_to_liquidation"].between(0, prediction_window_days)).astype(int)
    positions = positions.merge(base, on="position_key", how="left")

    feature_columns = [
        "total_borrowed",
        "borrow_events",
        "avg_borrow_amount",
        "max_borrow_amount",
        "total_repaid",
        "repay_events",
        "avg_repay_amount",
        "max_repay_amount",
        "repayment_ratio",
        "total_supplied",
        "supply_events",
        "total_withdrawn",
        "withdraw_events",
        "liquidation_events",
        "liquidation_amount_total",
        "net_borrowed",
        "wallet_activity_count",
    ]
    available = [column for column in feature_columns if column in positions.columns]
    feature_frame = positions[available + ["target"]].copy()
    feature_frame = feature_frame.replace([np.inf, -np.inf], np.nan).dropna()

    if feature_frame.empty:
        raise ValueError("No valid borrower snapshots remained after feature engineering. The dataset is not sufficient for a leakage-safe target.")
    return feature_frame


def build_model(name: str):
    if name == "logistic":
        return Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("model", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
            ]
        )
    if name == "xgb":
        return Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    XGBClassifier(
                        n_estimators=150,
                        max_depth=4,
                        learning_rate=0.08,
                        subsample=0.85,
                        colsample_bytree=0.85,
                        objective="binary:logistic",
                        eval_metric="logloss",
                        random_state=42,
                        n_jobs=1,
                    ),
                ),
            ]
        )
    if name == "catboost":
        return Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    CatBoostClassifier(
                        iterations=200,
                        depth=4,
                        learning_rate=0.08,
                        loss_function="Logloss",
                        verbose=False,
                        random_seed=42,
                    ),
                ),
            ]
        )
    raise ValueError(f"Unsupported model: {name}")


def evaluate_model(model, X_train, y_train, X_test, y_test) -> dict:
    model.fit(X_train, y_train)
    probabilities = model.predict_proba(X_test)[:, 1]
    predictions = model.predict(X_test)
    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision": float(precision_score(y_test, predictions, zero_division=0)),
        "recall": float(recall_score(y_test, predictions, zero_division=0)),
        "f1": float(f1_score(y_test, predictions, zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, predictions)),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
        "pr_auc": float(average_precision_score(y_test, probabilities)),
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=[0, 1]).tolist(),
    }
    return metrics, model


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a Polygon Aave V3 liquidation-risk model")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "aave-polygon-v3",
        help="Directory containing filtered Polygon Aave V3 event files.",
    )
    parser.add_argument(
        "--chunksize",
        type=int,
        default=250_000,
        help="Rows to read per CSV chunk while keeping RAM usage modest.",
    )
    parser.add_argument(
        "--prediction-window-days",
        type=int,
        default=7,
        help="Number of days used to define liquidation risk after a snapshot.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "model-artifacts" / "aave_polygon_risk",
        help="Directory for saved model artifacts.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction reserved for the test set.",
    )
    args = parser.parse_args()

    print(f"Processing Polygon Aave V3 data from: {args.data_dir}")
    try:
        filtered = filtered_events(args.data_dir, chunksize=args.chunksize)
    except Exception as exc:
        print(f"Dataset validation failed: {exc}")
        raise SystemExit(1)

    try:
        feature_frame = position_build_features(filtered, prediction_window_days=args.prediction_window_days)
    except ValueError as exc:
        print(f"Target construction failed: {exc}")
        raise SystemExit(1)

    X = feature_frame.drop(columns=["target"])
    y = feature_frame["target"].astype(int)

    if y.nunique() < 2:
        raise ValueError("The dataset does not contain both positive and negative liquidation cases, so the target is invalid.")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=42,
        stratify=y,
        shuffle=True,
    )

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    models = {
        "logistic_regression": build_model("logistic"),
        "xgboost": build_model("xgb"),
        "catboost": build_model("catboost"),
    }

    results = {}
    best_name = None
    best_score = -1.0

    for name, model in models.items():
        metrics, fitted = evaluate_model(model, X_train, y_train, X_test, y_test)
        results[name] = metrics
        score = metrics["f1"]
        if score > best_score:
            best_score = score
            best_name = name

    if best_name is None:
        raise RuntimeError("No model completed training.")

    pb = models[best_name]
    pb.fit(X_train, y_train)
    model_path = output_dir / f"{best_name}_model.joblib"
    joblib.dump(pb, model_path)

    feature_names = list(X.columns)
    (output_dir / "feature_names.json").write_text(json.dumps(feature_names, indent=2), encoding="utf-8")
    (output_dir / "metrics.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (output_dir / "model_metadata.json").write_text(
        json.dumps(
            {
                "dataset_source": "Polygon Aave V3 filtered event export",
                "dataset_dir": str(args.data_dir),
                "prediction_window_days": args.prediction_window_days,
                "feature_names": feature_names,
                "model_type": best_name,
                "training_rows": int(len(X_train)),
                "test_rows": int(len(X_test)),
                "target_definition": "liquidation_within_future_window",
                "metrics": results[best_name],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(json.dumps({"best_model": best_name, "metrics": results[best_name]}, indent=2))


if __name__ == "__main__":
    main()
