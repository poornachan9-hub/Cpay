// components/WithdrawToBank.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full USDC/USDT → INR bank withdrawal via Mudrex off-ramp.
// Status flow: Initiated → Processing → Done
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiDollarSign, FiArrowRight, FiX, FiCheckCircle,
  FiLoader, FiClock, FiAlertTriangle, FiCopy
} from "react-icons/fi";
import toast from "react-hot-toast";

const OFFRAMP_STATUSES = [
  { key: "initiated", label: "Initiated", icon: "🟡", desc: "Request sent to Mudrex" },
  { key: "processing", label: "Processing", icon: "🔵", desc: "Crypto being converted to INR" },
  { key: "done", label: "Complete", icon: "✅", desc: "INR credited to your bank" },
];

export default function WithdrawToBank({ usdcBalance = 0, usdtBalance = 0 }) {
  const { address } = useAccount();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [holderName, setHolderName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);   // { order_id, estimated_inr, status, eta }
  const [error, setError] = useState("");

  const maxBalance = selectedToken === "USDC" ? usdcBalance : usdtBalance;
  const parsedAmount = parseFloat(amount) || 0;
  const estimatedINR = result?.estimated_inr
    ? parseFloat(result.estimated_inr).toLocaleString("en-IN")
    : null;

  const validateForm = () => {
    if (!parsedAmount || parsedAmount <= 0) return "Enter a valid amount";
    if (parsedAmount > maxBalance) return `Insufficient ${selectedToken} balance`;
    if (!holderName.trim() || holderName.trim().length < 2) return "Enter account holder name";
    if (!bankAccount || bankAccount.length < 9) return "Enter a valid bank account number";
    if (!ifscCode || ifscCode.length !== 11) return "Enter a valid 11-character IFSC code";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) return "Invalid IFSC format (e.g. SBIN0001234)";
    return null;
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/offramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cryptoAmount: parsedAmount,
          tokenSymbol: selectedToken,
          userWallet: address || "",
          userBankIFSC: ifscCode.toUpperCase(),
          userBankAccount: bankAccount,
          userPhone: "",
          holderName: holderName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Off-ramp failed");

      setResult(data);
      if (data.notification?.sent) {
        toast.success("Withdrawal request submitted; merchant SMS accepted.");
      } else {
        toast.error(`Withdrawal request submitted, but merchant SMS failed: ${data.notification?.reason || "unknown Twilio error"}`);
      }

    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setResult(null);
    setError("");
    setAmount("");
    setBankAccount("");
    setIfscCode("");
    setHolderName("");
  };

  const copyOrderId = () => {
    if (result?.order_id) {
      navigator.clipboard.writeText(result.order_id);
      toast.success("Order ID copied!");
    }
  };

  return (
    <>
      {/* Trigger button */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(true)}
        id="withdraw-to-bank-btn"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 20px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #059669, #10b981)",
          border: "none",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: "14px",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(16,185,129,0.35)",
        }}
      >
        <FiDollarSign size={16} />
        Withdraw to Bank
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{
                background: "linear-gradient(135deg, #1a1126 0%, #0f0a16 100%)",
                border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: "24px",
                padding: "32px",
                width: "100%",
                maxWidth: "460px",
                position: "relative",
                boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              {/* Close */}
              <button
                onClick={closeModal}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "rgba(75,85,99,0.2)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px",
                  cursor: "pointer",
                  color: "#9ca3af",
                }}
              >
                <FiX size={18} />
              </button>

              {!result ? (
                <>
                  <div style={{ marginBottom: "24px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🏦</div>
                    <h2 style={{ color: "#ffffff", fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>
                      Withdraw to Bank
                    </h2>
                    <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>
                      Convert USDC/USDT → INR via Mudrex · Arrives in ~24h
                    </p>
                  </div>

                  {/* Token selector */}
                  <div style={{ marginBottom: "20px" }}>
                    <label style={labelStyle}>Select token</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      {["USDC", "USDT"].map((t) => (
                        <button
                          key={t}
                          onClick={() => { setSelectedToken(t); setAmount(""); }}
                          style={{
                            flex: 1,
                            padding: "10px",
                            borderRadius: "10px",
                            border: `2px solid ${selectedToken === t ? "#10b981" : "rgba(75,85,99,0.3)"}`,
                            background: selectedToken === t ? "rgba(16,185,129,0.1)" : "rgba(31,27,44,0.5)",
                            color: selectedToken === t ? "#10b981" : "#9ca3af",
                            fontWeight: 700,
                            fontSize: "14px",
                            cursor: "pointer",
                          }}
                        >
                          {t}
                          <span style={{ display: "block", fontSize: "11px", opacity: 0.7, marginTop: "2px" }}>
                            {t === "USDC" ? usdcBalance.toFixed(2) : usdtBalance.toFixed(2)} available
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleWithdraw} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Amount */}
                    <div>
                      <label style={labelStyle}>Amount ({selectedToken})</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder={`0.00`}
                          max={maxBalance}
                          min="1"
                          step="0.01"
                          required
                          style={inputStyle}
                        />
                        <button
                          type="button"
                          onClick={() => setAmount(maxBalance.toString())}
                          style={{
                            position: "absolute",
                            right: "10px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "rgba(16,185,129,0.2)",
                            border: "none",
                            borderRadius: "6px",
                            color: "#10b981",
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "4px 8px",
                            cursor: "pointer",
                          }}
                        >
                          MAX
                        </button>
                      </div>
                      {parsedAmount > 0 && (
                        <p style={{ color: "#10b981", fontSize: "12px", marginTop: "4px" }}>
                          ≈ ₹{(parsedAmount * 86).toLocaleString("en-IN")} estimated (excl. fees)
                        </p>
                      )}
                    </div>

                    {/* Holder name */}
                    <div>
                      <label style={labelStyle}>Account holder name</label>
                      <input
                        type="text"
                        value={holderName}
                        onChange={(e) => setHolderName(e.target.value)}
                        placeholder="As per bank records"
                        required
                        style={inputStyle}
                      />
                    </div>

                    {/* Bank account */}
                    <div>
                      <label style={labelStyle}>Bank account number</label>
                      <input
                        type="password"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        placeholder="••••••••••"
                        required
                        style={inputStyle}
                      />
                    </div>

                    {/* IFSC */}
                    <div>
                      <label style={labelStyle}>IFSC code</label>
                      <input
                        type="text"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                        placeholder="SBIN0001234"
                        maxLength={11}
                        required
                        style={{ ...inputStyle, fontFamily: "monospace", textTransform: "uppercase" }}
                      />
                    </div>

                    {error && (
                      <div style={{
                        padding: "12px 14px",
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#fca5a5",
                        fontSize: "13px",
                      }}>
                        <FiAlertTriangle size={14} /> {error}
                      </div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: "12px",
                        background: loading
                          ? "rgba(16,185,129,0.3)"
                          : "linear-gradient(135deg, #059669, #10b981)",
                        border: "none",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "16px",
                        cursor: loading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        boxShadow: loading ? "none" : "0 4px 16px rgba(16,185,129,0.35)",
                        marginTop: "8px",
                      }}
                    >
                      {loading ? (
                        <><FiLoader size={18} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
                      ) : (
                        <>Withdraw ₹{parsedAmount > 0 ? `~${(parsedAmount * 86).toLocaleString("en-IN")}` : "---"} <FiArrowRight size={18} /></>
                      )}
                    </motion.button>
                  </form>
                </>
              ) : (
                /* ── Success State ── */
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 14 }}
                    style={{ fontSize: "56px", marginBottom: "16px" }}
                  >
                    🎉
                  </motion.div>
                  <h3 style={{ color: "#10b981", fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
                    Withdrawal Initiated!
                  </h3>
                  <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "24px" }}>
                    You&apos;re receiving approximately{" "}
                    <span style={{ color: "#10b981", fontWeight: 700 }}>₹{estimatedINR}</span>
                  </p>
                  <p style={{ color: result.notification?.sent ? "#6ee7b7" : "#fcd34d", fontSize: "12px", marginBottom: "20px" }}>
                    {result.notification?.sent
                      ? "Twilio accepted the merchant notification request."
                      : `Merchant SMS was not accepted: ${result.notification?.reason || "unknown Twilio error"}`}
                  </p>

                  {/* Status tracker */}
                  <div style={{ marginBottom: "24px" }}>
                    {OFFRAMP_STATUSES.map((s, i) => (
                      <div key={s.key} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: i === 0 ? "rgba(16,185,129,0.1)" : "transparent",
                        marginBottom: "4px",
                        border: i === 0 ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent",
                      }}>
                        <span style={{ fontSize: "18px" }}>{s.icon}</span>
                        <div style={{ textAlign: "left" }}>
                          <p style={{ color: i === 0 ? "#10b981" : "#6b7280", fontWeight: 600, fontSize: "13px", margin: 0 }}>
                            {s.label}
                          </p>
                          <p style={{ color: "#4b5563", fontSize: "12px", margin: 0 }}>{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order ID */}
                  {result.order_id && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "rgba(75,85,99,0.15)",
                      borderRadius: "10px",
                      marginBottom: "16px",
                      gap: "8px",
                    }}>
                      <div style={{ textAlign: "left" }}>
                        <p style={{ color: "#6b7280", fontSize: "11px", margin: "0 0 2px" }}>Mudrex Order ID</p>
                        <p style={{ color: "#d1d5db", fontFamily: "monospace", fontSize: "12px", margin: 0 }}>
                          {result.order_id}
                        </p>
                      </div>
                      <button onClick={copyOrderId} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                        <FiCopy size={16} />
                      </button>
                    </div>
                  )}

                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    color: "#6b7280",
                    fontSize: "13px",
                    marginBottom: "24px",
                  }}>
                    <FiClock size={14} />
                    Estimated arrival: <strong style={{ color: "#9ca3af" }}>within 24 hours</strong>
                  </div>

                  <button onClick={closeModal} style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(75,85,99,0.3)",
                    border: "1px solid rgba(75,85,99,0.4)",
                    color: "#9ca3af",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}>
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

const labelStyle = {
  display: "block",
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 600,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle = {
  width: "100%",
  background: "rgba(31,27,44,0.8)",
  border: "1px solid rgba(75,85,99,0.4)",
  borderRadius: "10px",
  padding: "12px 14px",
  color: "#ffffff",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease",
};
