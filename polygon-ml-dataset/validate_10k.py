"""
Read-only validation of polygon_transactions_10000.csv.
Does NOT modify the CSV or the 1,000-row baseline.
Prints a full data quality report.
"""

import sys
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
TARGET_CSV  = SCRIPT_DIR / "data" / "polygon_transactions_10000.csv"
BASELINE_CSV = SCRIPT_DIR / "data" / "polygon_transactions.csv"

SEP = "=" * 60

def section(title):
    print("\n" + SEP + "\n" + title + "\n" + SEP)

# ── Confirm baseline is untouched ──────────────────────────────────────────────
section("BASELINE INTEGRITY CHECK")
if BASELINE_CSV.exists():
    base = pd.read_csv(BASELINE_CSV)
    print(f"Baseline CSV         : {BASELINE_CSV}")
    print(f"Baseline rows        : {len(base)}")
    print(f"Baseline duplicates  : {base.duplicated().sum()}")
    print(f"Baseline tx dups     : {base['tx_hash'].duplicated().sum()}")
    print("Baseline is INTACT -- untouched by 10k collection.")
else:
    print(f"WARNING: Baseline not found at {BASELINE_CSV}")

# ── Load 10k CSV ───────────────────────────────────────────────────────────────
section("10K DATASET VALIDATION")

if not TARGET_CSV.exists():
    print(f"ERROR: {TARGET_CSV} does not exist. Collection may not have completed.", file=sys.stderr)
    sys.exit(1)

df = pd.read_csv(TARGET_CSV)

print(f"File                 : {TARGET_CSV}")
print(f"Total rows           : {len(df)}")
print(f"Columns              : {list(df.columns)}")

# ── Uniqueness ──────────────────────────────────────────────────────────────────
section("UNIQUENESS")
dup_rows  = int(df.duplicated().sum())
dup_hashes = int(df["tx_hash"].duplicated().sum())
unique_hashes = df["tx_hash"].nunique()

print(f"Unique tx hashes     : {unique_hashes}")
print(f"Duplicate rows       : {dup_rows}")
print(f"Duplicate tx hashes  : {dup_hashes}")
if dup_rows == 0 and dup_hashes == 0:
    print("PASS: No duplicates detected.")
else:
    print("WARNING: Duplicates detected -- investigate before ML training.")

# ── Missing values ──────────────────────────────────────────────────────────────
section("MISSING VALUES")
mv = df.isnull().sum()
print(mv.to_string())
if mv.sum() == 0:
    print("\nPASS: No missing values.")
else:
    print(f"\nWARNING: {mv.sum()} missing values across dataset.")

# ── Class distribution ─────────────────────────────────────────────────────────
section("CLASS DISTRIBUTION")
vc = df["success"].value_counts().sort_index()
for label, count in vc.items():
    pct = 100.0 * count / len(df)
    name = "Success (1)" if label == 1 else "Failed  (0)"
    print(f"  {name}: {count:>6}  ({pct:.2f}%)")

failed_count = int(vc.get(0, 0))
if failed_count < 200:
    print(f"\nWARNING: Only {failed_count} failed transactions.")
    print("  This may limit class-0 recall in ML training.")
elif failed_count / len(df) < 0.02:
    print("\nWARNING: Severe class imbalance (<2% failures). Report honestly before modelling.")
else:
    print(f"\nPASS: {failed_count} failed transactions ({100*failed_count/len(df):.2f}%) -- sufficient for ML.")

# ── Block range & time range ───────────────────────────────────────────────────
section("BLOCK AND TIME RANGE")
df["block_number"] = pd.to_numeric(df["block_number"], errors="coerce")
print(f"Min block number     : {df['block_number'].min():.0f}")
print(f"Max block number     : {df['block_number'].max():.0f}")

block_span = int(df['block_number'].max() - df['block_number'].min())
print(f"Block span           : {block_span} blocks")

if "block_time" in df.columns:
    times = pd.to_datetime(df["block_time"], errors="coerce", utc=True)
    print(f"Earliest block_time  : {times.min()}")
    print(f"Latest block_time    : {times.max()}")
    time_span = times.max() - times.min()
    print(f"Time span            : {time_span}")

# ── Schema check ───────────────────────────────────────────────────────────────
section("SCHEMA CHECK")
EXPECTED_FIELDS = [
    "tx_hash", "block_time", "block_number", "sender", "receiver",
    "value_native", "gas_limit", "gas_used", "gas_price_gwei",
    "nonce", "type", "success", "gas_fee_native",
]
missing_cols = [c for c in EXPECTED_FIELDS if c not in df.columns]
extra_cols   = [c for c in df.columns if c not in EXPECTED_FIELDS]
if not missing_cols and not extra_cols:
    print("PASS: Schema matches expected 13-column layout.")
else:
    if missing_cols:
        print(f"FAIL: Missing columns: {missing_cols}")
    if extra_cols:
        print(f"INFO: Extra columns:   {extra_cols}")

# ── Transactions per source address ───────────────────────────────────────────
section("TRANSACTIONS PER SENDER/RECEIVER (TOP 10)")
# Approximate: count rows where sender or receiver matches the 5 known protocol addresses
ADDRESSES = [
    "0xe592427a0aece92de3edee1f18e0157c05861564",  # Uniswap V3 Router
    "0x794a61358d6845594f94dc1db02a252b5b4814ad",  # Aave V3 Pool
    "0x1f98431c8ad98523631ae4a59f267346ea31f984",  # Uniswap V3 Factory
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",  # USDT
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",  # USDC
]
for addr in ADDRESSES:
    mask = (df["sender"].str.lower() == addr) | (df["receiver"].str.lower() == addr)
    count = int(mask.sum())
    label = {
        "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
        "0x794a61358d6845594f94dc1db02a252b5b4814ad": "Aave V3 Pool",
        "0x1f98431c8ad98523631ae4a59f267346ea31f984": "Uniswap V3 Factory",
        "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": "USDT",
        "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
    }[addr]
    print(f"  {label:<22}: {count:>6} rows")

# ── Feature descriptive stats ──────────────────────────────────────────────────
section("FEATURE STATISTICS")
FEATURES = ["value_native", "gas_limit", "gas_used", "gas_price_gwei", "nonce", "type"]
for col in FEATURES:
    df[col] = pd.to_numeric(df[col], errors="coerce")
print(df[FEATURES].describe().to_string())

type_unique = df["type"].nunique()
if type_unique == 1:
    print(f"\nNOTE: 'type' is still constant (all {df['type'].iloc[0]:.0f}) -- zero variance, as in 1k dataset.")
else:
    print(f"\nINFO: 'type' now has {type_unique} unique values -- variance present in 10k dataset.")

# ── Summary verdict ────────────────────────────────────────────────────────────
section("VALIDATION VERDICT")
issues = []
if len(df) < 10000:
    issues.append(f"Row count {len(df)} < 10,000 target.")
if dup_rows > 0:
    issues.append(f"{dup_rows} duplicate rows.")
if dup_hashes > 0:
    issues.append(f"{dup_hashes} duplicate tx hashes.")
if mv.sum() > 0:
    issues.append(f"{mv.sum()} missing values.")
if missing_cols:
    issues.append(f"Missing schema columns: {missing_cols}.")

if not issues:
    print("PASS: Dataset is valid and ready for ML training.")
    print(f"      {len(df)} rows | {unique_hashes} unique tx | {failed_count} failures ({100*failed_count/len(df):.2f}%)")
else:
    print("ISSUES FOUND:")
    for issue in issues:
        print(f"  - {issue}")
    print("Resolve issues before running ml_experiment.py on this dataset.")
