import { useState } from "react";
import { ethers } from "ethers";
import MockERC20ABI from "../artifacts/contracts/MockERC20.sol/MockERC20.json";
; // adjust path if needed

export default function FaucetButton() {
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState("");
  const [error, setError] = useState("");
  
  // Replace with your actual deployed MockERC20 address
  const CONTRACT_ADDRESS =  "0x5FbDB2315678afecb367f032d93F642f64180aa3";


  async function handleFaucet() {
    setLoading(true);
    setTx("");
    setError("");
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const token = new ethers.Contract(CONTRACT_ADDRESS, MockERC20ABI.abi, signer);

      const amount = ethers.utils.parseUnits("1000", 18); // 1000 tokens
      const txn = await token.faucet(amount);
      await txn.wait();
      setTx(txn.hash);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div>
      <button onClick={handleFaucet} disabled={loading}>
        {loading ? "Minting..." : "Get Test Tokens"}
      </button>
      {tx && <div>Success! Tx: {tx.slice(0, 10)}...</div>}
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
    </div>
  );
}
