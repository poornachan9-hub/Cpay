// components/TokenPayment.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Two-step ERC20 payment flow on Polygon Mainnet:
//   Step 1 → Approve token spend (MetaMask prompt)
//   Step 2 → Pay / transfer to gateway (MetaMask prompt)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiDollarSign, FiCheckCircle, FiLoader, FiLock,
  FiAlertTriangle, FiArrowRight, FiShield
} from "react-icons/fi";
import toast from "react-hot-toast";
import { ERC20_ABI } from "../lib/wagmi";
import { getContractAddresses } from "../lib/constants";

// ── Minimal Payment Gateway ABI (only what TokenPayment needs) ──
const GATEWAY_ABI = [
  {
    name: "payWithUSDC",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_productId", type: "uint256" },
      { name: "_ipfsHash", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "payWithUSDT",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_productId", type: "uint256" },
      { name: "_ipfsHash", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "products",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "merchant", type: "address" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "ipfsHash", type: "string" },
      { name: "priceETH", type: "uint256" },
      { name: "priceUSDT", type: "uint256" },
      { name: "priceUSDC", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint256" },
      { name: "totalSales", type: "uint256" },
      { name: "totalRevenue", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
  },
];

// POL/USD rough rate for gas estimate display
const POL_TO_INR = 65; // ₹65 per POL (update via API in production)
const GAS_ESTIMATE_POL = 0.003; // ~0.003 POL per tx on Polygon

const STEPS = ["Select Token", "Approve", "Pay", "Confirmed"];

export default function TokenPayment({
  productId,
  productName,
  amountUSDC,  // price in USDC (raw number, e.g. 5.00)
  amountUSDT,  // price in USDT (raw number, e.g. 5.00)
  ipfsHash = "",
  onSuccess,
}) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const chainId = Number(walletChainId || 0);
  const isSupportedNetwork = chainId === 1337 || chainId === 137;
  const networkAddresses = isSupportedNetwork ? getContractAddresses(chainId) : {};
  const networkName = chainId === 1337 ? "Hardhat Local" : "Polygon Mainnet";

  const [selectedToken, setSelectedToken] = useState("USDC");
  const [step, setStep] = useState(0); // 0=select, 1=approving, 2=paying, 3=confirmed
  const [approveTxHash, setApproveTxHash] = useState(null);
  const [payTxHash, setPayTxHash] = useState(null);
  const [approveChainId, setApproveChainId] = useState(null);
  const [payChainId, setPayChainId] = useState(null);
  const [error, setError] = useState("");

  const tokenAddress = selectedToken === "USDC" ? networkAddresses.USDC : networkAddresses.USDT;
  const rawAmount = selectedToken === "USDC" ? amountUSDC : amountUSDT;
  const amountWei = parseUnits(String(rawAmount || "0"), 6); // Both USDC and USDT have 6 decimals
  const gatewayAddress = networkAddresses.PAYMENT_GATEWAY;

  // ── Read wallet balance ──────────────────────────────────────
  const { data: balance = BigInt(0), refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
    chainId: chainId || 1337,
    query: { enabled: !!address && isSupportedNetwork && !!tokenAddress },
  });

  // ── Read current allowance ────────────────────────────────────
  const { data: allowance = BigInt(0) } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address, gatewayAddress],
    chainId: chainId || 1337,
    query: { enabled: !!address && isSupportedNetwork && !!gatewayAddress && !!tokenAddress },
  });

  const balanceFormatted = formatUnits(balance, 6);
  const hasEnoughBalance = balance >= amountWei;
  const alreadyApproved = allowance >= amountWei;
  const gasEstimateINR = (GAS_ESTIMATE_POL * POL_TO_INR).toFixed(2);

  // ── Write: Approve ────────────────────────────────────────────
  const {
    writeContract: approve,
    isPending: isApproving,
    data: approveTx,
    error: approveWriteError,
  } = useWriteContract();

  // ── Write: Pay ────────────────────────────────────────────────
  const {
    writeContract: pay,
    isPending: isPaying,
    data: payTx,
    error: payWriteError,
  } = useWriteContract();

  // ── Wait for approve tx ───────────────────────────────────────
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    chainId: approveChainId || chainId || 1337,
    query: { enabled: !!approveTxHash && !!approveChainId },
  });

  // ── Wait for pay tx ───────────────────────────────────────────
  const { isSuccess: payConfirmed } = useWaitForTransactionReceipt({
    hash: payTxHash,
    chainId: payChainId || chainId || 1337,
    query: { enabled: !!payTxHash && !!payChainId },
  });

  // Watch for approve TX hash
  useEffect(() => {
    if (approveTx) setApproveTxHash(approveTx);
  }, [approveTx]);

  // When approve confirms → advance to pay step
  useEffect(() => {
    if (approveConfirmed && step === 1) {
      toast.success("Token approved! Now completing payment...");
      setStep(2);
      handlePay(approveChainId || chainId);
    }
  }, [approveConfirmed]);

  // Watch for pay TX hash
  useEffect(() => {
    if (payTx) setPayTxHash(payTx);
  }, [payTx]);

  // When payment confirms → done
  useEffect(() => {
    if (payConfirmed) {
      setStep(3);
      toast.success(`Payment confirmed on ${networkName}! 🎉`);
      refetchBalance();
      if (onSuccess) onSuccess({ txHash: payTxHash, token: selectedToken });
      // Notify backend
      notifyBackend();
    }
  }, [payConfirmed]);

  // Error handling
  useEffect(() => {
    if (approveWriteError) {
      const msg = approveWriteError.shortMessage || approveWriteError.message;
      setError(msg);
      setStep(0);
      toast.error("Approval failed: " + msg);
    }
  }, [approveWriteError]);

  useEffect(() => {
    if (payWriteError) {
      const msg = payWriteError.shortMessage || payWriteError.message;
      setError(msg);
      setStep(0);
      toast.error("Payment failed: " + msg);
    }
  }, [payWriteError]);

  const notifyBackend = async () => {
    try {
      await fetch("/api/payments/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          buyer_wallet: address,
          token_symbol: selectedToken,
          token_address: tokenAddress,
          token_amount: rawAmount,
          tx_hash: payTxHash,
          chain_id: payChainId || chainId,
        }),
      });
    } catch (e) {
      console.warn("Could not notify backend:", e.message);
    }
  };

  const handleApprove = (targetChainId = chainId) => {
    if (!gatewayAddress) {
      toast.error("Payment gateway is not configured for this network.");
      return;
    }
    if (!hasEnoughBalance) {
      toast.error(`Insufficient ${selectedToken} balance`);
      return;
    }
    setError("");
    setStep(1);
    setApproveChainId(targetChainId);
    approve({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [gatewayAddress, amountWei],
      chainId: targetChainId,
    });
  };

  const handlePay = (targetChainId = chainId) => {
    setPayChainId(targetChainId);
    pay({
      address: gatewayAddress,
      abi: GATEWAY_ABI,
      functionName: selectedToken === "USDC" ? "payWithUSDC" : "payWithUSDT",
      args: [BigInt(productId), ipfsHash || ""],
      chainId: targetChainId,
    });
  };

  const handleStartPayment = () => {
    if (!isSupportedNetwork) {
      toast.error("Switch to Hardhat Local or Polygon before paying.");
      return;
    }
    if (alreadyApproved) {
      // Skip approve step — already approved
      setStep(2);
      handlePay(chainId);
    } else {
      handleApprove(chainId);
    }
  };

  const reset = () => {
    setStep(0);
    setError("");
    setApproveTxHash(null);
    setPayTxHash(null);
    setApproveChainId(null);
    setPayChainId(null);
  };

  if (!isConnected) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "#9ca3af", textAlign: "center" }}>
          Connect your MetaMask wallet to pay
        </p>
      </div>
    );
  }

  if (!isSupportedNetwork) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "#fbbf24", textAlign: "center" }}>
          Switch your wallet to Hardhat Local or Polygon to pay.
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <div style={iconCircle("#8b5cf6")}>
          <FiShield size={20} color="#a855f7" />
        </div>
        <div>
          <h3 style={{ color: "#ffffff", fontWeight: 700, fontSize: "18px", margin: 0 }}>
            Escrow Payment
          </h3>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>
            {productName} · {networkName}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Confirmed state */}
      {step === 3 ? (
        <ConfirmedView token={selectedToken} amount={rawAmount} txHash={payTxHash} />
      ) : (
        <>
          {/* Token selector */}
          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Pay with</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {["USDC", "USDT"].map((t) => (
                <motion.button
                  key={t}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedToken(t)}
                  disabled={step > 0}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: `2px solid ${selectedToken === t ? "#8b5cf6" : "rgba(75,85,99,0.4)"}`,
                    background: selectedToken === t
                      ? "rgba(139,92,246,0.12)"
                      : "rgba(31,27,44,0.6)",
                    color: selectedToken === t ? "#a855f7" : "#9ca3af",
                    fontWeight: 700,
                    fontSize: "15px",
                    cursor: step > 0 ? "not-allowed" : "pointer",
                    opacity: step > 0 ? 0.6 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  💵 {t}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Amount + balance */}
          <div style={infoRow}>
            <span style={{ color: "#6b7280", fontSize: "13px" }}>Amount</span>
            <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "16px" }}>
              {rawAmount} {selectedToken}
            </span>
          </div>
          <div style={infoRow}>
            <span style={{ color: "#6b7280", fontSize: "13px" }}>Your balance</span>
            <span style={{
              color: hasEnoughBalance ? "#60a5fa" : "#ef4444",
              fontWeight: 600,
              fontSize: "14px",
              fontFamily: "monospace",
            }}>
              {parseFloat(balanceFormatted).toFixed(2)} {selectedToken}
            </span>
          </div>
          <div style={{ ...infoRow, marginBottom: "24px" }}>
            <span style={{ color: "#6b7280", fontSize: "13px" }}>Est. gas fee</span>
            <span style={{ color: "#f59e0b", fontSize: "13px" }}>
              ~₹{gasEstimateINR} (~{GAS_ESTIMATE_POL} POL)
            </span>
          </div>

          {/* Insufficient balance warning */}
          {!hasEnoughBalance && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: "12px 14px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "10px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <FiAlertTriangle color="#ef4444" size={16} />
              <p style={{ color: "#fca5a5", fontSize: "13px", margin: 0 }}>
                Insufficient {selectedToken} balance. Please top up your wallet.
              </p>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: "12px 14px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "10px",
                marginBottom: "16px",
              }}
            >
              <p style={{ color: "#fca5a5", fontSize: "13px", margin: 0 }}>⚠️ {error}</p>
            </motion.div>
          )}

          {/* Step status messages */}
          {step === 1 && (
            <StatusBanner icon={<FiLoader size={16} style={{ animation: "spin 1s linear infinite" }} />}
              text="Step 1/2: Approve token spend in MetaMask…" color="#f59e0b" />
          )}
          {step === 2 && (
            <StatusBanner icon={<FiLoader size={16} style={{ animation: "spin 1s linear infinite" }} />}
              text="Step 2/2: Confirm payment in MetaMask…" color="#8b5cf6" />
          )}

          {/* CTA Button */}
          {step === 0 && (
            <motion.button
              whileHover={{ scale: hasEnoughBalance ? 1.02 : 1 }}
              whileTap={{ scale: hasEnoughBalance ? 0.98 : 1 }}
              onClick={handleStartPayment}
              disabled={!hasEnoughBalance || !gatewayAddress}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                background: hasEnoughBalance && gatewayAddress
                  ? "linear-gradient(135deg, #8b5cf6, #a855f7)"
                  : "rgba(75,85,99,0.4)",
                border: "none",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "16px",
                cursor: hasEnoughBalance && gatewayAddress ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                boxShadow: hasEnoughBalance && gatewayAddress
                  ? "0 4px 20px rgba(139,92,246,0.4)"
                  : "none",
                transition: "all 0.2s ease",
              }}
            >
              <FiLock size={18} />
              {alreadyApproved ? "Pay Now" : `Approve & Pay ${rawAmount} ${selectedToken}`}
              <FiArrowRight size={18} />
            </motion.button>
          )}
        </>
      )}

      {step === 3 && (
        <button onClick={reset} style={secondaryBtn}>Make another payment</button>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StepIndicator({ current }) {
  const steps = ["Token", "Approve", "Pay", "Done"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "24px", gap: "4px" }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: i < current
              ? "linear-gradient(135deg, #8b5cf6, #a855f7)"
              : i === current
              ? "rgba(139,92,246,0.2)"
              : "rgba(75,85,99,0.3)",
            border: i === current ? "2px solid #8b5cf6" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            color: i <= current ? "#ffffff" : "#6b7280",
            fontWeight: 700,
            flexShrink: 0,
            transition: "all 0.3s ease",
          }}>
            {i < current ? <FiCheckCircle size={14} /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1,
              height: "2px",
              background: i < current ? "#8b5cf6" : "rgba(75,85,99,0.3)",
              margin: "0 4px",
              transition: "all 0.3s ease",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function ConfirmedView({ token, amount, txHash }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ textAlign: "center", padding: "16px 0" }}
    >
      {/* Vault animation */}
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: 2, duration: 0.4 }}
        style={{ fontSize: "56px", marginBottom: "16px" }}
      >
        🔒
      </motion.div>
      <h3 style={{ color: "#60a5fa", fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
        Payment Locked in Escrow!
      </h3>
      <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "20px" }}>
        {amount} {token} secured on Polygon Mainnet
      </p>
      {txHash && (
        <a
          href={`https://polygonscan.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#8b5cf6",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            textDecoration: "none",
          }}
        >
          View on Polygonscan ↗
        </a>
      )}
    </motion.div>
  );
}

function StatusBanner({ icon, text, color }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "12px 14px",
      background: `${color}14`,
      border: `1px solid ${color}33`,
      borderRadius: "10px",
      marginBottom: "16px",
      color,
      fontSize: "13px",
      fontWeight: 600,
    }}>
      {icon}
      {text}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const cardStyle = {
  background: "linear-gradient(135deg, rgba(26,17,38,0.95) 0%, rgba(15,10,22,0.95) 100%)",
  border: "1px solid rgba(139,92,246,0.2)",
  borderRadius: "20px",
  padding: "28px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

const infoRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
  paddingBottom: "12px",
  borderBottom: "1px solid rgba(75,85,99,0.2)",
};

const labelStyle = {
  display: "block",
  color: "#9ca3af",
  fontSize: "13px",
  fontWeight: 600,
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const secondaryBtn = {
  width: "100%",
  marginTop: "16px",
  padding: "12px",
  borderRadius: "10px",
  background: "rgba(75,85,99,0.3)",
  border: "1px solid rgba(75,85,99,0.4)",
  color: "#9ca3af",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};

const iconCircle = (color) => ({
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  background: `${color}20`,
  border: `1px solid ${color}40`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});
