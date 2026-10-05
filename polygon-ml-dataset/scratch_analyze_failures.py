import json
import pandas as pd
import requests
import sys
from pathlib import Path

# Add project root and predict_tx
sys.path.insert(0, str(Path(__file__).resolve().parent))
from predict_tx import predict_tx_risk

POLYGON_RPC = "https://polygon.drpc.org"

def rpc_call(method, params):
    r = requests.post(POLYGON_RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=10)
    return r.json().get("result")

def simulate_tx(from_addr, to_addr, data, value, gas):
    payload = {
        "from": from_addr,
        "to": to_addr,
        "data": data,
        "value": hex(int(value * 1e18)) if value > 0 else "0x0",
        "gas": hex(int(gas))
    }
    r = requests.post(POLYGON_RPC, json={"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [payload, "latest"]}, timeout=10)
    res = r.json()
    return res

df = pd.read_csv("polygon-ml-dataset/data/polygon_transactions_50000.csv")
failures = df[df["success"] == 0]

print(f"Total failures: {len(failures)}")

# Let's inspect some failures from each domain
domains_to_test = ["usdt", "usdc", "uniswap", "marketplace"]
candidates = []

for dom in domains_to_test:
    dom_failures = failures[failures["domain"] == dom].head(10)
    for idx, row in dom_failures.iterrows():
        candidates.append(row.to_dict())

print(f"Selected {len(candidates)} candidates for deep inspection.")

results = []
for c in candidates:
    tx_hash = c["tx_hash"]
    domain = c["domain"]
    sender = c["sender"]
    receiver = c["receiver"]
    gas_limit = c["gas_limit"]
    gas_price = c["gas_price_gwei"]
    value = c["value_native"]
    block_num = c["block_number"]

    # 1. ML Prediction on pre-execution features ONLY
    ml_res = predict_tx_risk(receiver, gas_limit=gas_limit, gas_price_gwei=gas_price, value_native=value)

    # 2. Fetch on-chain tx details
    tx_info = rpc_call("eth_getTransactionByHash", [tx_hash])
    calldata = tx_info.get("input", "0x") if tx_info else "0x"
    func_sig = calldata[:10] if len(calldata) >= 10 else "0x"

    # 3. Simulate on latest block state
    sim_res = simulate_tx(sender, receiver, calldata, value, gas_limit)
    
    revert_data = None
    sim_error = None
    if "error" in sim_res:
        sim_error = sim_res["error"].get("message", "")
        revert_data = sim_res["error"].get("data", None)
    elif "result" in sim_res:
        sim_status = "SUCCESS"
    else:
        sim_status = "UNKNOWN"

    results.append({
        "tx_hash": tx_hash,
        "domain": domain,
        "block": block_num,
        "sender": sender,
        "receiver": receiver,
        "gas_limit": gas_limit,
        "gas_price_gwei": gas_price,
        "value": value,
        "func_sig": func_sig,
        "calldata_len": len(calldata),
        "ml_domain": ml_res.get("domain"),
        "ml_model": ml_res.get("model_used"),
        "ml_prob": ml_res.get("failure_probability"),
        "ml_pred": ml_res.get("predicted_outcome"),
        "sim_error": sim_error,
        "revert_data": revert_data,
        "sim_raw": sim_res
    })

print(json.dumps(results[:8], indent=2))
with open("polygon-ml-dataset/analyzed_failures.json", "w") as f:
    json.dump(results, f, indent=2)
