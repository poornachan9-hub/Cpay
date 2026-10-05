import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

root = Path(r'c:\project folder\W_T_F_1-main\backend\scripts\data\aave-polygon-v3')
root.mkdir(parents=True, exist_ok=True)

rows = []
positions = 25
np.random.seed(7)

for i in range(positions):
    base_ts = pd.Timestamp('2023-01-01 00:00:00', tz='UTC')
    for j in range(np.random.randint(2, 5)):
        ts = base_ts + pd.Timedelta(days=np.random.randint(0, 40), hours=np.random.randint(0, 23), minutes=np.random.randint(0, 59))
        rows.append({
            'timestamp': ts,
            'blockNumber': 1000000 + i * 10 + j,
            'txHash': f'0x{i:03d}{j:02d}',
            'user': f'user_{i}',
            'position_id': f'pos_{i}',
            'eventType': 'BORROW',
            'asset': 'USDC',
            'amount': float(np.random.randint(1000, 6000)),
            'liquidationAmount': 0,
            'healthFactor': 1.6,
        })
    for j in range(np.random.randint(1, 3)):
        ts = base_ts + pd.Timedelta(days=np.random.randint(5, 70), hours=np.random.randint(0, 23), minutes=np.random.randint(0, 59))
        rows.append({
            'timestamp': ts,
            'blockNumber': 1000000 + i * 10 + j + 100,
            'txHash': f'0x{i:03d}{j:02d}a',
            'user': f'user_{i}',
            'position_id': f'pos_{i}',
            'eventType': 'REPAY',
            'asset': 'USDC',
            'amount': float(np.random.randint(500, 2500)),
            'liquidationAmount': 0,
            'healthFactor': 1.8,
        })
    if i % 5 == 0:
        ts = base_ts + pd.Timedelta(days=np.random.randint(10, 25))
        rows.append({
            'timestamp': ts,
            'blockNumber': 1000000 + i * 10 + 300,
            'txHash': f'0x{i:03d}liq',
            'user': f'user_{i}',
            'position_id': f'pos_{i}',
            'eventType': 'LIQUIDATIONCALL',
            'asset': 'USDC',
            'amount': float(np.random.randint(2000, 5000)),
            'liquidationAmount': float(np.random.randint(2000, 5000)),
            'healthFactor': 0.8,
        })
    rows.append({
        'timestamp': base_ts + pd.Timedelta(days=np.random.randint(1, 15)),
        'blockNumber': 1000000 + i * 10 + 400,
        'txHash': f'0x{i:03d}supply',
        'user': f'user_{i}',
        'position_id': f'pos_{i}',
        'eventType': 'SUPPLY',
        'asset': 'USDC',
        'amount': float(np.random.randint(500, 3000)),
        'liquidationAmount': 0,
        'healthFactor': 1.9,
    })
    rows.append({
        'timestamp': base_ts + pd.Timedelta(days=np.random.randint(1, 20)),
        'blockNumber': 1000000 + i * 10 + 500,
        'txHash': f'0x{i:03d}withdraw',
        'user': f'user_{i}',
        'position_id': f'pos_{i}',
        'eventType': 'WITHDRAW',
        'asset': 'USDC',
        'amount': float(np.random.randint(300, 2000)),
        'liquidationAmount': 0,
        'healthFactor': 1.7,
    })

df = pd.DataFrame(rows)
out_file = root / 'sample_aave_polygon_events.csv'
df.to_csv(out_file, index=False)
print(f'Wrote {len(df)} rows to {out_file}')

script = Path(r'c:\project folder\W_T_F_1-main\backend\scripts\train-polygon-aave-risk.py')
result = subprocess.run(
    [sys.executable, str(script), '--data-dir', str(root), '--output-dir', r'c:\project folder\W_T_F_1-main\backend\scripts\model-artifacts\aave_polygon_risk_valid'],
    capture_output=True,
    text=True,
)
print(result.stdout)
print(result.stderr)
print(f'EXIT_CODE={result.returncode}')
