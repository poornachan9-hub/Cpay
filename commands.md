# Complete Terminal Run Guide

To run the entire system (Frontend + Backend), you just need **2 Terminals**:

---

## 🟢 Terminal 1: Run the Backend API (Port 4000)
> Handles User Authentication, KYC document verification, and database management.

### Step 1: Open Terminal 1
Navigate to the `backend` folder:
```powershell
cd "c:\project folder\W_T_F_1-main\backend"
```

### Step 2: (First time only) Install backend dependencies
```powershell
npm install
```

### Step 3: Start the Backend Service
```powershell
npm run dev
```
- **Backend URL**: [http://localhost:4000](http://localhost:4000)
- **Health Check**: [http://localhost:4000/health](http://localhost:4000/health) → `{"status":"ok","database":"connected"}`

---

## 🟢 Terminal 2: Run the Frontend DApp (Port 3000)
> Hosts the unified application: Main UI, Web3 wallet interface, Polygon Transaction Hub, Supply Chain Logistics Portal, and AI risk dashboard.

### Step 1: Open Terminal 2 (A NEW terminal window/tab)
Make sure you are in the project root:
```powershell
cd "c:\project folder\W_T_F_1-main"
```

### Step 2: (First time only) Install frontend dependencies
```powershell
npm install
```

### Step 3: Start the Frontend App
```powershell
npm run dev
```

### Step 4: Open in Your Browser
- **Main Website**: [http://localhost:3000](http://localhost:3000)
- **Transfer Funds (Polygon Transactions & AI Risk)**: [http://localhost:3000/transfer](http://localhost:3000/transfer)
- **Supply Chain & Shipments**: [http://localhost:3000/shipments](http://localhost:3000/shipments)
  - Create Shipment: [http://localhost:3000/shipments/create](http://localhost:3000/shipments/create)
  - Track Shipment: [http://localhost:3000/shipments/tracking](http://localhost:3000/shipments/tracking)
- **KYC Management (Authoritative Single KYC)**: [http://localhost:3000/kyc](http://localhost:3000/kyc)
- **AI Model Metrics & Analytics**: [http://localhost:3000/ai-analytics](http://localhost:3000/ai-analytics)

---

## 🟡 Terminal 3: (Optional) Local Blockchain Node
> **Only needed if testing on a local Hardhat blockchain instead of Polygon Mainnet.**

```powershell
cd "c:\project folder\W_T_F_1-main\web3"
npx hardhat node
```
*To deploy contracts to this local node, run in another prompt:*
```powershell
cd "c:\project folder\W_T_F_1-main\web3"
npx hardhat run scripts/deploy.js --network localhost
```

---

## 🔵 Terminal 4: (Optional) Test AI Risk Prediction from Terminal
> **Only needed if you want to test Python ML models directly without the browser.**

```powershell
cd "c:\project folder\W_T_F_1-main"
python polygon-ml-dataset/predict_tx.py --to 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 --gas_limit 65000 --gas_price_gwei 35.0 --value_native 0.0
```

---

## ⚡ Quick Cheat Sheet

| Terminal | Path | Command | What It Runs |
| :--- | :--- | :--- | :--- |
| **Terminal 1** | `c:\project folder\W_T_F_1-main\backend` | `npm run dev` | **Backend API Server (Port 4000)** |
| **Terminal 2** | `c:\project folder\W_T_F_1-main` | `npm run dev` | **Frontend DApp (Port 3000)** |
| **Terminal 3** *(Optional)* | `c:\project folder\W_T_F_1-main\web3` | `npx hardhat node` | Local EVM Blockchain (Port 8545) |
