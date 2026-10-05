"""Fetch Polygon gateway transactions from the Etherscan V2 API."""

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
REPO_ROOT = BACKEND_DIR.parent
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
        print(f"Skipped {skipped_without_receipt_status} records without a usable status or required fields.")
    return collected


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Make one small API request; write no files")
    mode.add_argument("--collect", action="store_true", help="Collect labelled transactions to CSV")
    parser.add_argument("--limit", type=int, default=1000, help="Maximum transactions to save (default: 1000)")
    parser.add_argument("--address", help="Polygon address; defaults to the deployed payment gateway")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="CSV output path")
    args = parser.parse_args()

    load_dotenv(REPO_ROOT / "polygon-ml-dataset" / ".env")
    api_key = os.getenv("ETHERSCAN_API_KEY", "").strip()
    if not api_key:
        print("Missing ETHERSCAN_API_KEY. Add it to polygon-ml-dataset/.env; do not put it in backend/.env or source code.", file=sys.stderr)
        return 2

    try:
        address = validate_address(args.address or default_gateway_address())
        if args.check:
            transactions = request_transactions(api_key, address, page=1, offset=5)
            statuses = sum(transaction_success(tx) is not None for tx in transactions)
            print(f"API key accepted; Polygon chain ID 137 responded; sample transactions: {len(transactions)}; labelled statuses: {statuses}.")
            return 0

        if args.limit < 1 or args.limit > 10000:
            raise ValueError("--limit must be between 1 and 10000")

        rows = collect_transactions(api_key, address, args.limit)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
            writer.writeheader()
            writer.writerows(rows)

        failed = sum(row["success"] == "0" for row in rows)
        successful = sum(row["success"] == "1" for row in rows)
        print(f"Saved {len(rows)} labelled transactions to {args.output}")
        print(f"Confirmed successes: {successful}; reverted failures: {failed}")
        if rows:
            print("Failure ratio: {:.2%}".format(failed / len(rows)))
        return 0
    except (ValueError, RuntimeError) as error:
        print(f"Collection failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())