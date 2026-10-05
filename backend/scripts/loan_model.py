from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit


FEATURES = [
    "installment_number",
    "amount_due",
    "prior_installment_count",
    "prior_late_count",
    "prior_on_time_rate",
    "prior_mean_late_days",
]
TARGET = "late_or_missed"


def load_installments(csv_path: Path) -> pd.DataFrame:
    import duckdb

    connection = duckdb.connect(database=":memory:")
    try:
        return connection.execute(
            """
            SELECT
                SK_ID_CURR AS borrower_id,
                SK_ID_PREV AS credit_id,
                NUM_INSTALMENT_NUMBER AS installment_number,
                DAYS_INSTALMENT AS due_day,
                MAX(AMT_INSTALMENT) AS amount_due,
                COALESCE(SUM(AMT_PAYMENT), 0) AS amount_paid,
                MAX(DAYS_ENTRY_PAYMENT) AS latest_payment_day
            FROM read_csv_auto(?, header = true, sample_size = 50000)
            WHERE DAYS_INSTALMENT <= 0
            GROUP BY borrower_id, credit_id, installment_number, due_day
            HAVING MAX(AMT_INSTALMENT) > 0
            ORDER BY borrower_id, due_day, credit_id, installment_number
            """,
            [str(Path(csv_path).resolve())],
        ).fetchdf()
    finally:
        connection.close()


def prepare_installments(installments: pd.DataFrame) -> pd.DataFrame:
    required = {
        "borrower_id",
        "credit_id",
        "installment_number",
        "due_day",
        "amount_due",
        "amount_paid",
        "latest_payment_day",
    }
    missing = required.difference(installments.columns)
    if missing:
        raise ValueError(f"Missing installment columns: {', '.join(sorted(missing))}")

    frame = installments.copy()
    numeric_columns = [
        "installment_number",
        "due_day",
        "amount_due",
        "amount_paid",
        "latest_payment_day",
    ]
    frame[numeric_columns] = frame[numeric_columns].apply(pd.to_numeric, errors="coerce")
    frame = frame.dropna(subset=["borrower_id", "credit_id", "installment_number", "due_day", "amount_due"])
    frame = frame[(frame["due_day"] <= 0) & (frame["amount_due"] > 0)]
    frame["amount_paid"] = frame["amount_paid"].fillna(0).clip(lower=0)

    underpaid = frame["amount_paid"] + 0.01 < frame["amount_due"]
    paid_late = frame["latest_payment_day"] > frame["due_day"]
    frame[TARGET] = (underpaid | paid_late.fillna(False)).astype("int8")
    date_lateness = (frame["latest_payment_day"] - frame["due_day"]).clip(lower=0, upper=90)
    frame["late_days"] = np.where(
        frame[TARGET].eq(0), 0, np.where(underpaid, 90, date_lateness.fillna(90))
    )

    frame = frame.sort_values(
        ["borrower_id", "due_day", "credit_id", "installment_number"], kind="stable"
    ).reset_index(drop=True)
    daily_history = (
        frame.groupby(["borrower_id", "due_day"], sort=False)
        .agg(
            day_installment_count=(TARGET, "size"),
            day_late_count=(TARGET, "sum"),
            day_late_days=("late_days", "sum"),
        )
        .reset_index()
        .sort_values(["borrower_id", "due_day"], kind="stable")
    )
    daily_groups = daily_history.groupby("borrower_id", sort=False)
    daily_history["prior_installment_count"] = (
        daily_groups["day_installment_count"].cumsum() - daily_history["day_installment_count"]
    )
    daily_history["prior_late_count"] = (
        daily_groups["day_late_count"].cumsum() - daily_history["day_late_count"]
    )
    daily_history["prior_late_days"] = (
        daily_groups["day_late_days"].cumsum() - daily_history["day_late_days"]
    )
    frame = frame.merge(
        daily_history[
            [
                "borrower_id",
                "due_day",
                "prior_installment_count",
                "prior_late_count",
                "prior_late_days",
            ]
        ],
        on=["borrower_id", "due_day"],
        how="left",
        validate="many_to_one",
        sort=False,
    )
    frame["prior_on_time_rate"] = np.where(
        frame["prior_installment_count"] > 0,
        1 - frame["prior_late_count"] / frame["prior_installment_count"].clip(lower=1),
        1.0,
    )
    frame["prior_mean_late_days"] = np.where(
        frame["prior_installment_count"] > 0,
        frame["prior_late_days"] / frame["prior_installment_count"].clip(lower=1),
        0.0,
    )

    return frame[["borrower_id", *FEATURES, TARGET]].replace([np.inf, -np.inf], np.nan).dropna()


def split_by_borrower(frame: pd.DataFrame, random_state: int = 42):
    if frame["borrower_id"].nunique() < 3:
        raise ValueError("At least three distinct borrowers are required for grouped evaluation")

    outer_split = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=random_state)
    train_validation_indices, test_indices = next(
        outer_split.split(frame, frame[TARGET], frame["borrower_id"])
    )
    train_validation = frame.iloc[train_validation_indices]
    test = frame.iloc[test_indices]

    inner_split = GroupShuffleSplit(n_splits=1, test_size=0.15 / 0.85, random_state=random_state)
    train_indices, validation_indices = next(
        inner_split.split(train_validation, train_validation[TARGET], train_validation["borrower_id"])
    )
    train = train_validation.iloc[train_indices]
    validation = train_validation.iloc[validation_indices]

    group_sets = [set(part["borrower_id"]) for part in (train, validation, test)]
    if any(group_sets[left] & group_sets[right] for left in range(3) for right in range(left + 1, 3)):
        raise RuntimeError("Borrower leakage detected across train, validation, and test splits")
    if any(part[TARGET].nunique() < 2 for part in (train, validation, test)):
        raise ValueError("Each grouped split must contain both on-time and late/missed installments")

    return train, validation, test