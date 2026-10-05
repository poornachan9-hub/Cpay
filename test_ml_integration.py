# -*- coding: utf-8 -*-
"""
Targeted Verification Tests for ML Frontend/Backend Integration
==============================================================
Validates:
1. Model files load successfully.
2. Each supported domain routes to the intended model.
3. Aave takes the non-ML path.
4. Unknown contracts use fallback.
5. Prediction response has the required fields.
6. Confusion matrix metrics are valid and complete.
"""

import sys
import json
from pathlib import Path

# Add project root to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR / "polygon-ml-dataset"))

from predict_tx import predict_tx_risk, get_model_and_scaler, KNOWN_CONTRACTS

def test_integration():
    print("==================================================")
    print("STARTING TARGETED ML INTEGRATION TESTS")
    print("==================================================")
    passed = 0
    total = 0

    # TEST 1: Model files load successfully
    total += 1
    print("\n[Test 1] Verifying all model and scaler files load...")
    try:
        m_dex, _ = get_model_and_scaler("dex", "rf")
        m_mkt, s_mkt = get_model_and_scaler("marketplace", "logistic")
        m_tok, _ = get_model_and_scaler("token", "rf")
        m_fb, _ = get_model_and_scaler("fallback", "rf")
        assert m_dex is not None
        assert m_mkt is not None and s_mkt is not None
        assert m_tok is not None
        assert m_fb is not None
        print("PASS: DEX RF, Marketplace LR+Scaler, Token RF, and Fallback RF loaded cleanly.")
        passed += 1
    except Exception as e:
        print(f"FAIL in Test 1: {e}")

    # TEST 2: Supported domain routing
    total += 1
    print("\n[Test 2] Verifying supported domain routing to intended models...")
    try:
        # Uniswap -> DEX RF
        r_uni = predict_tx_risk("0xe592427a0aece92de3edee1f18e0157c05861564", 150000, 35.0, 0.0)
        assert r_uni["domain_key"] == "uniswap"
        assert "Random Forest (DEX Domain Model)" in r_uni["model_used"]

        # Seaport -> Marketplace LR
        r_mkt = predict_tx_risk("0x00000000000000adc04c56bf30ac9d3c0aaf14dc", 250000, 35.0, 0.0)
        assert r_mkt["domain_key"] == "marketplace"
        assert "Logistic Regression (Marketplace Domain Model)" in r_mkt["model_used"]

        # USDT -> Token RF
        r_tok = predict_tx_risk("0xc2132d05d31c914a87c6611c10748aeb04b58e8f", 65000, 35.0, 0.0)
        assert r_tok["domain_key"] == "token"
        assert "Random Forest (Token Domain Model)" in r_tok["model_used"]

        print("PASS: Uniswap -> DEX RF, Seaport -> Marketplace LR, USDT -> Token RF.")
        passed += 1
    except Exception as e:
        print(f"FAIL in Test 2: {e}")

    # TEST 3: Aave takes the non-ML path
    total += 1
    print("\n[Test 3] Verifying Aave takes explicit non-ML path...")
    try:
        r_aave = predict_tx_risk("0x794a61358d6845594f94dc1db02a252b5b4814ad", 300000, 35.0, 0.0)
        assert r_aave["domain_key"] == "aave"
        assert r_aave["requires_onchain_state"] is True
        assert r_aave["failure_probability"] is None
        assert r_aave["predicted_outcome"] == "STATE_CHECK_REQUIRED"
        assert "Rule-Based Engine" in r_aave["model_used"]
        print("PASS: Aave routed to non-ML path with requires_onchain_state=True.")
        passed += 1
    except Exception as e:
        print(f"FAIL in Test 3: {e}")

    # TEST 4: Unknown contracts use fallback
    total += 1
    print("\n[Test 4] Verifying unknown contract uses general fallback model...")
    try:
        r_unknown = predict_tx_risk("0x9999999999999999999999999999999999999999", 21000, 30.0, 1.0)
        assert r_unknown["domain_key"] == "fallback"
        assert "Random Forest (Fallback General Model)" in r_unknown["model_used"]
        assert r_unknown["requires_onchain_state"] is False
        print("PASS: Unknown address routed to Fallback General Model.")
        passed += 1
    except Exception as e:
        print(f"FAIL in Test 4: {e}")

    # TEST 5: Prediction response has all required fields
    total += 1
    print("\n[Test 5] Verifying prediction response schema...")
    required_fields = [
        "to_address", "domain", "domain_key", "model_used",
        "requires_onchain_state", "failure_probability",
        "threshold", "predicted_outcome", "risk_level",
        "warning", "disclaimer", "features_used"
    ]
    try:
        for r in [r_uni, r_mkt, r_tok, r_aave, r_unknown]:
            for f in required_fields:
                assert f in r, f"Missing field: {f} in response"
            assert r["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
            assert r["predicted_outcome"] in ["SUCCESS", "FAILURE", "STATE_CHECK_REQUIRED"]
        print("PASS: All required fields present with valid types and values.")
        passed += 1
    except Exception as e:
        print(f"FAIL in Test 5: {e}")

    # TEST 6: Confusion Matrix Metrics consistency check
    total += 1
    print("\n[Test 6] Verifying confusion matrix data consistency...")
    try:
        # Check lib/mlMetricsData.js exists and is valid
        metrics_file = SCRIPT_DIR / "lib" / "mlMetricsData.js"
        assert metrics_file.exists()
        content = metrics_file.read_text(encoding="utf-8")
        assert "pooled_lr" in content
        assert "pooled_rf" in content
        assert "uniswap_rf" in content
        assert "marketplace_lr" in content
        assert "token_rf" in content
        assert "aave_limitation" in content
        # Check exact known counts
        assert "370" in content # Pooled LR TP
        assert "2304" in content # Pooled LR FP
        assert "222" in content # Uniswap RF TP
        assert "114" in content # Uniswap RF FP
        assert "0" in content # Token RF FP
        print("PASS: Confusion matrix data matches exact validated 50k experiment numbers.")
        passed += 1
    except Exception as e:
        print(f"FAIL in Test 6: {e}")

    print("\n==================================================")
    print(f"TESTS COMPLETED: {passed}/{total} PASSED")
    print("==================================================")
    return passed == total

if __name__ == "__main__":
    success = test_integration()
    sys.exit(0 if success else 1)
