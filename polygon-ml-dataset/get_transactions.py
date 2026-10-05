"""Fetch Polygon gateway transactions from the Etherscan V2 API."""

import argparse
import csv
import json
import os
import re
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
API_URL = "https://api.etherscan.io/v2/api"
DEFAULT_OUTPUT = SCRIPT_DIR / "data" / "polygon_transactions.csv"
WEI_PER_POL = Decimal("1000000000000000000")
WEI_PER_GWEI = Decimal("1000000000")
CSV_FIELDS = [
    "tx_hash",
    "block_time",
    "block_number",
    "sender",
    "receiver",
    "value_native",
    "gas_limit",
    "gas_used",
    "gas_price_gwei",
    "nonce",
    "type",
    "success",
    "gas_fee_native",
]


def default_gateway_address() -> str:
    address_override = os.getenv("POLYGON_CONTRACT_ADDRESS")
    if address_override:
        return address_override

    deployment_path = REPO_ROOT / "web3" / "deployment-polygon.json"
    try:
        deployment = json.loads(deployment_path.read_text(encoding="utf-8"))
        return deployment["contracts"]["CryptoPaymentGateway"]
    except (OSError, KeyError, json.JSONDecodeError) as error:
        raise ValueError(
            "Set POLYGON_CONTRACT_ADDRESS or provide web3/deployment-polygon.json"
        ) from error


def validate_address(address: str) -> str:
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", address):
        raise ValueError("Address must be a 20-byte EVM address")
    return address


def load_addresses_file(path: Path) -> list[str]:
    """Read addresses from a text file, ignoring blank lines and # comments."""
    addresses: list[str] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            addresses.append(validate_address(line))
        except ValueError as error:
            raise ValueError(f"Invalid address in {path}: {line!r} -- {error}") from error
    if not addresses:
        raise ValueError(f"No valid addresses found in {path}")
    return addresses


def request_transactions(
    api_key: str,
    address: str,
    page: int,
    offset: int,
) -> list[dict[str, Any]]:
    params = {
        "chainid": "137",
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "page": page,
        "offset": offset,
        "sort": "desc",
        "apikey": api_key,
    }

    try:
        response = requests.get(API_URL, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as error:
        raise RuntimeError("Etherscan API request failed; check network and API key") from error

    result = payload.get("result")
    if payload.get("status") == "1" and isinstance(result, list):
        return result
    if isinstance(result, list) and not result and "no transactions" in str(payload.get("message", "")).lower():
        return []

    raise RuntimeError("Etherscan rejected the request or returned an unexpected response")


def parse_status(value: Any) -> int | None:
    normalized = str(value).strip().lower()
    if normalized in {"1", "0x1", "success"}:
        return 1
    if normalized in {"0", "0x0", "failed", "reverted"}:
        return 0
    return None


def transaction_success(tx: dict[str, Any]) -> int | None:
    receipt_status = parse_status(tx.get("txreceipt_status"))
    if receipt_status is not None:
        return receipt_status

    is_error = parse_status(tx.get("isError"))
    return 1 - is_error if is_error is not None else None


def decimal_string(value: Decimal) -> str:
    return format(value.normalize(), "f") if value else "0"


def normalize_transaction(tx: dict[str, Any]) -> dict[str, str] | None:
    success = transaction_success(tx)
    if success is None:
        return None

    try:
        timestamp = int(tx["timeStamp"])
        gas_used = int(tx["gasUsed"])
        gas_price_wei = Decimal(str(tx["gasPrice"]))
        native_value = Decimal(str(tx["value"])) / WEI_PER_POL
        gas_fee = Decimal(gas_used) * gas_price_wei / WEI_PER_POL
    except (KeyError, TypeError, ValueError, InvalidOperation):
        return None

    block_time = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
    return {
        "tx_hash": str(tx.get("hash", "")),
        "block_time": block_time,
        "block_number": str(tx.get("blockNumber", "")),
        "sender": str(tx.get("from", "")).lower(),
        "receiver": str(tx.get("to", "")).lower(),
        "value_native": decimal_string(native_value),
        "gas_limit": str(tx.get("gas", "")),
        "gas_used": str(gas_used),
        "gas_price_gwei": decimal_string(gas_price_wei / WEI_PER_GWEI),
        "nonce": str(tx.get("nonce", "")),
        "type": str(tx.get("type", "0")),
        "success": str(success),
        "gas_fee_native": decimal_string(gas_fee),
    }


def collect_transactions(api_key: str, address: str, limit: int) -> list[dict[str, str]]:
    """Collect up to `limit` transactions from a single address (no global dedup here)."""
    collected: list[dict[str, str]] = []
    seen_hashes: set[str] = set()
    skipped_without_receipt_status = 0
    page = 1

    while len(collected) < limit:
        offset = min(limit - len(collected), 1000)
        batch = request_transactions(api_key, address, page, offset)
        if not batch:
            break

        for tx in batch:
            tx_hash = str(tx.get("hash", "")).lower()
            if not tx_hash or tx_hash in seen_hashes:
                continue
            seen_hashes.add(tx_hash)

            normalized = normalize_transaction(tx)
            if normalized is None:
                skipped_without_receipt_status += 1
                continue
            collected.append(normalized)
            if len(collected) >= limit:
                break

        if len(batch) < offset:
            break
        page += 1

    if skipped_without_receipt_status:
        print(f"  Skipped {skipped_without_receipt_status} records without usable status (address {address[:10]}...).")
    return collected


def collect_from_addresses(
    api_key: str,
    addresses: list[str],
    limit: int,
) -> tuple[list[dict[str, str]], int, int]:
    """Collect up to `limit` transactions across multiple addresses with global deduplication.

    Returns:
        (rows, total_fetched, duplicate_count)
    """
    all_rows: list[dict[str, str]] = []
    global_seen: set[str] = set()
    total_fetched = 0
    duplicate_count = 0

    for address in addresses:
        if len(all_rows) >= limit:
            break

        remaining = limit - len(all_rows)
        print(f"  Querying {address} (need {remaining} more) ...")

        # Fetch up to 10,000 per address (API page max = 1,000); buffer by 10% for dedup losses
        fetch_limit = min(int(remaining * 1.1) + 1000, 10000)
        raw_rows: list[dict[str, str]] = []
        skipped_local = 0
        page = 1

        while len(raw_rows) < fetch_limit:
            offset = min(fetch_limit - len(raw_rows), 1000)
            try:
                batch = request_transactions(api_key, address, page, offset)
            except RuntimeError as err:
                print(f"  WARNING: {err}. Skipping remaining pages for {address}.", file=sys.stderr)
                break

            if not batch:
                break

            total_fetched += len(batch)
            for tx in batch:
                tx_hash = str(tx.get("hash", "")).lower()
                if not tx_hash:
                    skipped_local += 1
                    continue

                if tx_hash in global_seen:
                    duplicate_count += 1
                    continue
                global_seen.add(tx_hash)

                normalized = normalize_transaction(tx)
                if normalized is None:
                    skipped_local += 1
                    continue

                raw_rows.append(normalized)

            if len(batch) < offset:
                break
            page += 1

        if skipped_local:
            print(f"  Skipped {skipped_local} records from {address[:10]}... (no usable status/fields).")

        # Only take as many as we still need
        need = limit - len(all_rows)
        all_rows.extend(raw_rows[:need])
        print(f"  Accepted {min(len(raw_rows), need)} from {address[:10]}... -- running total: {len(all_rows)}")

    return all_rows, total_fetched, duplicate_count


def print_quality_report(
    rows: list[dict[str, str]],
    addresses: list[str],
    total_fetched: int,
    duplicate_count: int,
    skipped: int,
    output_path: Path,
) -> None:
    successful = sum(row["success"] == "1" for row in rows)
    failed = sum(row["success"] == "0" for row in rows)
    unique = len(rows)

    total_pct = unique if unique else 1
    success_pct = 100.0 * successful / total_pct
    failure_pct = 100.0 * failed / total_pct

    block_nums = [int(r["block_number"]) for r in rows if r["block_number"].isdigit()]
    block_times = [r["block_time"] for r in rows if r["block_time"]]

    print("\n" + "=" * 56)
    print("DATA QUALITY REPORT")
    print("=" * 56)
    print(f"Source addresses     : {len(addresses)}")
    for addr in addresses:
        print(f"  {addr}")
    print(f"Transactions fetched : {total_fetched}")
    print(f"Unique transactions  : {unique}")
    print(f"Successful           : {successful}")
    print(f"Failed               : {failed}")
    print(f"Success percentage   : {success_pct:.2f}%")
    print(f"Failure percentage   : {failure_pct:.2f}%")
    print(f"Skipped              : {skipped}")
    print(f"Duplicate count      : {duplicate_count}")

    if block_nums:
        print(f"Minimum block number : {min(block_nums)}")
        print(f"Maximum block number : {max(block_nums)}")
    if block_times:
        sorted_times = sorted(block_times)
        print(f"Earliest block_time  : {sorted_times[0]}")
        print(f"Latest block_time    : {sorted_times[-1]}")

    print("\nMissing values per column:")
    for field in CSV_FIELDS:
        missing = sum(1 for r in rows if not r.get(field, "").strip())
        if missing:
            print(f"  {field}: {missing}")
        else:
            print(f"  {field}: 0")

    print(f"\nOutput saved to      : {output_path}")
    print("=" * 56)

    if failed < 20:
        print("\nWARNING: Too few failed transactions for a reliable initial classifier.")
    if unique > 0 and (failed / unique < 0.02 or failed / unique > 0.98):
        print("WARNING: Dataset is severely class-imbalanced. Report this honestly before modelling.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Make one small API request; write no files")
    mode.add_argument("--collect", action="store_true", help="Collect labelled transactions to CSV")
    parser.add_argument("--limit", type=int, default=1000, help="Maximum transactions to save (default: 1000)")
    parser.add_argument("--address", help="Single Polygon address (overrides --addresses-file)")
    parser.add_argument(
        "--addresses-file",
        type=Path,
        default=None,
        metavar="FILE",
        help="Path to a text file containing one Polygon address per line",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="CSV output path")
    args = parser.parse_args()

    load_dotenv()
    api_key = os.getenv("ETHERSCAN_API_KEY", "").strip()
    if not api_key:
        print("Missing ETHERSCAN_API_KEY. Add it to polygon-ml-dataset/.env; do not put it in backend/.env or source code.", file=sys.stderr)
        return 2

    try:
        # -- CHECK mode --------------------------------------------------------
        if args.check:
            # Use the single --address if given, else gateway address, else first address in file
            if args.address:
                check_address = validate_address(args.address)
            elif args.addresses_file and args.addresses_file.exists():
                check_address = load_addresses_file(args.addresses_file)[0]
            else:
                check_address = validate_address(default_gateway_address())

            transactions = request_transactions(api_key, check_address, page=1, offset=5)
            statuses = sum(transaction_success(tx) is not None for tx in transactions)
            print(
                f"API key accepted; Polygon chain ID 137 responded; "
                f"sample transactions: {len(transactions)}; labelled statuses: {statuses}."
            )
            return 0

        # -- COLLECT mode ------------------------------------------------------
        if args.limit < 1 or args.limit > 50000:
            raise ValueError("--limit must be between 1 and 50000")

        # Resolve address list
        if args.address:
            addresses = [validate_address(args.address)]
        elif args.addresses_file:
            addresses = load_addresses_file(args.addresses_file)
        else:
            addresses = [validate_address(default_gateway_address())]

        print(f"Collecting up to {args.limit} transactions from {len(addresses)} address(es) ...")
        rows, total_fetched, duplicate_count = collect_from_addresses(api_key, addresses, args.limit)

        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
            writer.writeheader()
            writer.writerows(rows)

        # Count skipped: total_fetched minus duplicates minus accepted rows
        skipped = total_fetched - duplicate_count - len(rows)
        print_quality_report(rows, addresses, total_fetched, duplicate_count, skipped, args.output)
        return 0

    except (ValueError, RuntimeError) as error:
        print(f"Collection failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
