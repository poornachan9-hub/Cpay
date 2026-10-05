import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiDollarSign,
  FiClock,
  FiCheck,
  FiAlertCircle,
  FiRefreshCw,
  FiDownload,
  FiEye,
  FiCalendar,
  FiTrendingUp,
  FiArrowRight,
  FiCreditCard,
  FiActivity,
  FiZap,
  FiX,
  FiSend,
  FiDatabase,
  FiShield,
} from "react-icons/fi";
import { TfiWallet } from "react-icons/tfi";

import { SiEthereum } from "react-icons/si";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import { contractService } from "../services/contract";
import { TOKEN_NAMES, PAYMENT_TOKENS, PAYOUT_INTERVAL } from "../lib/constants";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";

const Payouts = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [payoutData, setPayoutData] = useState({
    pending: { ETH: "0", USDT: "0", USDC: "0" },
    analytics: null,
    history: [],
    loading: true,
  });

  const [processingPayout, setProcessingPayout] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  // Mock ABI - replace with your actual ABI
  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    if (isConnected && address) {
      loadPayoutData();
    }
  }, [isConnected, address]);

  const loadPayoutData = async () => {
    try {
      setPayoutData((prev) => ({ ...prev, loading: true }));

      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);

      // Load pending payouts
      const pendingResult = await contractService.getPendingPayouts(
        contract,
        address
      );

      // Load merchant analytics
      const analyticsResult = await contractService.getMerchantAnalytics(
        contract,
        address
      );

      // Load payout history (you might need to add this to your contract service)
      const historyResult = (await contractService.getPayoutHistory?.(
        contract
      )) || { success: false };

      setPayoutData({
        pending: pendingResult.success
          ? pendingResult.data
          : { ETH: "0", USDT: "0", USDC: "0" },
        analytics: analyticsResult.success ? analyticsResult.data : null,
        history: historyResult.success
          ? historyResult.data.filter((p) => p.merchant === address)
          : [],
        loading: false,
      });
    } catch (error) {
      console.error("Error loading payout data:", error);
      toast.error("Failed to load payout data");
      setPayoutData((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleProcessPayout = async (token) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      setProcessingPayout(token);
      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );

      const result = await contractService.processPayout(
        contract,
        address,
        token
      );

      if (result.success) {
        toast.success(`${TOKEN_NAMES[token]} payout processed successfully!`);
        await loadPayoutData();
      } else {
        toast.error(result.error || "Failed to process payout");
      }
    } catch (error) {
      console.error("Error processing payout:", error);
      toast.error("Failed to process payout");
    } finally {
      setProcessingPayout(null);
    }
  };

  const canProcessPayout = (token) => {
    const pendingAmount = parseFloat(payoutData.pending[TOKEN_NAMES[token]]);
    if (pendingAmount <= 0) return false;

    // Check if payout interval has passed
    const lastPayoutTime = payoutData.analytics?.lastPayoutTime || 0;
    const now = Math.floor(Date.now() / 1000);

    return now - parseInt(lastPayoutTime) >= PAYOUT_INTERVAL;
  };

  const getNextPayoutTime = () => {
    const lastPayoutTime = payoutData.analytics?.lastPayoutTime || 0;
    const nextPayoutTime = parseInt(lastPayoutTime) + PAYOUT_INTERVAL;
    const now = Math.floor(Date.now() / 1000);

    if (nextPayoutTime <= now) return "Available now";

    const timeLeft = nextPayoutTime - now;
    const days = Math.floor(timeLeft / (24 * 60 * 60));
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getTotalPendingValue = () => {
    const ethValue = parseFloat(payoutData.pending.ethAmount) * 2500; // Mock ETH price
    const usdtValue = parseFloat(payoutData.pending.usdtAmount);
    const usdcValue = parseFloat(payoutData.pending.usdcAmount);
    return ethValue + usdtValue + usdcValue;
  };

  const openPayoutModal = (token) => {
    setSelectedToken(token);
    setShowPayoutModal(true);
  };

  const getTokenConfig = (token) => {
    const configs = {
      [PAYMENT_TOKENS.ETH]: {
        name: "Ethereum",
        symbol: "ETH",
        icon: <img src="/ethereum.svg" alt="ETH" width="15" height="15" />,
        gradient: "from-blue-600 to-blue-600",
        bgGradient: "from-blue-600/10 to-blue-600/10",
        border: "border-blue-500/30",
        text: "text-blue-300",
      },
      [PAYMENT_TOKENS.USDT]: {
        name: "Tether USD",
        symbol: "USDT",
        icon: <img src="/usdt.svg" alt="USDT" width="22" height="22" />,
        gradient: "from-blue-600 to-cyan-600",
        bgGradient: "from-blue-600/10 to-cyan-600/10",
        border: "border-blue-500/30",
        text: "text-blue-300",
      },
      [PAYMENT_TOKENS.USDC]: {
        name: "USD Coin",
        symbol: "USDC",
        icon: <img src="/usdc.svg" alt="USDC" width="22" height="22" />,
        gradient: "from-blue-600 to-cyan-600",
        bgGradient: "from-blue-600/10 to-cyan-600/10",
        border: "border-blue-500/30",
        text: "text-cyan-300",
      },
    };
    return configs[token] || configs[PAYMENT_TOKENS.ETH];
  };

  console.log(payoutData);
  return (
    <Layout title="Payouts">
      <div className="min-h-screen space-y-8">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
              <TfiWallet className="h-8 w-8 text-blue-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Merchant Payouts
              </h1>
              <p className="text-gray-400 mt-1">
                Manage your earnings and withdrawal schedule
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={loadPayoutData}
            disabled={payoutData.loading}
            className="group relative overflow-hidden rounded-2xl px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

            {/* Button shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

            <div className="relative flex items-center space-x-2">
              <FiRefreshCw
                className={`h-5 w-5 ${
                  payoutData.loading ? "animate-spin" : ""
                }`}
              />
              <span>Refresh</span>
            </div>
          </motion.button>
        </motion.div>

        {/* Enhanced Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(34, 197, 94, 0.2)",
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-xl group-hover:from-blue-600/20 transition-all duration-500"></div>
            </div>

            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                <FiDollarSign className="h-8 w-8 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  💰 Total Pending
                </p>
                <p className="text-2xl font-bold text-white">
                  $
                  {payoutData.loading
                    ? "--"
                    : getTotalPendingValue().toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(59, 130, 246, 0.2)",
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-xl group-hover:from-blue-600/20 transition-all duration-500"></div>
            </div>

            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                <FiTrendingUp className="h-8 w-8 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  📈 Total Products
                </p>
                <p className="text-2xl font-bold text-white">
                  {payoutData.loading || !payoutData.analytics
                    ? "--"
                    : `${parseFloat(
                        payoutData.analytics.totalProducts
                      ).toLocaleString()}`}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(245, 158, 11, 0.2)",
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-yellow-600/10 to-transparent rounded-full blur-xl group-hover:from-yellow-600/20 transition-all duration-500"></div>
            </div>

            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                <FiClock className="h-8 w-8 text-yellow-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-300 mb-1">
                  ⏰ Next Payout
                </p>
                <p className="text-2xl font-bold text-white">
                  {payoutData.loading ? "--" : getNextPayoutTime()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-purple-600/10 to-transparent rounded-full blur-xl group-hover:from-purple-600/20 transition-all duration-500"></div>
            </div>

            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                <FiCalendar className="h-8 w-8 text-purple-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-300 mb-1">
                  Total Transactions
                </p>
                <p className="text-2xl font-bold text-white">
                  {payoutData.loading
                    ? "--"
                    : payoutData.analytics.totalTransactions.toString()}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Pending Payouts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-600/5 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-600/5 to-transparent rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                  <FiSend className="h-6 w-6 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    💸 Pending Withdrawals
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Available cryptocurrency balances
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    getNextPayoutTime() === "Available now"
                      ? "bg-blue-400 animate-pulse"
                      : "bg-yellow-400"
                  }`}
                ></div>
                <div className="text-sm text-gray-300 font-medium">
                  Next payout:{" "}
                  <span className="text-blue-300 font-bold">
                    {getNextPayoutTime()}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* ETH Payout Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 p-6"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)",
                  borderColor: "rgba(59, 130, 246, 0.2)",
                }}
              >
                {/* Background effects */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-xl group-hover:from-blue-600/20 transition-all duration-500"></div>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-600/20 border border-blue-500/30">
                        <span className="text-2xl">🔷</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-blue-300 text-lg">
                          Ethereum
                        </h3>
                        <p className="text-xs text-gray-400">ETH Network</p>
                      </div>
                    </div>
                    {canProcessPayout(PAYMENT_TOKENS.ETH) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="p-2 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30"
                      >
                        <FiCheck className="h-4 w-4 text-blue-300" />
                      </motion.div>
                    )}
                  </div>

                  <div className="mb-6">
                    <p className="text-3xl font-bold text-white mb-2">
                      {parseFloat(payoutData.pending.ethAmount).toFixed(4)} ETH
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-blue-300">
                      <FiDollarSign className="h-4 w-4" />
                      <span>
                        ≈ $
                        {(
                          parseFloat(payoutData.pending.ethAmount) * 2500
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openPayoutModal(PAYMENT_TOKENS.ETH)}
                    disabled={
                      !canProcessPayout(PAYMENT_TOKENS.ETH) ||
                      processingPayout === PAYMENT_TOKENS.ETH
                    }
                    className="group w-full relative overflow-hidden px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* Button glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                    <div className="relative flex items-center justify-center space-x-2">
                      {processingPayout === PAYMENT_TOKENS.ETH ? (
                        <>
                          <FiRefreshCw className="animate-spin h-4 w-4" />
                          <span>Processing...</span>
                        </>
                      ) : canProcessPayout(PAYMENT_TOKENS.ETH) ? (
                        <>
                          <FiSend className="h-4 w-4" />
                          <span>Withdraw ETH</span>
                        </>
                      ) : (
                        <>
                          <FiClock className="h-4 w-4" />
                          <span>Not Available</span>
                        </>
                      )}
                    </div>
                  </motion.button>
                </div>
              </motion.div>

              {/* USDT Payout Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 p-6"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
                  borderColor: "rgba(34, 197, 94, 0.2)",
                }}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-xl group-hover:from-blue-600/20 transition-all duration-500"></div>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                        <span className="text-2xl">💚</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-blue-300 text-lg">
                          Tether USD
                        </h3>
                        <p className="text-xs text-gray-400">USDT Stablecoin</p>
                      </div>
                    </div>
                    {canProcessPayout(PAYMENT_TOKENS.USDT) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="p-2 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30"
                      >
                        <FiCheck className="h-4 w-4 text-blue-300" />
                      </motion.div>
                    )}
                  </div>

                  <div className="mb-6">
                    <p className="text-3xl font-bold text-white mb-2">
                      $
                      {parseFloat(
                        payoutData.pending.usdtAmount
                      ).toLocaleString()}
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-blue-300">
                      <FiShield className="h-4 w-4" />
                      <span>USDT Stablecoin</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openPayoutModal(PAYMENT_TOKENS.USDT)}
                    disabled={
                      !canProcessPayout(PAYMENT_TOKENS.USDT) ||
                      processingPayout === PAYMENT_TOKENS.USDT
                    }
                    className="group w-full relative overflow-hidden px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                    <div className="relative flex items-center justify-center space-x-2">
                      {processingPayout === PAYMENT_TOKENS.USDT ? (
                        <>
                          <FiRefreshCw className="animate-spin h-4 w-4" />
                          <span>Processing...</span>
                        </>
                      ) : canProcessPayout(PAYMENT_TOKENS.USDT) ? (
                        <>
                          <FiSend className="h-4 w-4" />
                          <span>Withdraw USDT</span>
                        </>
                      ) : (
                        <>
                          <FiClock className="h-4 w-4" />
                          <span>Not Available</span>
                        </>
                      )}
                    </div>
                  </motion.button>
                </div>
              </motion.div>

              {/* USDC Payout Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 p-6"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
                  borderColor: "rgba(6, 182, 212, 0.2)",
                }}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-600/10 to-transparent rounded-full blur-xl group-hover:from-cyan-600/20 transition-all duration-500"></div>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30">
                        <span className="text-2xl">🔵</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-cyan-300 text-lg">
                          USD Coin
                        </h3>
                        <p className="text-xs text-gray-400">USDC Stablecoin</p>
                      </div>
                    </div>
                    {canProcessPayout(PAYMENT_TOKENS.USDC) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="p-2 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30"
                      >
                        <FiCheck className="h-4 w-4 text-blue-300" />
                      </motion.div>
                    )}
                  </div>

                  <div className="mb-6">
                    <p className="text-3xl font-bold text-white mb-2">
                      $
                      {parseFloat(
                        payoutData.pending.usdcAmount
                      ).toLocaleString()}
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-cyan-300">
                      <FiShield className="h-4 w-4" />
                      <span>USDC Stablecoin</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openPayoutModal(PAYMENT_TOKENS.USDC)}
                    disabled={
                      !canProcessPayout(PAYMENT_TOKENS.USDC) ||
                      processingPayout === PAYMENT_TOKENS.USDC
                    }
                    className="group w-full relative overflow-hidden px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-blue-600 text-white font-semibold shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-blue-600 to-blue-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                    <div className="relative flex items-center justify-center space-x-2">
                      {processingPayout === PAYMENT_TOKENS.USDC ? (
                        <>
                          <FiRefreshCw className="animate-spin h-4 w-4" />
                          <span>Processing...</span>
                        </>
                      ) : canProcessPayout(PAYMENT_TOKENS.USDC) ? (
                        <>
                          <FiSend className="h-4 w-4" />
                          <span>Withdraw USDC</span>
                        </>
                      ) : (
                        <>
                          <FiClock className="h-4 w-4" />
                          <span>Not Available</span>
                        </>
                      )}
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            </div>

            {/* Enhanced Payout Information */}
            <div
              className="mt-8 p-6 rounded-2xl backdrop-blur-sm border"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                borderColor: "rgba(59, 130, 246, 0.2)",
              }}
            >
              <div className="flex items-start space-x-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                  <FiAlertCircle className="h-6 w-6 text-blue-300" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-blue-300 text-lg mb-3">
                    💡 Payout Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      <span>
                        Payouts are processed automatically every 7 days
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      <span>Minimum payout amount varies by token</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                      <span>Gas fees are deducted from the payout amount</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                      <span>All payouts are recorded on the blockchain</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Payout History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl border"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-purple-600/5 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-600/5 to-transparent rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10">
            {/* Table Header */}
            <div className="px-8 py-6 border-b border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                    <FiDatabase className="h-5 w-5 text-purple-300" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    📊 Payout History
                  </h3>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    // Export payout history
                    const csvContent = payoutData.history
                      .map(
                        (p) =>
                          `${new Date(
                            p.timestamp * 1000
                          ).toLocaleDateString()},${TOKEN_NAMES[p.token]},${
                            p.amount
                          }`
                      )
                      .join("\n");

                    const blob = new Blob(
                      [`Date,Token,Amount\n${csvContent}`],
                      { type: "text/csv" }
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `payouts-${
                      new Date().toISOString().split("T")[0]
                    }.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Payout history exported successfully!");
                  }}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300 font-semibold hover:shadow-lg hover:shadow-blue-500/10"
                >
                  <FiDownload className="h-4 w-4 mr-2" />
                  Export CSV
                </motion.button>
              </div>
            </div>

            {payoutData.history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-500/10">
                      <th className="px-8 py-4 text-left text-xs font-bold text-purple-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-blue-300 uppercase tracking-wider">
                        Token
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-blue-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-cyan-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/5">
                    <AnimatePresence>
                      {payoutData.history.map((payout, index) => (
                        <motion.tr
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{
                            backgroundColor: "rgba(139, 92, 246, 0.05)",
                          }}
                          className="group transition-colors duration-200"
                        >
                          <td className="px-8 py-4">
                            <div className="flex items-center space-x-2">
                              <FiCalendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-white">
                                {new Date(
                                  payout.timestamp * 1000
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </td>

                          <td className="px-8 py-4">
                            <div className="flex items-center space-x-3">
                              <div
                                className={`p-2 rounded-lg ${
                                  getTokenConfig(payout.token).bgGradient
                                } border ${
                                  getTokenConfig(payout.token).border
                                }`}
                              >
                                <span className="text-lg">
                                  {getTokenConfig(payout.token).icon}
                                </span>
                              </div>
                              <span
                                className={`text-sm font-bold ${
                                  getTokenConfig(payout.token).text
                                }`}
                              >
                                {TOKEN_NAMES[payout.token]}
                              </span>
                            </div>
                          </td>

                          <td className="px-8 py-4">
                            <div className="flex items-center space-x-2">
                              {/* <FiDollarSign className="h-4 w-4 text-blue-400" /> */}

                              <span className="text-sm font-bold text-white">
                                {payout.token === PAYMENT_TOKENS.ETH
                                  ? `${payout.formattedAmount} ETH`
                                  : `${parseFloat(
                                      payout.formattedAmount
                                    ).toLocaleString()} ${payout.tokenName}`}
                              </span>
                            </div>
                          </td>

                          <td className="px-8 py-4">
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/50 text-blue-300"
                            >
                              <FiCheck className="h-3 w-3 mr-2" />✅ Completed
                            </motion.span>
                          </td>

                          <td className="px-8 py-4">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                              title="View Transaction"
                            >
                              <FiEye className="h-4 w-4" />
                            </motion.button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="relative inline-block">
                  <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-full blur-xl"></div>
                  <div className="relative p-8 rounded-full bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/30">
                    <FiDollarSign className="h-16 w-16 text-purple-300 mx-auto" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mt-6 mb-3">
                  No Payout History Yet
                </h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  Your payout history will appear here once you process your
                  first cryptocurrency withdrawal from your earnings.
                </p>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <FiShield className="h-4 w-4" />
                  <span>Secure • Transparent • Blockchain Verified</span>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Enhanced Payout Confirmation Modal */}
        <PayoutConfirmationModal
          isOpen={showPayoutModal}
          onClose={() => {
            setShowPayoutModal(false);
            setSelectedToken(null);
          }}
          token={selectedToken}
          amount={
            selectedToken !== null ? payoutData.pending[TOKEN_NAMES[selectedToken]] : "0"
          }
          onConfirm={handleProcessPayout}
        />
      </div>
    </Layout>
  );
};

// Enhanced Payout Confirmation Modal
const PayoutConfirmationModal = ({
  isOpen,
  onClose,
  token,
  amount,
  onConfirm,
}) => {
  if (!isOpen || token === null) return null;

  const tokenName = TOKEN_NAMES[token];
  const tokenConfigs = {
    [PAYMENT_TOKENS.ETH]: {
      name: "Ethereum",
      symbol: "ETH",
      icon: "🔷",
      gradient: "from-blue-600 to-blue-600",
      bgGradient: "from-blue-600/10 to-blue-600/10",
      border: "border-blue-500/30",
    },
    [PAYMENT_TOKENS.USDT]: {
      name: "Tether USD",
      symbol: "USDT",
      icon: "💚",
      gradient: "from-blue-600 to-cyan-600",
      bgGradient: "from-blue-600/10 to-cyan-600/10",
      border: "border-blue-500/30",
    },
    [PAYMENT_TOKENS.USDC]: {
      name: "USD Coin",
      symbol: "USDC",
      icon: "🔵",
      gradient: "from-cyan-600 to-blue-600",
      bgGradient: "from-cyan-600/10 to-blue-600/10",
      border: "border-cyan-500/30",
    },
  };

  const tokenInfo = tokenConfigs[token];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 transition-opacity bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative inline-block w-full max-w-lg p-8 my-8 overflow-hidden text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 50%, rgba(15, 11, 19, 0.95) 100%)",
              borderColor: "rgba(139, 92, 246, 0.3)",
              boxShadow: "0 25px 50px rgba(139, 92, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-600/10 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-r ${tokenInfo.bgGradient} border ${tokenInfo.border}`}
                  >
                    <span className="text-2xl">{tokenInfo.icon}</span>
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    Confirm Withdrawal
                  </h3>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-xl bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30 text-gray-300 hover:text-white transition-colors"
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              </div>

              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-6">
                  <div
                    className={`p-6 rounded-full bg-gradient-to-r ${tokenInfo.bgGradient} border ${tokenInfo.border}`}
                  >
                    <span className="text-4xl">{tokenInfo.icon}</span>
                  </div>
                </div>

                <h4 className="text-xl font-bold text-white mb-4">
                  Withdraw {tokenInfo.name}
                </h4>

                <div
                  className={`p-6 rounded-2xl bg-gradient-to-r ${tokenInfo.bgGradient} border ${tokenInfo.border} mb-6`}
                >
                  <p className="text-4xl font-bold text-white mb-2">
                    {token === PAYMENT_TOKENS.ETH ? ` ETH` : ` ${tokenName}`}
                  </p>

                  {token === PAYMENT_TOKENS.ETH && (
                    <p className="text-sm text-gray-300">
                      ≈ ${(parseFloat(amount) * 2500).toLocaleString()} USD
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-r from-yellow-600/10 to-orange-600/10 border border-yellow-500/20 mb-8">
                <div className="flex items-start space-x-4">
                  <FiAlertCircle className="h-6 w-6 text-yellow-300 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-yellow-300 mb-3">
                      ⚠️ Important Information:
                    </p>
                    <ul className="text-sm text-yellow-200 space-y-2">
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                        <span>This withdrawal action cannot be undone</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                        <span>
                          Network gas fees will be deducted automatically
                        </span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                        <span>
                          Processing may take several minutes to complete
                        </span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                        <span>
                          Funds will be sent directly to your connected wallet
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 px-6 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                  style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onConfirm(token);
                    onClose();
                  }}
                  className={`flex-1 px-6 py-3 rounded-xl bg-gradient-to-r ${tokenInfo.gradient} text-white font-bold shadow-lg hover:shadow-lg transition-all duration-300`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FiSend className="h-4 w-4" />
                    <span>Confirm Withdrawal</span>
                  </div>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Payouts;
