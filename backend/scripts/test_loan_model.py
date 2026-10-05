import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd

from loan_model import FEATURES, TARGET, load_installments, prepare_installments, split_by_borrower


def installment_rows(borrower_count=20):
    rows = []
    for borrower_id in range(borrower_count):
        for installment_number in range(4):
            due_day = -400 + installment_number * 30
            late = installment_number % 2 == 1
            rows.append(
                {
                    "borrower_id": borrower_id,
                    "credit_id": borrower_id * 10,
                    "installment_number": installment_number + 1,
                    "due_day": due_day,
                    "amount_due": 100.0,
                    "amount_paid": 50.0 if late else 100.0,
                    "latest_payment_day": due_day + 5 if late else due_day,
                }
            )
    return pd.DataFrame(rows)


class LoanModelTests(unittest.TestCase):
    def test_csv_loader_groups_partial_payments_by_installment(self):
        raw_rows = pd.DataFrame(
            [
                [1, 10, 1, -30, 100.0, 40.0, -29],
                [1, 10, 1, -30, 100.0, 60.0, -25],
                [1, 10, 2, -10, 100.0, 100.0, -10],
            ],
            columns=[
                "SK_ID_CURR",
                "SK_ID_PREV",
                "NUM_INSTALMENT_NUMBER",
                "DAYS_INSTALMENT",
                "AMT_INSTALMENT",
                "AMT_PAYMENT",
                "DAYS_ENTRY_PAYMENT",
            ],
        )
        with TemporaryDirectory() as directory:
            csv_path = Path(directory) / "installments.csv"
            raw_rows.to_csv(csv_path, index=False)
            loaded = load_installments(csv_path)

        self.assertEqual(len(loaded), 2)
        first = loaded.iloc[0]
        self.assertEqual(first["amount_due"], 100.0)
        self.assertEqual(first["amount_paid"], 100.0)
        self.assertEqual(first["latest_payment_day"], -25)
        prepared = prepare_installments(loaded)
        self.assertEqual(prepared[TARGET].tolist(), [1, 0])

    def test_features_use_only_prior_installment_outcomes(self):
        frame = prepare_installments(installment_rows(borrower_count=1))
        self.assertEqual(frame[TARGET].tolist(), [0, 1, 0, 1])
        self.assertEqual(frame["prior_installment_count"].tolist(), [0, 1, 2, 3])
        self.assertEqual(frame["prior_late_count"].tolist(), [0, 0, 1, 1])
        for actual, expected in zip(frame["prior_on_time_rate"], [1.0, 1.0, 0.5, 2 / 3]):
            self.assertAlmostEqual(actual, expected)
        self.assertEqual(list(frame[FEATURES].columns), FEATURES)

    def test_same_day_installments_do_not_leak_outcomes_between_them(self):
        rows = installment_rows(borrower_count=1).iloc[:2].copy()
        rows.loc[1, "due_day"] = rows.loc[0, "due_day"]
        frame = prepare_installments(rows)
        self.assertEqual(frame["prior_installment_count"].tolist(), [0, 0])
        self.assertEqual(frame["prior_late_count"].tolist(), [0, 0])

    def test_split_keeps_each_borrower_in_one_partition(self):
        frame = prepare_installments(installment_rows())
        train, validation, test = split_by_borrower(frame)
        group_sets = [set(part["borrower_id"]) for part in (train, validation, test)]

        self.assertFalse(group_sets[0] & group_sets[1])
        self.assertFalse(group_sets[0] & group_sets[2])
        self.assertFalse(group_sets[1] & group_sets[2])
        self.assertEqual(sum(map(len, (train, validation, test))), len(frame))

    def test_rejects_missing_required_source_columns(self):
        with self.assertRaisesRegex(ValueError, "Missing installment columns"):
            prepare_installments(pd.DataFrame({"borrower_id": [1]}))


if __name__ == "__main__":
    unittest.main()