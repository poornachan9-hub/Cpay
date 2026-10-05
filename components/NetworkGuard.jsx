// components/NetworkGuard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Wraps page content. If MetaMask is on any chain other than Polygon (137)
// or Localhost (1337), shows a full-screen overlay with a "Switch Network" button.
// If wallet is not connected, renders children normally (handled elsewhere).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useChainId, useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { FiAlertTriangle, FiZap, FiLoader } from "react-icons/fi";

const POLYGON_CHAIN_ID = 137;
const LOCALHOST_CHAIN_ID = 1337;

// Polygon Mainnet chain params for wallet_addEthereumChain
const POLYGON_CHAIN_PARAMS = {
  chainId: "0x89", // 137 in hex
  chainName: "Polygon Mainnet",
  nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls: [
    "https://polygon-rpc.com",
    "https://rpc-mainnet.maticvigil.com",
    "https://matic-mainnet.chainstacklabs.com",
  ],
  blockExplorerUrls: ["https://polygonscan.com"],
};

// Localhost chain params for wallet_addEthereumChain
const LOCALHOST_CHAIN_PARAMS = {
  chainId: "0x539", // 1337 in hex
  chainName: "Localhost 8545",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: ["http://127.0.0.1:8545"],
  blockExplorerUrls: [],
};

export default function NetworkGuard({ children }) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  const isCorrectNetwork =
    !isConnected || chainId === POLYGON_CHAIN_ID || chainId === LOCALHOST_CHAIN_ID;

  const getNetworkName = (id) => {
    if (id === POLYGON_CHAIN_ID) return "Polygon Mainnet";
    if (id === LOCALHOST_CHAIN_ID) return "Localhost 8545";
    return `Chain ID ${id}`;
  };

  const getTargetChainParams = () => {
    if (chainId === LOCALHOST_CHAIN_ID) {
      return { chainId: "0x539", params: LOCALHOST_CHAIN_PARAMS };
    }
    return { chainId: "0x89", params: POLYGON_CHAIN_PARAMS };
  };

  const switchToCorrectNetwork = async () => {
    if (!window.ethereum) {
      setError("MetaMask not found. Please install MetaMask.");
      return;
    }
    setSwitching(true);
    setError("");
    try {
      const target = getTargetChainParams();
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: target.chainId }],
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        try {
          const target = getTargetChainParams();
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [target.params],
          });
        } catch (addErr) {
          if (addErr.code !== 4001) {
            setError("Could not add network: " + addErr.message);
          }
        }
      } else if (switchErr.code !== 4001) {
        setError("Network switch failed: " + switchErr.message);
      }
    } finally {
      setSwitching(false);
    }
  };

  const isOnLocalhost = chainId === LOCALHOST_CHAIN_ID;

  return (
    <>
      {children}

      {/* Full-screen overlay when on wrong network */}
      <AnimatePresence>
        {!isCorrectNetwork && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{
              background:
                "linear-gradient(135deg, rgba(10,7,15,0.97) 0%, rgba(20,13,25,0.97) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              style={{
                background:
                  "linear-gradient(135deg, rgba(26,17,38,0.95) 0%, rgba(15,10,22,0.95) 100%)",
                border: "1px solid rgba(139,92,246,0.3)",
                borderRadius: "24px",
                padding: "48px 40px",
                maxWidth: "460px",
                width: "100%",
                boxShadow:
                  "0 25px 60px rgba(0,0,0,0.6), 0 0 80px rgba(139,92,246,0.08)",
                textAlign: "center",
              }}
            >
              {/* Network icon / warning */}
              <motion.div
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.2))",
                  border: "2px solid rgba(139,92,246,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  fontSize: "32px",
                }}
              >
                <FiAlertTriangle color="#a855f7" size={32} />
              </motion.div>

              <h2
                style={{
                  color: "#ffffff",
                  fontSize: "24px",
                  fontWeight: 700,
                  marginBottom: "12px",
                  letterSpacing: "-0.02em",
                }}
              >
                Wrong Network
              </h2>

              <p
                style={{
                  color: "#9ca3af",
                  fontSize: "15px",
                  lineHeight: "1.6",
                  marginBottom: "8px",
                }}
              >
                {isOnLocalhost ? "Local development mode" : "CoinCrop runs on"}{" "}
                <span style={{ color: "#a855f7", fontWeight: 600 }}>
                  {isOnLocalhost ? "Localhost 8545" : "Polygon Mainnet"}
                </span>
                .
              </p>
              <p
                style={{
                  color: "#6b7280",
                  fontSize: "13px",
                  marginBottom: "32px",
                }}
              >
                Currently connected to{" "}
                <span
                  style={{
                    color: "#ef4444",
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {getNetworkName(chainId)}
                </span>
                &nbsp;— expected{" "}
                <span
                  style={{
                    color: "#60a5fa",
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  137 / 1337
                </span>
              </p>

              {/* Switch button */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={switchToCorrectNetwork}
                disabled={switching}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  borderRadius: "12px",
                  background: switching
                    ? "rgba(139,92,246,0.3)"
                    : "linear-gradient(135deg, #8b5cf6, #a855f7)",
                  border: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "16px",
                  cursor: switching ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  boxShadow: switching
                    ? "none"
                    : "0 4px 20px rgba(139,92,246,0.4)",
                  transition: "all 0.2s ease",
                }}
              >
                {switching ? (
                  <>
                    <FiLoader
                      size={18}
                      style={{
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Switching...
                  </>
                ) : (
                  <>
                    <FiZap size={18} />
                    Switch to {isOnLocalhost ? "Localhost 8545" : "Polygon Mainnet"}
                  </>
                )}
              </motion.button>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    color: "#ef4444",
                    fontSize: "13px",
                    marginTop: "16px",
                    padding: "10px 14px",
                    background: "rgba(239,68,68,0.1)",
                    borderRadius: "8px",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  ⚠️ {error}
                </motion.p>
              )}

              <p
                style={{
                  color: "#4b5563",
                  fontSize: "12px",
                  marginTop: "20px",
                }}
              >
                {isOnLocalhost
                  ? "Local development mode — no real funds needed"
                  : "Real USDC / USDT payments on Polygon Mainnet"}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
