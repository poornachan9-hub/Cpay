import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  FiFileText,
  FiExternalLink,
  FiFilter,
  FiDownload,
  FiSearch,
  FiEye,
  FiClock,
  FiCheck,
  FiX,
  FiDollarSign,
  FiUser,
  FiShoppingBag,
  FiTrendingUp,
  FiActivity,
  FiDatabase,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiLayers,
  FiCreditCard,
  FiZap,
  FiShield,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import { contractService } from "../services/contract";
import { pinataService } from "../services/pinata";
import { TOKEN_NAMES, PAYMENT_TOKENS } from "../lib/constants";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";
import TransactionDetailsModal from "../components/Transactions/TransactionDetailsModal";
const PINATA_URL = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
const SUPPORTED_PAYMENT_CHAIN_IDS = [1337, 137];

const Transactions = () => {
  const { address, isConnected, chainId } = useAccount();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({
    token: "all",
    status: "all",
    timeRange: "30d",
    search: "",
  });
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");
  const [verification, setVerification] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationRefresh, setVerificationRefresh] = useState(0);

  // Mock ABI - replace with your actual ABI
  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    if (isConnected) {
      loadTransactions();
    }
  }, [isConnected]);

  useEffect(() => {
    let cancelled = false;

    if (!isConnected || !address || !SUPPORTED_PAYMENT_CHAIN_IDS.includes(Number(chainId))) {
      setVerification(null);
      setVerificationError("");
      setVerificationLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadVerification = async () => {
      setVerificationLoading(true);
      setVerificationError("");
      try {
        const response = await fetch(
          `/api/payments/verification?wallet=${encodeURIComponent(address)}&chainId=${Number(chainId)}`
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.hint || result.error || "Could not check saved payments");
        }
        if (!cancelled) setVerification(result);
      } catch (error) {
        if (!cancelled) setVerificationError(error.message || "Could not check saved payments");
      } finally {
        if (!cancelled) setVerificationLoading(false);
      }
    };

    loadVerification();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, chainId, verificationRefresh]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);
      const result = await contractService.getAllTransactions(contract);

      if (result.success) {
        // Enrich transactions with additional data
        const enrichedTransactions = await Promise.all(
          result.data.map(async (tx) => {
            // Get product details
            let productName = "Unknown Product";
            try {
              const productResult = await contractService.getProduct(
                contract,
                tx.productId
              );
              if (productResult.success) {
                productName = productResult.data.name;
              }
            } catch (error) {
              console.error("Error fetching product:", error);
            }

            // Parse metadata from IPFS if available
            let metadata = null;
            if (tx.ipfsHash) {
              try {
                metadata = await pinataService.fetchFromIPFS(tx.ipfsHash);
              } catch (error) {
                console.error("Error fetching transaction metadata:", error);
              }
            }

            return {
              ...tx,
              productName,
              metadata,
              formattedAmount: contractService.formatTokenAmount(
                tx.amount,
                tx.token
              ),
              formattedFee: contractService.formatTokenAmount(
                tx.platformFee,
                tx.token
              ),
              formattedMerchantAmount: contractService.formatTokenAmount(
                tx.merchantAmount,
                tx.token
              ),
              date: new Date(parseInt(tx.timestamp) * 1000),
              tokenName: TOKEN_NAMES[tx.token],
            };
          })
        );

        setTransactions(enrichedTransactions);
      } else {
        toast.error("Failed to load transactions");
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedTransactions = transactions
    .filter((tx) => {
      // Token filter
      if (filters.token !== "all" && tx.tokenName !== filters.token) {
        return false;
      }

      // Status filter (you can add more status logic based on your needs)
      if (filters.status !== "all") {
        if (filters.status === "processed" && !tx.processed) return false;
        if (filters.status === "pending" && tx.processed) return false;
      }

      // Time range filter
      const now = new Date();
      const txDate = new Date(parseInt(tx.timestamp) * 1000);
      const daysAgo = Math.floor((now - txDate) / (1000 * 60 * 60 * 24));

      if (filters.timeRange === "7d" && daysAgo > 7) return false;
      if (filters.timeRange === "30d" && daysAgo > 30) return false;
      if (filters.timeRange === "90d" && daysAgo > 90) return false;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          tx.id.toLowerCase().includes(searchLower) ||
          tx.buyer.toLowerCase().includes(searchLower) ||
          tx.merchant.toLowerCase().includes(searchLower) ||
          tx.productName.toLowerCase().includes(searchLower) ||
          tx.tokenName.toLowerCase().includes(searchLower)
        );
      }

      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "timestamp":
          aValue = parseInt(a.timestamp);
          bValue = parseInt(b.timestamp);
          break;
        case "amount":
          aValue = parseFloat(a.formattedAmount);
          bValue = parseFloat(b.formattedAmount);
          break;
        case "token":
          aValue = a.tokenName;
          bValue = b.tokenName;
          break;
        default:
          aValue = a[sortBy];
          bValue = b[sortBy];
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const exportTransactions = () => {
    const exportData = filteredAndSortedTransactions.map((tx) => ({
      "Transaction ID": tx.id,
      Date: tx.date.toLocaleDateString(),
      Product: tx.productName,
      Buyer: tx.buyer,
      Merchant: tx.merchant,
      Token: tx.tokenName,
      Amount: tx.formattedAmount,
      "Platform Fee": tx.formattedFee,
      "Merchant Amount": tx.formattedMerchantAmount,
      Status: tx.processed ? "Processed" : "Pending",
    }));

    const csvContent = [
      Object.keys(exportData[0]).join(","),
      ...exportData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transactions exported successfully");
  };

  const getStatusIcon = (processed) => {
    return processed ? (
      <FiCheck className="h-4 w-4 text-blue-400" />
    ) : (
      <FiClock className="h-4 w-4 text-yellow-400" />
    );
  };

  const getStatusBadge = (processed) => {
    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm border ${
          processed
            ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/30 text-blue-300"
            : "bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-yellow-500/30 text-yellow-300"
        }`}
      >
        {getStatusIcon(processed)}
        <span className="ml-2">{processed ? "Processed" : "Pending"}</span>
      </motion.span>
    );
  };

  const getTokenIcon = (tokenName) => {
    const icons = {
      ETH: <img src="/ethereum.svg" alt="ETH" width="15" height="15" />,
      USDT: <img src="/usdt.svg" alt="USDT" width="22" height="22" />,
      USDC: <img src="/usdc.svg" alt="USDC" width="22" height="22" />,
    };
    return icons[tokenName] || "💎";
  };

  const getTokenGradient = (tokenName) => {
    const gradients = {
      ETH: "from-blue-600/10 to-blue-600/10",
      USDT: "from-blue-600/10 to-cyan-600/10",
      USDC: "from-blue-600/10 to-cyan-600/10",
    };
    return gradients[tokenName] || "from-purple-600/10 to-indigo-600/10";
  };

  const getTokenBorder = (tokenName) => {
    const borders = {
      ETH: "border-blue-500/30",
      USDT: "border-blue-500/30",
      USDC: "border-blue-500/30",
    };
    return borders[tokenName] || "border-purple-500/30";
  };

  const openTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailsModal(true);
  };

  return (
    <Layout title="Transactions">
      <div className="min-h-screen space-y-8">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
              <FiDatabase className="h-8 w-8 text-blue-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Transactions
              </h1>
              <p className="text-gray-400 mt-1">
                Monitor and analyze all blockchain payment activities
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportTransactions}
            disabled={filteredAndSortedTransactions.length === 0}
            className="group relative overflow-hidden rounded-2xl px-6 py-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-cyan-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

            {/* Button shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

            <div className="relative flex items-center space-x-2">
              <FiDownload className="h-5 w-5" />
              <span>Export CSV</span>
            </div>
          </motion.button>
        </motion.div>

        <section
          className="rounded-2xl border border-blue-400/20 p-5 backdrop-blur-xl"
          style={{ background: "linear-gradient(135deg, rgba(15,11,19,0.88), rgba(22,28,40,0.82))" }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Saved Payment Checks</h2>
              <p className="mt-1 text-xs text-gray-400">
                {Number(chainId) === 137 ? "Polygon PoS" : "Hardhat Local"} · checks saved payments against the connected network
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVerificationRefresh((value) => value + 1)}
              disabled={verificationLoading || !isConnected || !SUPPORTED_PAYMENT_CHAIN_IDS.includes(Number(chainId))}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:border-blue-400/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {verificationLoading ? "Checking..." : "Refresh checks"}
            </button>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            {!isConnected ? (
              <p className="text-sm text-gray-400">Connect your wallet to check its saved payments.</p>
            ) : !SUPPORTED_PAYMENT_CHAIN_IDS.includes(Number(chainId)) ? (
              <p className="text-sm text-gray-400">Switch your wallet to Polygon PoS or Hardhat Local to check saved payments.</p>
            ) : verificationLoading ? (
              <p className="text-sm text-gray-400">Checking saved payments on the connected chain...</p>
            ) : verificationError ? (
              <p className="text-sm text-amber-300">{verificationError}</p>
            ) : verification?.checked === 0 ? (
              <p className="text-sm text-gray-400">No saved payments for this wallet on the selected network yet.</p>
            ) : verification ? (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <p className="text-gray-200">
                    <span className="font-bold text-emerald-300">{verification.verified}</span>
                    <span className="text-gray-400"> of </span>
                    <span className="font-bold text-white">{verification.checked}</span>
                    <span className="text-gray-400"> saved payments matched</span>
                  </p>
                  {verification.needs_review > 0 && (
                    <p className="text-amber-300">{verification.needs_review} need review</p>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {verification.checks.map((check) => (
                    <div
                      key={check.tx_hash}
                      className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-gray-300">
                          {check.tx_hash.slice(0, 12)}...{check.tx_hash.slice(-8)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {check.token_amount} {check.token_symbol} · {check.reason}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                          check.status === "verified"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                        }`}
                      >
                        {check.status === "verified" ? "Verified" : "Needs review"}
                      </span>
                    </div>
                  ))}
                </div>
                {verification.limited && (
                  <p className="mt-3 text-[11px] text-gray-500">Showing the latest 50 saved payments for this wallet.</p>
                )}
                <p className="mt-3 text-[11px] text-gray-500">
                  This checks saved, confirmed payments only. It is not a success rate for all payment attempts.
                </p>
              </>
            ) : null}
          </div>
        </section>

        {/* Enhanced Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-600/10 to-transparent rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-blue-400 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="w-full pl-12 pr-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
                    borderColor: "rgba(59, 130, 246, 0.2)",
                  }}
                />
              </div>
            </div>

            {/* Token Filter */}
            <div className="relative">
              <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400 pointer-events-none" />
              <select
                value={filters.token}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, token: e.target.value }))
                }
                className="w-full pl-10 pr-8 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent appearance-none cursor-pointer"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 184, 166, 0.1) 100%)",
                  borderColor: "rgba(16, 185, 129, 0.2)",
                }}
              >
                <option value="all" className="bg-gray-800">
                  All Tokens
                </option>
                <option value="ETH" className="bg-gray-800">
                  🔷 ETH
                </option>
                <option value="USDT" className="bg-gray-800">
                  💚 USDT
                </option>
                <option value="USDC" className="bg-gray-800">
                  🔵 USDC
                </option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <FiShield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-400 pointer-events-none" />
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full pl-10 pr-8 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent appearance-none cursor-pointer"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                  borderColor: "rgba(139, 92, 246, 0.2)",
                }}
              >
                <option value="all" className="bg-gray-800">
                  All Status
                </option>
                <option value="processed" className="bg-gray-800">
                  ✅ Processed
                </option>
                <option value="pending" className="bg-gray-800">
                  ⏳ Pending
                </option>
              </select>
            </div>

            {/* Time Range */}
            <div className="relative">
              <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-cyan-400 pointer-events-none" />
              <select
                value={filters.timeRange}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, timeRange: e.target.value }))
                }
                className="w-full pl-10 pr-8 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent appearance-none cursor-pointer"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
                  borderColor: "rgba(6, 182, 212, 0.2)",
                }}
              >
                <option value="7d" className="bg-gray-800">
                  Last 7 days
                </option>
                <option value="30d" className="bg-gray-800">
                  Last 30 days
                </option>
                <option value="90d" className="bg-gray-800">
                  Last 90 days
                </option>
                <option value="all" className="bg-gray-800">
                  All time
                </option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(59, 130, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-xl group-hover:from-blue-600/20 transition-all duration-500"></div>
            </div>

            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-600/20 border border-blue-500/30">
                <FiDatabase className="h-8 w-8 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  Total Transactions
                </p>
                <p className="text-2xl font-bold text-white">
                  {filteredAndSortedTransactions.length}
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
              borderColor: "rgba(16, 185, 129, 0.2)",
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-xl group-hover:from-blue-600/20 transition-all duration-500"></div>
            </div>

            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                <FiTrendingUp className="h-8 w-8 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  Total Volume
                </p>
                <p className="text-2xl font-bold text-white">
                  $
                  {filteredAndSortedTransactions
                    .reduce(
                      (sum, tx) => sum + parseFloat(tx.formattedAmount),
                      0
                    )
                    .toLocaleString()}
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
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-purple-600/20 border border-purple-500/30">
                <FiZap className="h-8 w-8 text-purple-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-300 mb-1">
                  Processed
                </p>
                <p className="text-2xl font-bold text-white">
                  {
                    filteredAndSortedTransactions.filter((tx) => tx.processed)
                      .length
                  }
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
                <FiActivity className="h-8 w-8 text-yellow-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-300 mb-1">
                  Pending
                </p>
                <p className="text-2xl font-bold text-white">
                  {
                    filteredAndSortedTransactions.filter((tx) => !tx.processed)
                      .length
                  }
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Transactions Table */}
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
            <div className="px-6 py-4 border-b border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                    <FiLayers className="h-5 w-5 text-purple-300" />
                  </div>
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    Transaction History
                  </h3>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-400">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-sm border rounded-lg px-3 py-1 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.3)",
                    }}
                  >
                    <option value="timestamp" className="bg-gray-800">
                      📅 Date
                    </option>
                    <option value="amount" className="bg-gray-800">
                      💰 Amount
                    </option>
                    <option value="token" className="bg-gray-800">
                      🪙 Token
                    </option>
                  </select>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() =>
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    }
                    className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                  >
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </motion.button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-8">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex space-x-4 p-4 rounded-xl backdrop-blur-sm border animate-pulse"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)",
                        borderColor: "rgba(139, 92, 246, 0.1)",
                      }}
                    >
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-xl animate-pulse"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-lg animate-pulse"></div>
                        <div className="h-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg w-2/3 animate-pulse"></div>
                      </div>
                      <div className="w-24 h-6 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-lg animate-pulse"></div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : filteredAndSortedTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-500/20">
                      <th className="px-6 py-4 text-left text-xs font-bold text-purple-300 uppercase tracking-wider">
                        Transaction
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-blue-300 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-blue-300 uppercase tracking-wider">
                        Parties
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-cyan-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-yellow-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/10">
                    <AnimatePresence>
                      {filteredAndSortedTransactions.map(
                        (transaction, index) => (
                          <motion.tr
                            key={transaction.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{
                              backgroundColor: "rgba(139, 92, 246, 0.05)",
                            }}
                            className="group transition-colors duration-200 cursor-pointer"
                            onClick={() => openTransactionDetails(transaction)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div
                                  className={`p-2 rounded-xl bg-gradient-to-r ${getTokenGradient(
                                    transaction.tokenName
                                  )} border ${getTokenBorder(
                                    transaction.tokenName
                                  )}`}
                                >
                                  <span className="text-lg">
                                    {getTokenIcon(transaction.tokenName)}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white group-hover:text-purple-200 transition-colors">
                                    #{transaction.id.slice(0, 8)}...
                                  </div>
                                  <div className="text-xs text-gray-400 flex items-center space-x-1">
                                    <FiCreditCard className="h-3 w-3" />
                                    <span>{transaction.tokenName}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                                  <FiShoppingBag className="h-4 w-4 text-blue-300" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white group-hover:text-blue-200 transition-colors">
                                    {transaction.productName}
                                  </div>
                                  <div className="text-xs text-gray-400 flex items-center space-x-1">
                                    <span>ID: {transaction.productId}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <div className="p-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                                    <FiArrowUpRight className="h-3 w-3 text-blue-300" />
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    Buyer:
                                  </span>
                                  <span className="text-xs font-mono text-blue-300 bg-blue-900/20 px-2 py-1 rounded">
                                    {transaction.buyer.slice(0, 6)}...
                                    {transaction.buyer.slice(-4)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="p-1 rounded-lg bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                                    <FiArrowDownLeft className="h-3 w-3 text-purple-300" />
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    Merchant:
                                  </span>
                                  <span className="text-xs font-mono text-purple-300 bg-purple-900/20 px-2 py-1 rounded">
                                    {transaction.merchant.slice(0, 6)}...
                                    {transaction.merchant.slice(-4)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                <div
                                  className={`flex items-center space-x-2 p-2 rounded-lg bg-gradient-to-r ${getTokenGradient(
                                    transaction.tokenName
                                  )} border ${getTokenBorder(
                                    transaction.tokenName
                                  )}`}
                                >
                                  <FiDollarSign className="h-4 w-4 text-blue-300" />
                                  <div>
                                    <div className="text-sm font-bold text-white">
                                      {transaction.tokenName === "ETH"
                                        ? `${transaction.formattedAmount} ETH`
                                        : `${transaction.formattedAmount}`}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      Fee:{" "}
                                      {transaction.tokenName === "ETH"
                                        ? `${transaction.formattedFee} ETH`
                                        : `${transaction.formattedFee}`}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <FiClock className="h-4 w-4 text-indigo-300" />
                                <div>
                                  <div className="text-sm font-medium text-white">
                                    {transaction.date.toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {transaction.date.toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              {getStatusBadge(transaction.processed)}
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTransactionDetails(transaction);
                                  }}
                                  className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                                  title="View Details"
                                >
                                  <FiEye className="h-4 w-4" />
                                </motion.button>

                                {transaction.ipfsHash && (
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(
                                        `${PINATA_URL}${transaction.ipfsHash}`,
                                        "_blank"
                                      );
                                    }}
                                    className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                                    title="View Metadata"
                                  >
                                    <FiExternalLink className="h-4 w-4" />
                                  </motion.button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )
                      )}
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
                  <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full blur-xl"></div>
                  <div className="relative p-6 rounded-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30">
                    <FiDatabase className="h-16 w-16 text-blue-300 mx-auto" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mt-6 mb-2">
                  No transactions found
                </h3>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                  {Object.values(filters).some((f) => f !== "all" && f !== "")
                    ? "Try adjusting your search or filter criteria to find transactions"
                    : "No blockchain transactions have been recorded yet"}
                </p>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <FiShield className="h-4 w-4" />
                  <span>Secure • Decentralized • Transparent</span>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Transaction Details Modal */}
        <TransactionDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedTransaction(null);
          }}
          transaction={selectedTransaction}
        />
      </div>
    </Layout>
  );
};
export default Transactions;
