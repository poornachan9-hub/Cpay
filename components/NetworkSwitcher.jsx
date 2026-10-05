// components/NetworkSwitcher.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Compact inline network badge + one-click Polygon switcher.
// For full-screen blocking guard, use NetworkGuard.jsx instead.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useChainId } from "wagmi";

const POLYGON_CHAIN_ID = 137;

const NETWORKS = {
  1337: { name: "Localhost (Hardhat)", color: "#f59e0b", badge: "🟡 LOCAL" },
  137:  { name: "Polygon Mainnet",     color: "#8b5cf6", badge: "🟣 POLYGON" },
};

const POLYGON_CHAIN_PARAMS = {
  chainId: "0x89", // 137 in hex
  chainName: "Polygon Mainnet",
  nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls: [
    "https://polygon-rpc.com",
    "https://rpc-mainnet.maticvigil.com",
  ],
  blockExplorerUrls: ["https://polygonscan.com"],
};

export default function NetworkSwitcher() {
  const chainId = useChainId();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  const current = NETWORKS[chainId] || {
    name: `Unknown (${chainId})`,
    color: "#ef4444",
    badge: "⚠️ WRONG NETWORK",
  };
  const isOnPolygon = chainId === POLYGON_CHAIN_ID;

  const switchToPolygon = async () => {
    if (!window.ethereum) return setError("MetaMask not found");
    setSwitching(true);
    setError("");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x89" }],
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [POLYGON_CHAIN_PARAMS],
          });
        } catch (addErr) {
          setError("Could not add Polygon: " + addErr.message);
        }
      } else if (switchErr.code !== 4001) {
        setError("Switch failed: " + switchErr.message);
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15,10,22,0.9) 0%, rgba(26,17,38,0.9) 100%)",
      border: `1px solid ${current.color}44`,
      borderRadius: "12px",
      padding: "10px 16px",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "10px",
      marginBottom: "16px",
      backdropFilter: "blur(10px)",
    }}>
      <span style={{ fontWeight: 700, color: current.color, fontSize: "13px" }}>
        {current.badge}&nbsp;{current.name}
      </span>

      <span style={{ color: "#6b7280", fontSize: "12px" }}>
        Chain ID: {chainId}
      </span>

      {!isOnPolygon && (
        <button
          onClick={switchToPolygon}
          disabled={switching}
          style={{
            padding: "5px 14px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #8b5cf6, #a855f7)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "12px",
            border: "none",
            cursor: switching ? "not-allowed" : "pointer",
            opacity: switching ? 0.7 : 1,
          }}
        >
          {switching ? "Switching…" : "⚡ Switch to Polygon"}
        </button>
      )}

      {isOnPolygon && (
        <span style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600 }}>
          ✅ Polygon Mainnet · Ready
        </span>
      )}

      {error && (
        <span style={{ color: "#ef4444", fontSize: "12px" }}>⚠️ {error}</span>
      )}
    </div>
  );
}
