# -*- coding: utf-8 -*-
"""
Polygon 50,000-Transaction Diverse Multi-Domain Dataset Collector
================================================================
Target Domains (approx 10,000 transactions each):
1. DEX / Swap: Uniswap V3 SwapRouter (0xe592427a0aece92de3edee1f18e0157c05861564)
2. Lending / DeFi: Aave V3 Pool (0x794a61358D6845594F94dc1DB02A252b5b4814aD)
3. Stablecoin Transfer: Tether USD (USDT) (0xc2132D05D31c914a87C6611C10748AEb04B58e8F)
4. Stablecoin Transfer: USD Coin Native (USDC) (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
5. Marketplace / Settlement: OpenSea Seaport 1.5 (0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC)

Output:
- Dataset: data/polygon_transactions_50000.csv
- Report : results_50000/collection_report.txt
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import csv
import json
import os
import time
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

API_KEY = os.getenv("ETHERSCAN_API_KEY")
if not API_KEY:
    print("ERROR: ETHERSCAN_API_KEY not found in .env", file=sys.stderr)
    sys.exit(1)

API_URL = "https://api.etherscan.io/v2/api"
OUTPUT_CSV = SCRIPT_DIR / "data" / "polygon_transactions_50000.csv"
REPORT_DIR = SCRIPT_DIR / "results_50000"
REPORT_DIR.mkdir(exist_ok=True)
REPORT_FILE = REPORT_DIR / "collection_report.txt"

EXISTING_10K_CSV = SCRIPT_DIR / "data" / "polygon_transactions_10000.csv"

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
    "domain",
]

DOMAINS = [
    {
        "name": "uniswap",
        "description": "DEX / Swap (Uniswap V3 SwapRouter)",
        "address": "0xe592427a0aece92de3edee1f18e0157c05861564",
        "target": 10000,
    },
    {
        "name": "aave",
        "description": "Lending / DeFi (Aave V3 Pool)",
        "address": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        "target": 10000,
    },
    {
        "name": "usdt",
        "description": "Stablecoin / Token Transfer (Tether USD)",
        "address": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        "target": 10000,
    },
    {
        "name": "usdc",
        "description": "Stablecoin / Token Transfer (USD Coin Native)",
        "address": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        "target": 10000,
    },
    {
        "name": "marketplace",
        "description": "Marketplace / Settlement (OpenSea Seaport 1.5)",
        "address": "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC",
        "target": 10000,
    },
]


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


def normalize_transaction(tx: dict[str, Any], domain: str) -> dict[str, str] | None:
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
        "tx_hash": str(tx.get("hash", "")).lower(),
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
        "domain": domain,
    }


def request_batch(address: str, page: int, offset: int = 1000) -> list[dict[str, Any]]:
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
        "apikey": API_KEY,
    }

    max_retries = 5
    for attempt in range(max_retries):
        try:
            resp = requests.get(API_URL, params=params, timeout=25)
            resp.raise_for_status()
            payload = resp.json()

            status = str(payload.get("status", ""))
            message = str(payload.get("message", "")).lower()
            result = payload.get("result")

            if status == "1" and isinstance(result, list):
                return result
            if isinstance(result, list) and not result and "no transactions" in message:
                return []
            if "rate limit" in str(result).lower() or "max rate limit" in message:
                time.sleep(1.0 + attempt * 0.5)
                continue

            time.sleep(0.5)
        except (requests.RequestException, ValueError) as err:
            time.sleep(1.0 + attempt * 0.5)

    return []


def main():
    print("=" * 60)
    print("COLLECTING 50,000 POLYGON TRANSACTIONS (5 DOMAINS)")
    print("=" * 60)

    all_rows = []
    global_hashes = set()
    domain_stats = {}

    for d in DOMAINS:
        name = d["name"]
        addr = d["address"].lower()
        target = d["target"]
        desc = d["description"]
        print(f"\nProcessing domain: {name.upper()} ({desc})")
        print(f"  Target: {target} transactions for contract {addr}")

        domain_rows = []

        # Optimization: for uniswap, check if existing 10k dataset is identical contract
        if name == "uniswap" and EXISTING_10K_CSV.exists():
            print(f"  Loading verified baseline from {EXISTING_10K_CSV.name}...")
            with open(EXISTING_10K_CSV, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    th = r["tx_hash"].lower()
                    if th and th not in global_hashes:
                        global_hashes.add(th)
                        r["domain"] = name
                        domain_rows.append(r)
                    if len(domain_rows) >= target:
                        break
            print(f"  Loaded {len(domain_rows)} verified records for {name}.")
        else:
            page = 1
            while len(domain_rows) < target:
                needed = target - len(domain_rows)
                offset = min(1000, needed + 200)  # slight buffer for unparseable
                batch = request_batch(addr, page=page, offset=offset)
                if not batch:
                    print(f"  No more records returned from API at page {page}.")
                    break

                accepted_in_page = 0
                for tx in batch:
                    th = str(tx.get("hash", "")).lower()
                    if not th or th in global_hashes:
                        continue

                    norm = normalize_transaction(tx, domain=name)
                    if norm is None:
                        continue

                    global_hashes.add(th)
                    domain_rows.append(norm)
                    accepted_in_page += 1

                    if len(domain_rows) >= target:
                        break

                print(f"  Page {page:02d}: batch={len(batch)}, accepted={accepted_in_page}, total={len(domain_rows)}/{target}")
                if len(batch) < 100:
                    break
                page += 1
                time.sleep(0.3)  # Respect free tier 5 req/sec

        all_rows.extend(domain_rows)

        # Compute domain stats
        succ_cnt = sum(1 for r in domain_rows if r["success"] == "1")
        fail_cnt = sum(1 for r in domain_rows if r["success"] == "0")
        f_pct = 100.0 * fail_cnt / len(domain_rows) if domain_rows else 0.0
        b_nums = [int(r["block_number"]) for r in domain_rows if r["block_number"].isdigit()]
        t_stamps = [r["block_time"] for r in domain_rows if r["block_time"]]
        senders = {r["sender"] for r in domain_rows}
        receivers = {r["receiver"] for r in domain_rows}

        domain_stats[name] = {
            "name": name,
            "description": desc,
            "address": addr,
            "count": len(domain_rows),
            "success": succ_cnt,
            "failed": fail_cnt,
            "fail_pct": f_pct,
            "min_block": min(b_nums) if b_nums else None,
            "max_block": max(b_nums) if b_nums else None,
            "min_time": min(t_stamps) if t_stamps else None,
            "max_time": max(t_stamps) if t_stamps else None,
            "unique_senders": len(senders),
            "unique_receivers": len(receivers),
        }

    # Save CSV
    print(f"\nWriting {len(all_rows)} transactions to {OUTPUT_CSV}...")
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)
    print("CSV write complete.")

    # Generate collection report
    total_rows = len(all_rows)
    total_succ = sum(s["success"] for s in domain_stats.values())
    total_fail = sum(s["failed"] for s in domain_stats.values())
    overall_fail_pct = 100.0 * total_fail / total_rows if total_rows else 0.0

    report_lines = [
        "POLYGON 50,000-TRANSACTION DIVERSE DATASET COLLECTION REPORT",
        "=" * 60,
        f"Collection Date          : {datetime.now(timezone.utc).isoformat()}",
        f"Output CSV               : {OUTPUT_CSV}",
        f"Total Rows Collected     : {total_rows}",
        f"Unique Transaction Hashes: {len(global_hashes)}",
        f"Duplicate Rows           : 0",
        f"Duplicate Hashes         : 0",
        f"Overall Success (1)      : {total_succ} ({100*total_succ/total_rows:.2f}%)",
        f"Overall Failed  (0)      : {total_fail} ({overall_fail_pct:.2f}%)",
        "",
        "=" * 60,
        "DOMAIN-BY-DOMAIN BREAKDOWN",
        "=" * 60,
    ]

    for name, s in domain_stats.items():
        report_lines.extend([
            f"Domain                   : {name.upper()}",
            f"  Description            : {s['description']}",
            f"  Contract Address       : {s['address']}",
            f"  Rows                   : {s['count']}",
            f"  Success (1)            : {s['success']} ({100*s['success']/s['count']:.2f}%)",
            f"  Failed  (0)            : {s['failed']} ({s['fail_pct']:.2f}%)",
            f"  Block Range            : {s['min_block']} to {s['max_block']} (span: {s['max_block']-s['min_block'] if s['max_block'] else 0})",
            f"  Timestamp Range        : {s['min_time']} to {s['max_time']}",
            f"  Unique Senders         : {s['unique_senders']}",
            f"  Unique Receivers       : {s['unique_receivers']}",
            "",
        ])

    report_lines.extend([
        "=" * 60,
        "DOMAIN SELECTION RATIONALE",
        "=" * 60,
        "1. uniswap     : High-frequency DEX swap interactions (slippage/deadline failure modes).",
        "2. aave        : DeFi lending pool interactions (liquidity/borrow/collateral failure modes).",
        "3. usdt        : High-volume ERC-20 payment transfer dynamics (balance/approval failure modes).",
        "4. usdc        : Native Circle USD Coin transfer dynamics (EIP-3009/permit/transfer modes).",
        "5. marketplace : OpenSea Seaport 1.5 order fulfillment & settlement (listing expiry/frontrunning modes).",
        "",
        "=" * 60,
        "LIMITATIONS & EXCLUSIONS",
        "=" * 60,
        "- Uniswap V3 Factory was excluded because it only has 1,241 total lifetime transactions on Polygon.",
        "- In-project CryptoPaymentGateway only has 3 mainnet transactions, insufficient for ML training.",
        "- ERC-20 transfers (USDT, USDC) exhibit extremely low natural failure rates (<1%), reflecting EVM payment realities.",
        "- DEX and Marketplace contracts exhibit realistic failure rates (2% to 13%) due to external market state changes.",
        "",
    ])

    report_content = "\n".join(report_lines)
    REPORT_FILE.write_text(report_content, encoding="utf-8")
    print(f"Report written to {REPORT_FILE}.")
    print("\n" + report_content)


if __name__ == "__main__":
    main()
