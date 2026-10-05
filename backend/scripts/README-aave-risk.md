# Polygon Aave V3 liquidation-risk model

This script trains a DeFi liquidation-risk model from filtered Polygon Aave V3 event data.

## Purpose
- Use only Polygon Aave V3 data
- Keep the raw dataset outside the application runtime
- Process events in chunks to avoid loading the entire dataset into RAM
- Save only trained model artifacts and config for runtime inference
- Build a genuine liquidation target with leakage protection

## Raw data expectation
Place the filtered raw Polygon data into a directory such as:

backend/scripts/data/aave-polygon-v3/

The files may be CSV or Parquet and must include the relevant event types:
- Borrow
- Repay
- Supply
- Withdraw
- LiquidationCall

## Important constraints
- Use only Polygon Aave V3 data, not the full multi-chain archive
- Do not download the full 30–50 GB dataset
- Keep the raw files outside the application
- Never load the complete raw dataset into RAM
- Process the data in chunks
- Only save trained model and metadata files

## Required raw columns
At minimum, the data should expose fields like:
- timestamp
- blockNumber
- txHash
- user or borrower identifier
- position id or borrowing position key
- event type
- asset / reserve
- amount
- liquidation amount, if available
- health factor, if available

## Target definition
The script creates a positive class when a position liquidates within a defined future window.
The prediction time is always before the liquidation event.

No future events are used as model features.

## Output artifacts
The script writes to:

backend/scripts/model-artifacts/aave_polygon_risk/

Saved files:
- logistic_regression_model.joblib
- xgboost_model.joblib
- catboost_model.joblib
- feature_names.json
- metrics.json
- model_metadata.json

Only the selected best model is saved as the runtime model.
