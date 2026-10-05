import requests
import json
import sys
from pathlib import Path

# Add polygon-ml-dataset to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from predict_tx import predict_tx_risk

RPC = 'https://polygon.drpc.org'

hashes = [
    ('USDT-1', '0xaaf0964d71284cdb7cc71c398fb695f5205c8fa5cfbd0c165518053c97d7c0ef'),
    ('USDT-2', '0x0bde953df21b2415a91750e98e9452ee115b2aafea24d91d65586ec7fd762811'),
    ('USDT-3', '0x906404a64f1973802ee05d776bf7289abaffd4c609a8d655196d0ed94a6110eb'),
    ('USDC-1', '0xb59e8339c8e19da2760f1c2dcbea8a25205e36af85b9d5616ecbcbb1b67ccdd3'),
    ('UNI-1', '0xb109424b6e9ddeb38011227b723da260412b53ceb75403aa534e9dd98969b28a'),
    ('SEAPORT-1', '0xf6078380904b65e4d49ccdcd4f777c0d1abc3046df5075a1c7043c6a44e398eb')
]

for label, h in hashes:
    print(f"================ {label}: {h} ================")
    r_tx = requests.post(RPC, json={'jsonrpc':'2.0','id':1,'method':'eth_getTransactionByHash','params':[h]}, timeout=10).json().get('result')
    r_rcpt = requests.post(RPC, json={'jsonrpc':'2.0','id':2,'method':'eth_getTransactionReceipt','params':[h]}, timeout=10).json().get('result')
    
    if not r_tx or not r_rcpt:
        print("Could not fetch tx or rcpt")
        continue
        
    sender = r_tx['from']
    to_addr = r_tx['to']
    calldata = r_tx['input']
    value_wei = int(r_tx['value'], 16)
    value_native = value_wei / 1e18
    gas_limit = int(r_tx['gas'], 16)
    gas_price_gwei = int(r_tx['gasPrice'], 16) / 1e9
    hist_status = int(r_rcpt['status'], 16)
    gas_used = int(r_rcpt['gasUsed'], 16)
    
    # ML Prediction
    ml = predict_tx_risk(to_addr, gas_limit=gas_limit, gas_price_gwei=gas_price_gwei, value_native=value_native)
    
    # Simulation on latest state
    sim = requests.post(RPC, json={
        'jsonrpc':'2.0','id':3,'method':'eth_call',
        'params':[{'from': sender, 'to': to_addr, 'data': calldata, 'value': hex(value_wei), 'gas': hex(gas_limit)}, 'latest']
    }, timeout=10).json()
    
    print(f"Sender: {sender}")
    print(f"To: {to_addr}")
    print(f"Calldata selector: {calldata[:10]} (len {len(calldata)})")
    print(f"Gas Limit: {gas_limit} | Gas Price: {gas_price_gwei:.2f} Gwei | Value: {value_native}")
    print(f"Historical Status: {hist_status} (0=FAIL) | Gas Used: {gas_used}")
    print(f"ML: Domain={ml.get('domain')} | Model={ml.get('model_used')} | Prob={ml.get('failure_probability')} | Pred={ml.get('predicted_outcome')}")
    print(f"Simulation on Latest: {sim}")
    print()
