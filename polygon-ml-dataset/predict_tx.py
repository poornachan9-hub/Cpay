# -*- coding: utf-8 -*-
"""
Polygon Pre-Transaction Risk Prediction Service
===============================================
Routes destination contracts to domain-specific models:
- Uniswap (DEX) -> Random Forest (threshold 0.50)
- Seaport (Marketplace) -> Logistic Regression (threshold 0.60 / 0.50)
- USDT / USDC (Tokens) -> Random Forest (threshold 0.40)
- Aave (Lending) -> Non-ML explicit RPC/on-chain state analysis required
- Unknown / Other -> General Fallback Random Forest (threshold 0.50)

Features (Pre-Execution Only):
- gas_limit
- gas_price_gwei
- value_native
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import json
import os
from pathlib import Path
import joblib
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "results_50000" / "domain_models"

# Known Contract Registry (Normalized Lowercase)
KNOWN_CONTRACTS = {
    # Uniswap / DEX
    "0xe592427a0aece92de3edee1f18e0157c05861564": "uniswap",      # Uniswap V3 SwapRouter
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "uniswap",      # Uniswap SwapRouter02
    "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": "uniswap",      # SushiSwap Router
    "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff": "uniswap",      # QuickSwap Router

    # OpenSea / Seaport (Marketplace)
    "0x00000000000000adc04c56bf30ac9d3c0aaf14dc": "marketplace",  # Seaport 1.5
    "0x00000000006c3852cbef3e08e8df289169ede581": "marketplace",  # Seaport 1.1
    "0x00000000000001ad428e4906ae43d8f9852d0dd6": "marketplace",  # Seaport 1.6

    # Aave / Lending
    "0x794a61358d6845594f94dc1db02a252b5b4814ad": "aave",         # Aave V3 Pool
    "0x8be5ad27ced4f9d0c6bf23d45efefef16fa2c125": "aave",         # Aave V3 Incentives / Pool

    # Tokens (USDT + USDC)
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": "token",        # PoS USDT
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "token",        # Native USDC
    "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": "token",        # Bridged USDC.e
}

_MODELS_CACHE = {}


def get_model_and_scaler(model_type, model_family):
    """
    Safely load or retrieve cached models.
    model_type: 'dex', 'marketplace', 'token', 'fallback'
    model_family: 'rf' or 'logistic'
    """
    key = f"{model_type}_{model_family}"
    if key not in _MODELS_CACHE:
        model_path = MODEL_DIR / f"model_{model_type}_{model_family}.joblib"
        scaler_path = MODEL_DIR / f"model_{model_type}_scaler.joblib"
        
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")
            
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path) if scaler_path.exists() else None
        _MODELS_CACHE[key] = (model, scaler)
        
    return _MODELS_CACHE[key]


def identify_domain(to_address):
    """Identifies the contract domain based on destination address."""
    if not to_address or not isinstance(to_address, str):
        return "fallback"
    clean_addr = to_address.strip().lower()
    return KNOWN_CONTRACTS.get(clean_addr, "fallback")


def predict_tx_risk(to_address, gas_limit=210000, gas_price_gwei=35.0, value_native=0.0, custom_threshold=None):
    """
    Executes the validated prediction pipeline:
    1. Read destination 'to' address
    2. Identify supported domain
    3. Extract strictly pre-transaction features: gas_limit, gas_price_gwei, value_native
    4. Route to correct model or non-ML path
    5. Predict failure probability
    6. Apply domain-specific threshold
    7. Return structured assessment
    """
    domain = identify_domain(to_address)
    
    # Sanitize and validate numeric features
    try:
        gas_limit = float(gas_limit) if gas_limit is not None else 210000.0
    except (ValueError, TypeError):
        gas_limit = 210000.0

    try:
        gas_price_gwei = float(gas_price_gwei) if gas_price_gwei is not None else 35.0
    except (ValueError, TypeError):
        gas_price_gwei = 35.0

    try:
        value_native = float(value_native) if value_native is not None else 0.0
    except (ValueError, TypeError):
        value_native = 0.0

    features_raw = np.array([[gas_limit, gas_price_gwei, value_native]], dtype=np.float64)

    # 4. Route according to validated architecture
    if domain == "aave":
        # Aave Rule: DO NOT use ML. Explicit RPC/on-chain state analysis required path.
        return {
            "to_address": to_address,
            "domain": "Lending (Aave)",
            "domain_key": "aave",
            "model_used": "Rule-Based Engine (On-Chain State Required)",
            "requires_onchain_state": True,
            "failure_probability": None,
            "threshold": None,
            "predicted_outcome": "STATE_CHECK_REQUIRED",
            "risk_level": "MEDIUM",
            "warning": (
                "Aave lending pool transactions depend on dynamic borrower health factor, pool liquidity, "
                "and collateral valuation. Static gas/value ML heuristics cannot reliably predict failure "
                "(0-12.5% recall). Simulate execution via RPC on-chain state inspection before submission."
            ),
            "disclaimer": "Prediction is advisory — does not prevent transaction submission.",
            "features_used": {
                "gas_limit": gas_limit,
                "gas_price_gwei": gas_price_gwei,
                "value_native": value_native,
            }
        }

    elif domain == "uniswap":
        # Uniswap/DEX -> Random Forest, threshold 0.50
        model, scaler = get_model_and_scaler("dex", "rf")
        threshold = custom_threshold if custom_threshold is not None else 0.50
        model_name = "Random Forest (DEX Domain Model)"
        prob_fail = float(model.predict_proba(features_raw)[0, 0])

    elif domain == "marketplace":
        # Marketplace/Seaport -> Logistic Regression, threshold 0.60
        model, scaler = get_model_and_scaler("marketplace", "logistic")
        threshold = custom_threshold if custom_threshold is not None else 0.60
        model_name = "Logistic Regression (Marketplace Domain Model)"
        features_sc = scaler.transform(features_raw) if scaler else features_raw
        prob_fail = float(model.predict_proba(features_sc)[0, 0])

    elif domain == "token":
        # USDT + USDC -> Random Forest, threshold 0.40
        model, scaler = get_model_and_scaler("token", "rf")
        threshold = custom_threshold if custom_threshold is not None else 0.40
        model_name = "Random Forest (Token Domain Model)"
        prob_fail = float(model.predict_proba(features_raw)[0, 0])

    else:
        # Unknown contracts -> General Fallback Model (Random Forest, threshold 0.50)
        model, scaler = get_model_and_scaler("fallback", "rf")
        threshold = custom_threshold if custom_threshold is not None else 0.50
        model_name = "Random Forest (Fallback General Model)"
        prob_fail = float(model.predict_proba(features_raw)[0, 0])

    # Evaluate outcome against domain threshold
    is_predicted_failure = prob_fail >= threshold
    predicted_outcome = "FAILURE" if is_predicted_failure else "SUCCESS"

    # Determine 3-tier risk level
    if is_predicted_failure:
        risk_level = "HIGH"
        warning = (
            f"Elevated failure risk detected: {prob_fail * 100:.1f}% failure probability exceeds "
            f"the {threshold:.2f} domain safety threshold. Verify destination parameters, gas limit, and token allowances."
        )
    elif prob_fail >= 0.25:
        risk_level = "MEDIUM"
        warning = (
            f"Moderate execution risk: {prob_fail * 100:.1f}% failure probability. "
            f"Transaction parameters are acceptable, but monitor network congestion and gas price."
        )
    else:
        risk_level = "LOW"
        warning = (
            f"Low estimated failure risk ({prob_fail * 100:.1f}%). "
            f"Transaction profile aligns closely with historically confirmed transactions."
        )

    return {
        "to_address": to_address,
        "domain": {
            "uniswap": "DEX (Uniswap)",
            "marketplace": "Marketplace (Seaport)",
            "token": "Tokens (USDT / USDC)",
            "fallback": "Standard / Unknown Contract"
        }.get(domain, "Standard"),
        "domain_key": domain,
        "model_used": model_name,
        "requires_onchain_state": False,
        "failure_probability": round(prob_fail, 4),
        "threshold": threshold,
        "predicted_outcome": predicted_outcome,
        "risk_level": risk_level,
        "warning": warning,
        "disclaimer": "Prediction is advisory — does not prevent transaction submission.",
        "features_used": {
            "gas_limit": gas_limit,
            "gas_price_gwei": gas_price_gwei,
            "value_native": value_native,
        }
    }


if __name__ == "__main__":
    payload = {}
    if len(sys.argv) > 1:
        if sys.argv[1] == "--b64" and len(sys.argv) > 2:
            import base64
            try:
                decoded = base64.b64decode(sys.argv[2]).decode("utf-8")
                payload = json.loads(decoded)
            except Exception:
                payload = {}
        else:
            raw_input = sys.argv[1]
            try:
                import base64
                decoded = base64.b64decode(raw_input).decode("utf-8")
                payload = json.loads(decoded)
            except Exception:
                try:
                    payload = json.loads(raw_input)
                except Exception:
                    payload = {"to": raw_input}
    else:
        try:
            stdin_data = sys.stdin.readline().strip() or sys.stdin.read().strip()
            payload = json.loads(stdin_data) if stdin_data else {}
        except Exception:
            payload = {}

    to_addr = payload.get("to") or payload.get("to_address") or ""
    gas_limit = payload.get("gas_limit", 210000)
    gas_price_gwei = payload.get("gas_price_gwei", 35.0)
    value_native = payload.get("value_native", 0.0)
    custom_threshold = payload.get("threshold", None)

    result = predict_tx_risk(
        to_address=to_addr,
        gas_limit=gas_limit,
        gas_price_gwei=gas_price_gwei,
        value_native=value_native,
        custom_threshold=custom_threshold
    )

    print(json.dumps(result, indent=2))
    sys.stdout.flush()
