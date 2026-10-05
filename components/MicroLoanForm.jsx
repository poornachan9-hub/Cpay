// components/MicroLoanForm.jsx
// Crypto Lending UI — borrow USDC against crypto collateral
// Matches CoinCrop dark-emerald glassmorphism design system

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { getContractAddresses } from "../lib/constants";
import toast from "react-hot-toast";
import {
  FiDollarSign,
  FiPackage,
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiZap,
  FiInfo,
  FiLoader,
  FiTrendingUp,
} from "react-icons/fi";

// ─── ABI (trimmed — only functions we call) ──────────────────────────────────
export const CROP_LOAN_ABI = [
  {
    inputs: [
      { name: "amountUSDC", type: "uint256" },
      { name: "futureKg", type: "uint256" },
      { name: "termDays", type: "uint256" },
    ],
    name: "borrow",
    outputs: [{ name: "loanId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "repay",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "liquidate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "farmer", type: "address" }],
    name: "getFarmerLoans",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "loans",
    outputs: [
      { name: "id", type: "uint256" },
      { name: "farmer", type: "address" },
      { name: "amountUSDC", type: "uint256" },
      { name: "collateralKg", type: "uint256" },
      { name: "repayBy", type: "uint256" },
      { name: "borrowedAt", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "repayAmount", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "amountUSDC", type: "uint256" }],
    name: "getMinCollateralKg",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "getReserveBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "timeUntilDeadline",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// Must match the USDC ERC-20 approve ABI
const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOAN_STATUS = { Active: 0, Repaid: 1, Liquidated: 2 };
const COLLATERAL_RATIO = 4; // kg per USDC (matches contract: 400%)

function formatUSDC(val) {
  if (!val && val !== 0n) return "—";
  return (Number(BigInt(val)) / 1e6).toFixed(2);
}

function formatKg(val) {
  if (!val && val !== 0n) return "—";
  return (Number(BigInt(val)) / 1e18).toFixed(1);
}

function secondsToCountdown(secs) {
  if (secs <= 0) return "EXPIRED";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function riskLevel(secsLeft) {
  if (secsLeft <= 0) return "liquidatable";
  if (secsLeft <= 3 * 86400) return "high";
  if (secsLeft <= 7 * 86400) return "medium";
  return "safe";
}

const RISK_CONFIG = {
  liquidatable: {
    color: "text-red-400",
    bg: "from-red-600/20 to-red-600/10",
    border: "border-red-500/30",
    label: "⚠ Liquidatable",
  },
  high: {
    color: "text-orange-400",
    bg: "from-orange-600/20 to-red-600/10",
    border: "border-orange-500/30",
    label: "⚠ High Risk",
  },
  medium: {
    color: "text-yellow-400",
    bg: "from-yellow-600/20 to-orange-600/10",
    border: "border-yellow-500/30",
    label: "⚡ Medium Risk",
  },
  safe: {
    color: "text-blue-400",
    bg: "from-blue-600/20 to-indigo-600/10",
    border: "border-blue-500/30",
    label: "✓ Active",
  },
};

const cardStyle = {
  background:
    "linear-gradient(135deg, rgba(15,11,19,0.85) 0%, rgba(22,28,20,0.85) 50%, rgba(15,11,19,0.85) 100%)",
  borderColor: "rgba(52,211,153,0.2)",
};

// ─── LoanCard ────────────────────────────────────────────────────────────────

function LoanCard({ loanId, contractAddress, abi, onRepaid, usdcAddress }) {
  const { address } = useAccount();
  const [secsLeft, setSecsLeft] = useState(null);

  const { data: loanData, refetch: refetchLoan } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "loans",
    args: [BigInt(loanId)],
  });

  const { data: timeLeft } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "timeUntilDeadline",
    args: [BigInt(loanId)],
    watch: true,
  });

  useEffect(() => {
    if (timeLeft !== undefined) setSecsLeft(Number(timeLeft));
    const id = setInterval(
      () =>
        setSecsLeft((p) => (p !== null && p > 0 ? p - 1 : p)),
      1000
    );
    return () => clearInterval(id);
  }, [timeLeft]);

  // Approve then repay
  const { writeContractAsync: approveUSDC, isPending: approving } = useWriteContract();
  const { writeContractAsync: repayLoan, isPending: repaying } = useWriteContract();
  const { writeContractAsync: liquidateLoan, isPending: liquidating } = useWriteContract();

  const handleRepay = async () => {
    if (!loanData) return;
    const repayAmt = loanData[7]; // repayAmount
    try {
      toast.loading("Step 1/2: Approving USDC...", { id: "repay" });
      await approveUSDC({
        address: usdcAddress,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [contractAddress, repayAmt],
      });

      toast.loading("Step 2/2: Repaying loan...", { id: "repay" });
      await repayLoan({
        address: contractAddress,
        abi,
        functionName: "repay",
        args: [BigInt(loanId)],
      });

      toast.success("🎉 Loan repaid!", { id: "repay" });
      refetchLoan();
      onRepaid?.();
    } catch (e) {
      toast.error(e?.shortMessage || "Repay failed", { id: "repay" });
    }
  };

  const handleLiquidate = async () => {
    try {
      toast.loading("Liquidating loan...", { id: "liq" });
      await liquidateLoan({
        address: contractAddress,
        abi,
        functionName: "liquidate",
        args: [BigInt(loanId)],
      });
      toast.success("Loan liquidated", { id: "liq" });
      refetchLoan();
    } catch (e) {
      toast.error(e?.shortMessage || "Liquidation failed", { id: "liq" });
    }
  };

  // Simulate escrow repay (hackathon demo)
  const handleSimulateRepay = async () => {
    try {
      toast.loading("Simulating escrow repayment...", { id: "sim" });
      const res = await fetch(`/api/loans?simulate=true&loanId=${loanId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Escrow credited $${data.revenueUSDC} USDC → repaying...`, { id: "sim" });
        // Trigger actual repay after short delay
        setTimeout(handleRepay, 2000);
      } else {
        toast.error(data.error || "Simulation failed", { id: "sim" });
      }
    } catch (e) {
      toast.error("Simulation failed", { id: "sim" });
    }
  };

  if (!loanData) {
    return (
      <div className="animate-pulse h-24 rounded-xl bg-white/5 border border-white/10" />
    );
  }

  const [, farmer, amountUSDC, collateralKg, repayBy, , status, repayAmount] = loanData;
  const statusNum = Number(status);
  const isActive = statusNum === LOAN_STATUS.Active;
  const isRepaid = statusNum === LOAN_STATUS.Repaid;
  const isLiquidated = statusNum === LOAN_STATUS.Liquidated;
  const isLiquidatable = isActive && secsLeft !== null && secsLeft <= 0;
  const risk = isActive ? riskLevel(secsLeft ?? 999999) : isRepaid ? "safe" : "liquidatable";
  const rc = RISK_CONFIG[risk];
  const isBusy = approving || repaying || liquidating;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative overflow-hidden rounded-2xl backdrop-blur border p-5 ${rc.border}`}
      style={{
        background: `linear-gradient(135deg, ${
          isRepaid
            ? "rgba(16,185,129,0.08), rgba(5,150,105,0.05)"
            : isLiquidated
            ? "rgba(239,68,68,0.08), rgba(185,28,28,0.05)"
            : "rgba(15,11,19,0.85), rgba(22,28,20,0.85)"
        })`,
      }}
    >
      {/* Glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${rc.bg} opacity-60 pointer-events-none`}
      />

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">LOAN #{loanId}</span>
            {isRepaid && (
              <FiCheckCircle className="text-blue-400 w-4 h-4" />
            )}
            {isLiquidated && (
              <FiXCircle className="text-red-400 w-4 h-4" />
            )}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${rc.border} ${rc.color}`}>
            {isRepaid ? "✓ Repaid" : isLiquidated ? "✗ Liquidated" : rc.label}
          </span>
        </div>

        {/* Loan stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-gray-400 mb-1">Borrowed</p>
            <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              ${formatUSDC(amountUSDC)}
            </p>
            <p className="text-xs text-gray-500">USDC</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-gray-400 mb-1">Collateral</p>
            <p className="text-lg font-black text-white">
              {formatKg(collateralKg)}
            </p>
             <p className="text-xs text-gray-500">collateral units</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-gray-400 mb-1">
              {isActive ? "Time Left" : "Repay Amt"}
            </p>
            {isActive ? (
              <p className={`text-lg font-black ${rc.color}`}>
                {secsLeft !== null ? secondsToCountdown(secsLeft) : "—"}
              </p>
            ) : (
              <p className="text-lg font-black text-white">
                ${formatUSDC(repayAmount)}
              </p>
            )}
            <p className="text-xs text-gray-500">
              {isActive ? "deadline" : "USDC"}
            </p>
          </div>
        </div>

        {/* Actions */}
        {isActive && (
          <div className="flex gap-2 flex-wrap">
            {/* Repay */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRepay}
              disabled={isBusy}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-black hover:shadow-[0_0_20px_rgba(52,211,153,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(approving || repaying) ? (
                <FiLoader className="animate-spin w-4 h-4" />
              ) : (
                <FiCheckCircle className="w-4 h-4" />
              )}
              Repay ${formatUSDC(repayAmount)}
            </motion.button>

            {/* Simulate escrow repay */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSimulateRepay}
              disabled={isBusy}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-xs bg-white/10 text-gray-300 border border-white/10 hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
            >
              <FiZap className="w-3.5 h-3.5 text-yellow-400" />
              Demo Auto-Repay
            </motion.button>

            {/* Liquidate (shown if expired) */}
            {isLiquidatable && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleLiquidate}
                disabled={isBusy}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-xs bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-all disabled:opacity-50"
              >
                {liquidating ? (
                  <FiLoader className="animate-spin w-4 h-4" />
                ) : (
                  <FiAlertTriangle className="w-4 h-4" />
                )}
                Liquidate
              </motion.button>
            )}
          </div>
        )}

        {/* Repay deadline display */}
        {isActive && (
          <p className="text-xs text-gray-500 text-right">
            Due:{" "}
            {new Date(Number(repayBy) * 1000).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MicroLoanForm({ cropLoanAddress, usdcAddress }) {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();

  // Form state
  const [amountUSDC, setAmountUSDC] = useState("");
  const [termDays, setTermDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);

  // Derived collateral
  const collateralKg =
    amountUSDC && !isNaN(Number(amountUSDC))
      ? (Number(amountUSDC) * COLLATERAL_RATIO).toFixed(1)
      : null;

  // Contract address guard
  const chainAddresses = [1337, 11155111, 137].includes(Number(chainId))
    ? getContractAddresses(chainId)
    : {};
  const contractAddr = cropLoanAddress || chainAddresses.CROP_LOAN;
  const usdcAddr = usdcAddress || chainAddresses.USDC;

  // Read reserve balance
  const {
    data: reserveBalRaw,
    isError: reserveReadError,
  } = useReadContract({
    address: contractAddr,
    abi: CROP_LOAN_ABI,
    functionName: "getReserveBalance",
    watch: true,
    enabled: !!contractAddr,
  });

  const deploymentReady =
    !!contractAddr && !!usdcAddr && !reserveReadError && reserveBalRaw !== undefined;
  const reserveBalance = reserveBalRaw ? formatUSDC(reserveBalRaw) : "—";

  // Read farmer's loans
  const { data: farmerLoanIds, refetch: refetchLoans } = useReadContract({
    address: contractAddr,
    abi: CROP_LOAN_ABI,
    functionName: "getFarmerLoans",
    args: [address],
    enabled: !!contractAddr && !!address && isConnected,
    watch: true,
  });

  const loanIds = farmerLoanIds ? [...farmerLoanIds].reverse() : [];

  // Borrow flow: approve then borrow
  const { writeContractAsync: approveUSDC, isPending: approving } = useWriteContract();
  const { writeContractAsync: borrowFn, isPending: borrowing } = useWriteContract();
  const isBusy = approving || borrowing;

  const handleBorrow = async () => {
    if (!amountUSDC || isNaN(Number(amountUSDC)) || Number(amountUSDC) <= 0) {
      toast.error("Enter a valid USDC amount");
      return;
    }
    if (!contractAddr || !usdcAddr) {
      toast.error(
        `CropLoan is not configured for chain ${chainId}. Switch to Localhost (1337) or deploy it on this network.`
      );
      return;
    }

    const usdcAmount = BigInt(Math.round(Number(amountUSDC) * 1e6));
    if (reserveBalRaw !== undefined && reserveBalRaw < usdcAmount) {
      toast.error(
        `Insufficient lending reserve. Available: $${formatUSDC(reserveBalRaw)} USDC.`
      );
      return;
    }
    // collateral in kg with 18 decimals: amount * 4 * 1e18
    const kgCollateral = BigInt(Math.round(Number(amountUSDC) * COLLATERAL_RATIO * 1e18));

    try {
      toast.loading("Step 1/2: Approving USDC for collateral...", { id: "borrow" });
      // No USDC pulled from user for borrow — reserve funds it.
      // But approve a small amount in case repay flow needs it later.
      // For the borrow tx itself we only need to call borrow().

      toast.loading("Submitting borrow transaction...", { id: "borrow" });
      const hash = await borrowFn({
        address: contractAddr,
        abi: CROP_LOAN_ABI,
        functionName: "borrow",
        args: [usdcAmount, kgCollateral, BigInt(termDays)],
      });
      toast.loading("Waiting for borrow confirmation...", { id: "borrow" });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Borrow transaction reverted. Check the lending reserve and loan details.");
      }

      toast.success(`Loan active! ${amountUSDC} USDC → wallet`, { id: "borrow" });

      // Save loan to Supabase
      await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmer_id: address,
          amount_usdc: Number(amountUSDC),
          collateral_kg: Number(collateralKg),
          tx_hash: hash,
          repay_by: new Date(Date.now() + termDays * 86400 * 1000).toISOString(),
          status: "active",
        }),
      });

      setAmountUSDC("");
      refetchLoans();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e?.shortMessage || e?.message || "Borrow failed", { id: "borrow" });
    }
  };

  if (!isConnected) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-8 text-center"
        style={cardStyle}
      >
        <FiInfo className="mx-auto w-10 h-10 text-gray-500 mb-3" />
        <p className="text-gray-400 font-medium">
          Connect your wallet to access Lending
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Borrow Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
        style={cardStyle}
      >
        {/* Background accents */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-indigo-600/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                <FiTrendingUp className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                 <h3 className="text-xl font-bold text-white">
                  Borrow Against Collateral
                </h3>
                <p className="text-sm text-gray-400">
                  Pledge crypto collateral → receive USDC instantly
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Reserve Available</p>
              <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                ${reserveBalance} USDC
              </p>
            </div>
          </div>

          {/* Collateral info banner */}
          <div className="flex items-start gap-3 rounded-xl bg-blue-600/10 border border-blue-500/20 p-4 mb-6">
            <FiInfo className="text-blue-400 w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                <span className="text-blue-400 font-bold">150% overcollateralized</span> — each USDC 
                borrowed requires pledging extra crypto collateral.
                Repay within your chosen term (max 30 days) to avoid liquidation.
              </p>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* USDC Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Borrow Amount (USDC)
              </label>
              <div className="relative">
                <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 w-5 h-5" />
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={amountUSDC}
                  onChange={(e) => setAmountUSDC(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 font-bold text-lg focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                />
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {[10, 25, 50, 100].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmountUSDC(String(v))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      amountUSDC === String(v)
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                        : "bg-white/5 border-white/10 text-gray-400 hover:border-blue-500/30"
                    }`}
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {/* Term Slider */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Loan Term: {termDays} days
              </label>
              <div className="pt-3">
                <input
                  type="range"
                  min="7"
                  max="30"
                  step="1"
                  value={termDays}
                  onChange={(e) => setTermDays(Number(e.target.value))}
                  className="w-full accent-blue-400 cursor-pointer"
                />
                <div className="flex justify-between mt-1 text-xs text-gray-600">
                  <span>7 days</span>
                  <span>30 days (max)</span>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-gray-400 mb-1">Repay deadline</p>
                <p className="font-bold text-white text-sm">
                  {new Date(Date.now() + termDays * 86400 * 1000).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short", year: "numeric" }
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Collateral calculator */}
          {collateralKg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl bg-white/5 border border-white/10 p-4 mb-6"
            >
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-1">You Borrow</p>
                  <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                    ${amountUSDC}
                  </p>
                  <p className="text-xs text-gray-500">USDC</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="flex flex-col gap-1 items-center">
                    <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <FiPackage className="text-gray-500 w-4 h-4" />
                    <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <span className="text-[10px] text-gray-600">pledge</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Crypto Collateral</p>
                  <p className="text-2xl font-black text-white">{collateralKg}</p>
                  <p className="text-xs text-gray-500">collateral units</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                <span>Repay due</span>
                <span className="text-orange-400 font-bold">
                  ${(Number(amountUSDC) * 1.02).toFixed(2)} USDC (incl. 2% fee)
                </span>
              </div>
            </motion.div>
          )}

          {/* Borrow button */}
          <motion.button
            whileHover={{ scale: isBusy ? 1 : 1.01 }}
            whileTap={{ scale: isBusy ? 1 : 0.98 }}
            onClick={handleBorrow}
            disabled={isBusy || !amountUSDC || !deploymentReady}
            className="w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-500 text-black hover:shadow-[0_0_40px_rgba(52,211,153,0.5)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isBusy ? (
              <>
                <FiLoader className="animate-spin w-5 h-5" />
                Processing...
              </>
            ) : (
              <>
                <FiZap className="w-5 h-5" />
                Borrow Now
              </>
            )}
          </motion.button>
          {!deploymentReady && (
            <p className="mt-3 text-sm text-amber-300" role="alert">
              {!contractAddr || !usdcAddr
                ? `CropLoan is not configured for chain ${chainId}. Switch MetaMask to Localhost (1337) or deploy it on this network.`
                : reserveReadError
                ? `CropLoan could not be read on chain ${chainId}. Confirm the contract is deployed and the network is available.`
                : "Checking CropLoan deployment..."}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Active Loans ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
        style={cardStyle}
      >
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-cyan-600/8 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30">
                <FiClock className="h-5 w-5 text-cyan-300" />
              </div>
              <h3 className="text-lg font-bold text-white">Your Loans</h3>
              {loanIds.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                  {loanIds.length}
                </span>
              )}
            </div>
            <motion.button
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.4 }}
              onClick={() => { refetchLoans(); setRefreshKey((k) => k + 1); }}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-blue-500/30 transition-all"
            >
              <FiRefreshCw className="w-4 h-4" />
            </motion.button>
          </div>

          {loanIds.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gray-700/30 to-gray-600/20 flex items-center justify-center mx-auto mb-4">
                <FiPackage className="w-7 h-7 text-gray-500" />
              </div>
              <p className="text-gray-400 font-medium mb-2">No loans yet</p>
              <p className="text-sm text-gray-600">
                Borrow above to get started — funds land in your wallet instantly
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {loanIds.map((id) => (
                  <LoanCard
                    key={`${id}-${refreshKey}`}
                    loanId={id.toString()}
                    contractAddress={contractAddr}
                    abi={CROP_LOAN_ABI}
                    usdcAddress={usdcAddr}
                    onRepaid={() => {
                      refetchLoans();
                      setRefreshKey((k) => k + 1);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
