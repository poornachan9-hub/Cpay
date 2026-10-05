import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiUsers,
  FiSearch,
  FiFilter,
  FiEye,
  FiShield,
  FiDollarSign,
  FiShoppingBag,
  FiCheck,
  FiX,
  FiClock,
  FiMoreVertical,
  FiDownload,
  FiCopy,
  FiActivity,
  FiTrendingUp,
  FiDatabase,
  FiUserCheck,
  FiUserX,
  FiCalendar,
  FiSettings,
  FiAlertTriangle,
  FiRefreshCw,
  FiMail,
  FiEdit,
  FiXCircle,
  FiUnlock,
} from "react-icons/fi";
import { TfiCrown } from "react-icons/tfi";

import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import { contractService } from "../services/contract";
import { KYC_STATUS, KYC_STATUS_NAMES, isAdminAddress } from "../lib/constants";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";

const Users = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showKYCReviewModal, setShowKYCReviewModal] = useState(false);
  const [kycReviewForm, setKycReviewForm] = useState({
    userAddress: "",
    approved: true,
    rejectionReason: "",
  });
  const [filters, setFilters] = useState({
    kycStatus: "all",
    userType: "all",
    search: "",
  });
  const [isOwner, setIsOwner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    if (isConnected && address) {
      loadUsers();
    }
  }, [isConnected, address]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);

      // Declare owner variable outside of try block
      let owner = null;

      // Check if current user is owner
      try {
        owner = await contract.owner();
        console.log("Contract owner:", owner);
        setIsOwner(owner.toLowerCase() === address.toLowerCase() || isAdminAddress(address));
      } catch (error) {
        console.error("Error checking owner status:", error);
        setIsOwner(isAdminAddress(address));
      }

      // Load all KYC users
      const kycUsers = await contract.getKYCUsers();
      console.log("KYC Users found:", kycUsers.length);
      const userData = [];

      for (const userAddr of kycUsers) {
        try {
          console.log(`Loading data for user: ${userAddr}`);

          // Get KYC data
          const kycResult = await contractService.getKYCData(
            contract,
            userAddr
          );

          // Get merchant analytics
          const analyticsResult = await contractService.getMerchantAnalytics(
            contract,
            userAddr
          );

          // Get user's products
          const productsResult = await contractService.getMerchantProducts(
            contract,
            userAddr
          );

          // Get pending payouts
          const payoutsResult = await contractService.getPendingPayouts(
            contract,
            userAddr
          );

          // Check if user is authorized reviewer
          const isReviewer = await contract.authorizedReviewers(userAddr);

          userData.push({
            address: userAddr,
            kyc: kycResult.success ? kycResult.data : null,
            analytics: analyticsResult.success ? analyticsResult.data : null,
            productCount: productsResult.success
              ? productsResult.data.length
              : 0,
            products: productsResult.success ? productsResult.data : [],
            pendingPayouts: payoutsResult.success ? payoutsResult.data : null,
            isOwner: (owner
              ? owner.toLowerCase() === userAddr.toLowerCase()
              : false) || isAdminAddress(userAddr),
            isReviewer,
          });

          console.log(`✅ Successfully loaded data for user: ${userAddr}`);
        } catch (error) {
          console.error(`❌ Error loading data for user ${userAddr}:`, error);
          // Add user with minimal data to still show in list
          userData.push({
            address: userAddr,
            kyc: null,
            analytics: null,
            productCount: 0,
            products: [],
            pendingPayouts: null,
            isOwner: isAdminAddress(userAddr),
            isReviewer: false,
          });
        }
      }

      console.log(`📊 Total users loaded: ${userData.length}`);
      setUsers(userData);
    } catch (error) {
      console.error("❌ Error loading users:", error);
      toast.error("Failed to load users data");
    } finally {
      setLoading(false);
    }
  };

  const refreshUsers = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
    toast.success("Users data refreshed!");
  };

  // KYC Review Functions
  const openKYCReview = (user) => {
    setKycReviewForm({
      userAddress: user.address,
      approved: true,
      rejectionReason: "",
    });
    setShowKYCReviewModal(true);
  };

  const submitKYCReview = async () => {
    if (!walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      setActionLoading((prev) => ({ ...prev, kycReview: true }));

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );

      const result = await contractService.reviewKYC(
        contract,
        kycReviewForm.userAddress,
        kycReviewForm.approved,
        kycReviewForm.rejectionReason
      );

      if (result.success) {
        toast.success(
          `KYC ${
            kycReviewForm.approved ? "approved" : "rejected"
          } successfully!`
        );
        setShowKYCReviewModal(false);

        // Wait for transaction confirmation
        await result.tx.wait();

        // Refresh users data
        await loadUsers();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error reviewing KYC:", error);
      toast.error(`Failed to review KYC: ${error.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, kycReview: false }));
    }
  };

  // Reviewer Management Functions
  const addReviewer = async (userAddress) => {
    if (!walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      setActionLoading((prev) => ({ ...prev, [userAddress]: true }));

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );

      const result = await contractService.addReviewer(contract, userAddress);

      if (result.success) {
        toast.success("User added as reviewer successfully!");
        await result.tx.wait();
        await loadUsers();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error adding reviewer:", error);
      toast.error(`Failed to add reviewer: ${error.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [userAddress]: false }));
    }
  };

  const removeReviewer = async (userAddress) => {
    if (!walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      setActionLoading((prev) => ({ ...prev, [userAddress]: true }));

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );

      const result = await contractService.removeReviewer(
        contract,
        userAddress
      );

      if (result.success) {
        toast.success("Reviewer removed successfully!");
        await result.tx.wait();
        await loadUsers();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error removing reviewer:", error);
      toast.error(`Failed to remove reviewer: ${error.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [userAddress]: false }));
    }
  };

  // Payout Functions
  const processPayout = async (userAddress, tokenType) => {
    if (!walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      setActionLoading((prev) => ({
        ...prev,
        [`payout_${userAddress}_${tokenType}`]: true,
      }));

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );

      const result = await contractService.processPayout(
        contract,
        userAddress,
        tokenType
      );

      if (result.success) {
        const tokenNames = ["ETH", "USDT", "USDC"];
        toast.success(
          `${tokenNames[tokenType]} payout processed successfully!`
        );
        await result.tx.wait();
        await loadUsers();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error processing payout:", error);
      toast.error(`Failed to process payout: ${error.message}`);
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [`payout_${userAddress}_${tokenType}`]: false,
      }));
    }
  };

  const filteredUsers = users.filter((user) => {
    // KYC Status filter
    if (filters.kycStatus !== "all") {
      const statusName = KYC_STATUS_NAMES[user.kyc?.status || 0]
        .toLowerCase()
        .replace(" ", "");
      if (statusName !== filters.kycStatus) return false;
    }

    // User Type filter
    if (filters.userType !== "all") {
      if (
        filters.userType === "merchants" &&
        (!user.analytics || user.productCount === 0)
      )
        return false;
      if (
        filters.userType === "buyers" &&
        user.analytics &&
        user.productCount > 0
      )
        return false;
      if (filters.userType === "owners" && !user.isOwner) return false;
      if (filters.userType === "reviewers" && !user.isReviewer) return false;
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return user.address.toLowerCase().includes(searchLower);
    }

    return true;
  });

  const getUserStats = () => {
    const total = users.length;
    const merchants = users.filter((u) => u.productCount > 0).length;
    const approved = users.filter(
      (u) => u.kyc?.status === KYC_STATUS.Approved
    ).length;
    const pending = users.filter(
      (u) => u.kyc?.status === KYC_STATUS.Pending
    ).length;
    const reviewers = users.filter((u) => u.isReviewer).length;

    return { total, merchants, approved, pending, reviewers };
  };

  const stats = getUserStats();

  const getStatusIcon = (status) => {
    switch (status) {
      case KYC_STATUS.Approved:
        return <FiCheck className="h-4 w-4 text-blue-400" />;
      case KYC_STATUS.Rejected:
        return <FiX className="h-4 w-4 text-red-400" />;
      case KYC_STATUS.Pending:
        return <FiClock className="h-4 w-4 text-yellow-400" />;
      case KYC_STATUS.Cancelled:
        return <FiXCircle className="h-4 w-4 text-orange-400" />;
      default:
        return <FiShield className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      [KYC_STATUS.Approved]: {
        bg: "from-blue-600/30 to-indigo-600/30",
        border: "border-blue-500/50",
        text: "text-blue-300",
      },
      [KYC_STATUS.Rejected]: {
        bg: "from-red-600/30 to-indigo-600/30",
        border: "border-red-500/50",
        text: "text-red-300",
      },
      [KYC_STATUS.Pending]: {
        bg: "from-yellow-600/30 to-orange-600/30",
        border: "border-yellow-500/50",
        text: "text-yellow-300",
      },
      [KYC_STATUS.Cancelled]: {
        bg: "from-orange-600/30 to-red-600/30",
        border: "border-orange-500/50",
        text: "text-orange-300",
      },
      default: {
        bg: "from-gray-600/30 to-slate-600/30",
        border: "border-gray-500/50",
        text: "text-gray-300",
      },
    };

    const config = configs[status] || configs.default;

    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm border ${config.border} ${config.text}`}
        style={{
          background: `linear-gradient(135deg, ${config.bg})`,
        }}
      >
        {getStatusIcon(status)}
        <span className="ml-2">{KYC_STATUS_NAMES[status] || "Unknown"}</span>
      </motion.span>
    );
  };

  const openUserDetails = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copied to clipboard!`);
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  const exportUsers = () => {
    const exportData = filteredUsers.map((user) => ({
      Address: user.address,
      "KYC Status": KYC_STATUS_NAMES[user.kyc?.status || 0],
      Products: user.productCount,
      "Total Revenue": user.analytics?.totalRevenue || "0",
      "Total Transactions": user.analytics?.totalTransactions || "0",
      "ETH Revenue": user.analytics?.ethRevenue || "0",
      "USDT Revenue": user.analytics?.usdtRevenue || "0",
      "USDC Revenue": user.analytics?.usdcRevenue || "0",
      "Pending ETH": user.pendingPayouts?.ethAmount || "0",
      "Pending USDT": user.pendingPayouts?.usdtAmount || "0",
      "Pending USDC": user.pendingPayouts?.usdcAmount || "0",
      "KYC Submitted":
        user.kyc?.submittedAt && user.kyc.submittedAt !== "0"
          ? new Date(parseInt(user.kyc.submittedAt) * 1000).toLocaleDateString()
          : "N/A",
      "Is Owner": user.isOwner ? "Yes" : "No",
      "Is Reviewer": user.isReviewer ? "Yes" : "No",
    }));

    const csvContent = [
      Object.keys(exportData[0]).join(","),
      ...exportData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Users data exported successfully");
  };

  const hasPayouts = (user) => {
    if (!user.pendingPayouts) return false;
    return (
      parseFloat(user.pendingPayouts.ethAmount) > 0 ||
      parseFloat(user.pendingPayouts.usdtAmount) > 0 ||
      parseFloat(user.pendingPayouts.usdcAmount) > 0
    );
  };

  return (
    <Layout title="Users">
      <div className="min-h-screen space-y-8">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
              <FiUsers className="h-8 w-8 text-blue-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="text-gray-400 mt-1">
                Monitor platform users and KYC verification status
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={refreshUsers}
              disabled={refreshing}
              className="group relative overflow-hidden rounded-2xl px-4 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50"
            >
              <div className="relative flex items-center space-x-2">
                <FiRefreshCw
                  className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>Refresh</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportUsers}
              disabled={filteredUsers.length === 0}
              className="group relative overflow-hidden rounded-2xl px-6 py-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="relative flex items-center space-x-2">
                <FiDownload className="h-5 w-5" />
                <span>Export Users</span>
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* Enhanced Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6"
        >
          {/* Total Users */}
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(59, 130, 246, 0.2)",
            }}
          >
            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                <FiUsers className="h-8 w-8 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  👥 Total Users
                </p>
                <p className="text-2xl font-bold text-white">
                  {loading ? "--" : stats.total.toString()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Merchants */}
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(34, 197, 94, 0.2)",
            }}
          >
            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                <FiShoppingBag className="h-8 w-8 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  🏪 Merchants
                </p>
                <p className="text-2xl font-bold text-white">
                  {loading ? "--" : stats.merchants.toString()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Approved KYC */}
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(16, 185, 129, 0.2)",
            }}
          >
            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-600/20 to-blue-600/20 border border-indigo-500/30">
                <FiCheck className="h-8 w-8 text-indigo-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-indigo-300 mb-1">
                  ✅ Approved
                </p>
                <p className="text-2xl font-bold text-white">
                  {loading ? "--" : stats.approved.toString()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Pending KYC */}
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(245, 158, 11, 0.2)",
            }}
          >
            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                <FiClock className="h-8 w-8 text-yellow-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-300 mb-1">
                  ⏳ Pending
                </p>
                <p className="text-2xl font-bold text-white">
                  {loading ? "--" : stats.pending.toString()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Reviewers */}
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
            }}
          >
            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                <FiUserCheck className="h-8 w-8 text-purple-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-300 mb-1">
                  🔍 Reviewers
                </p>
                <p className="text-2xl font-bold text-white">
                  {loading ? "--" : stats.reviewers.toString()}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-purple-400 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search by wallet address..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="w-full pl-12 pr-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                    borderColor: "rgba(139, 92, 246, 0.2)",
                  }}
                />
              </div>
            </div>

            {/* KYC Status Filter */}
            <div className="relative">
              <FiShield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400 pointer-events-none" />
              <select
                value={filters.kycStatus}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, kycStatus: e.target.value }))
                }
                className="w-full pl-10 pr-8 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent appearance-none cursor-pointer"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
                  borderColor: "rgba(34, 197, 94, 0.2)",
                }}
              >
                <option value="all" className="bg-gray-800">
                  All KYC Status
                </option>
                <option value="approved" className="bg-gray-800">
                  ✅ Approved
                </option>
                <option value="pending" className="bg-gray-800">
                  ⏳ Pending
                </option>
                <option value="rejected" className="bg-gray-800">
                  ❌ Rejected
                </option>
                <option value="notsubmitted" className="bg-gray-800">
                  📝 Not Submitted
                </option>
                <option value="cancelled" className="bg-gray-800">
                  🚫 Cancelled
                </option>
              </select>
            </div>

            {/* User Type Filter */}
            <div className="relative">
              <FiUsers className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400 pointer-events-none" />
              <select
                value={filters.userType}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, userType: e.target.value }))
                }
                className="w-full pl-10 pr-8 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent appearance-none cursor-pointer"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
                  borderColor: "rgba(59, 130, 246, 0.2)",
                }}
              >
                <option value="all" className="bg-gray-800">
                  All Users
                </option>
                <option value="merchants" className="bg-gray-800">
                  🏪 Merchants
                </option>
                <option value="buyers" className="bg-gray-800">
                  👤 Buyers
                </option>
                <option value="owners" className="bg-gray-800">
                  👑 Owners
                </option>
                <option value="reviewers" className="bg-gray-800">
                  🔍 Reviewers
                </option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Users Table */}
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
          <div className="relative z-10">
            {/* Table Header */}
            <div className="px-8 py-6 border-b border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                    <FiDatabase className="h-5 w-5 text-purple-300" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    👥 Platform Users ({filteredUsers.length})
                  </h3>
                </div>
                {isOwner && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-yellow-300 font-semibold">
                      Admin Mode
                    </span>
                    <TfiCrown className="h-5 w-5 text-yellow-400" />
                  </div>
                )}
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
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-2xl animate-pulse"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-lg w-1/3 animate-pulse"></div>
                        <div className="h-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg w-1/4 animate-pulse"></div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-500/10">
                      <th className="px-8 py-4 text-left text-xs font-bold text-purple-300 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-blue-300 uppercase tracking-wider">
                        KYC Status
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-blue-300 uppercase tracking-wider">
                        Activity
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-cyan-300 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-yellow-300 uppercase tracking-wider">
                        Pending Payouts
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/5">
                    <AnimatePresence>
                      {filteredUsers.map((user, index) => (
                        <motion.tr
                          key={user.address}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{
                            backgroundColor: "rgba(139, 92, 246, 0.05)",
                          }}
                          className="group transition-colors duration-200 cursor-pointer"
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center space-x-4">
                              <div className="relative">
                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
                                  <span className="text-sm font-bold text-white">
                                    {user.address.slice(2, 4).toUpperCase()}
                                  </span>
                                </div>
                                {user.isOwner && (
                                  <div className="absolute -top-1 -right-1 p-1 rounded-full bg-gradient-to-r from-yellow-600 to-amber-600 border-2 border-gray-900">
                                    <TfiCrown className="h-3 w-3 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-sm font-bold text-white font-mono">
                                    {user.address.slice(0, 6)}...
                                    {user.address.slice(-4)}
                                  </span>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(
                                        user.address,
                                        "User address"
                                      );
                                    }}
                                    className="p-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                                  >
                                    <FiCopy className="h-3 w-3" />
                                  </motion.button>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {user.isOwner && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-600/30 to-amber-600/30 border border-yellow-500/50 text-yellow-300">
                                      <TfiCrown className="h-3 w-3 mr-1" />
                                      Owner
                                    </span>
                                  )}
                                  {user.isReviewer && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border border-purple-500/50 text-purple-300">
                                      <FiUserCheck className="h-3 w-3 mr-1" />
                                      Reviewer
                                    </span>
                                  )}
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                      user.productCount > 0
                                        ? "bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/50 text-blue-300"
                                        : "bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-blue-500/50 text-blue-300"
                                    }`}
                                  >
                                    {user.productCount > 0 ? (
                                      <>
                                        <FiShoppingBag className="h-3 w-3 mr-1" />
                                        Merchant
                                      </>
                                    ) : (
                                      <>
                                        <FiUsers className="h-3 w-3 mr-1" />
                                        User
                                      </>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-8 py-6">
                            <div className="flex items-center space-x-3">
                              {getStatusBadge(user.kyc?.status || 0)}
                              {isOwner &&
                                user.kyc?.status === KYC_STATUS.Pending && (
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openKYCReview(user);
                                    }}
                                    className="p-1 rounded-lg bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 text-yellow-300 hover:text-white transition-colors"
                                    title="Review KYC"
                                  >
                                    <FiEdit className="h-3 w-3" />
                                  </motion.button>
                                )}
                            </div>
                          </td>

                          <td className="px-8 py-6">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                                  <FiShoppingBag className="h-4 w-4 text-blue-300" />
                                </div>
                                <span className="text-sm font-bold text-white">
                                  {user.productCount} Products
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="p-2 rounded-lg bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                                  <FiActivity className="h-4 w-4 text-purple-300" />
                                </div>
                                <span className="text-sm font-bold text-white">
                                  {user.analytics?.totalTransactions || "0"}{" "}
                                  Transactions
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-8 py-6">
                            {user.analytics ? (
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                                    <FiDollarSign className="h-4 w-4 text-blue-300" />
                                  </div>
                                  <span className="text-sm font-bold text-white">
                                    $
                                    {parseFloat(
                                      user.analytics.totalRevenue
                                    ).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400 space-y-1">
                                  <div>ETH: {user.analytics.ethRevenue}</div>
                                  <div>USDT: ${user.analytics.usdtRevenue}</div>
                                  <div>USDC: ${user.analytics.usdcRevenue}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">
                                No revenue data
                              </span>
                            )}
                          </td>

                          <td className="px-8 py-6">
                            {user.pendingPayouts && hasPayouts(user) ? (
                              <div className="space-y-2">
                                {parseFloat(user.pendingPayouts.ethAmount) >
                                  0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-blue-300">
                                      {user.pendingPayouts.ethAmount} ETH
                                    </span>
                                    {isOwner && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          processPayout(user.address, 0); // ETH = 0
                                        }}
                                        disabled={
                                          actionLoading[
                                            `payout_${user.address}_0`
                                          ]
                                        }
                                        className="px-2 py-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors text-xs disabled:opacity-50"
                                      >
                                        {actionLoading[
                                          `payout_${user.address}_0`
                                        ]
                                          ? "..."
                                          : "Pay"}
                                      </motion.button>
                                    )}
                                  </div>
                                )}
                                {parseFloat(user.pendingPayouts.usdtAmount) >
                                  0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-blue-300">
                                      ${user.pendingPayouts.usdtAmount} USDT
                                    </span>
                                    {isOwner && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          processPayout(user.address, 1); // USDT = 1
                                        }}
                                        disabled={
                                          actionLoading[
                                            `payout_${user.address}_1`
                                          ]
                                        }
                                        className="px-2 py-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors text-xs disabled:opacity-50"
                                      >
                                        {actionLoading[
                                          `payout_${user.address}_1`
                                        ]
                                          ? "..."
                                          : "Pay"}
                                      </motion.button>
                                    )}
                                  </div>
                                )}
                                {parseFloat(user.pendingPayouts.usdcAmount) >
                                  0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-cyan-300">
                                      ${user.pendingPayouts.usdcAmount} USDC
                                    </span>
                                    {isOwner && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          processPayout(user.address, 2); // USDC = 2
                                        }}
                                        disabled={
                                          actionLoading[
                                            `payout_${user.address}_2`
                                          ]
                                        }
                                        className="px-2 py-1 rounded-lg bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 text-cyan-300 hover:text-white transition-colors text-xs disabled:opacity-50"
                                      >
                                        {actionLoading[
                                          `payout_${user.address}_2`
                                        ]
                                          ? "..."
                                          : "Pay"}
                                      </motion.button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">
                                No pending payouts
                              </span>
                            )}
                          </td>

                          <td className="px-8 py-6">
                            <div className="flex items-center space-x-2">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => openUserDetails(user)}
                                className="p-2 rounded-lg bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 text-cyan-300 hover:text-white transition-colors"
                                title="View User Details"
                              >
                                <FiEye className="h-4 w-4" />
                              </motion.button>

                              {/* Admin Actions */}
                              {isOwner && !user.isOwner && (
                                <>
                                  {!user.isReviewer ? (
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addReviewer(user.address);
                                      }}
                                      disabled={actionLoading[user.address]}
                                      className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors disabled:opacity-50"
                                      title="Add as Reviewer"
                                    >
                                      {actionLoading[user.address] ? (
                                        <FiRefreshCw className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <FiUserCheck className="h-4 w-4" />
                                      )}
                                    </motion.button>
                                  ) : (
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeReviewer(user.address);
                                      }}
                                      disabled={actionLoading[user.address]}
                                      className="p-2 rounded-lg bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors disabled:opacity-50"
                                      title="Remove Reviewer"
                                    >
                                      {actionLoading[user.address] ? (
                                        <FiRefreshCw className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <FiUserX className="h-4 w-4" />
                                      )}
                                    </motion.button>
                                  )}
                                </>
                              )}
                            </div>
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
                  <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full blur-xl"></div>
                  <div className="relative p-8 rounded-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30">
                    <FiUsers className="h-16 w-16 text-blue-300 mx-auto" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mt-6 mb-3">
                  No users found
                </h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  {Object.values(filters).some((f) => f !== "all" && f !== "")
                    ? "Try adjusting your search or filter criteria to find users"
                    : "No users have registered for KYC verification yet"}
                </p>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <FiShield className="h-4 w-4" />
                  <span>Secure • Verified • Compliant</span>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Enhanced User Details Modal */}
        <UserDetailsModal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          isOwner={isOwner}
          onCopy={copyToClipboard}
        />

        {/* KYC Review Modal */}
        <AnimatePresence>
          {showKYCReviewModal && (
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
                  onClick={() => setShowKYCReviewModal(false)}
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative inline-block w-full max-w-2xl p-8 my-8 overflow-hidden text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 50%, rgba(15, 11, 19, 0.95) 100%)",
                    borderColor: "rgba(245, 158, 11, 0.3)",
                    boxShadow: "0 25px 50px rgba(245, 158, 11, 0.2)",
                  }}
                >
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                          <FiShield className="h-6 w-6 text-yellow-300" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                            Review KYC Application
                          </h3>
                          <p className="text-gray-400 mt-1">
                            Review and approve or reject the KYC verification
                          </p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowKYCReviewModal(false)}
                        className="p-3 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors"
                      >
                        <FiX className="w-6 h-6" />
                      </motion.button>
                    </div>

                    {/* Form */}
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20">
                        <span className="text-sm text-blue-300 font-semibold">
                          User Address:
                        </span>
                        <p className="text-white font-mono text-sm mt-1 break-all">
                          {kycReviewForm.userAddress}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-sm font-semibold text-gray-300">
                          Review Decision:
                        </label>
                        <div className="flex space-x-4">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() =>
                              setKycReviewForm((prev) => ({
                                ...prev,
                                approved: true,
                              }))
                            }
                            className={`flex-1 p-4 rounded-xl border transition-all duration-300 ${
                              kycReviewForm.approved
                                ? "bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border-blue-500/50 text-blue-300"
                                : "bg-gradient-to-r from-gray-600/10 to-gray-500/10 border-gray-500/20 text-gray-400"
                            }`}
                          >
                            <div className="flex items-center justify-center space-x-2">
                              <FiCheck className="h-5 w-5" />
                              <span className="font-semibold">Approve KYC</span>
                            </div>
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() =>
                              setKycReviewForm((prev) => ({
                                ...prev,
                                approved: false,
                              }))
                            }
                            className={`flex-1 p-4 rounded-xl border transition-all duration-300 ${
                              !kycReviewForm.approved
                                ? "bg-gradient-to-r from-red-600/30 to-indigo-600/30 border-red-500/50 text-red-300"
                                : "bg-gradient-to-r from-gray-600/10 to-gray-500/10 border-gray-500/20 text-gray-400"
                            }`}
                          >
                            <div className="flex items-center justify-center space-x-2">
                              <FiX className="h-5 w-5" />
                              <span className="font-semibold">Reject KYC</span>
                            </div>
                          </motion.button>
                        </div>
                      </div>

                      {!kycReviewForm.approved && (
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-red-300">
                            Rejection Reason:
                          </label>
                          <textarea
                            value={kycReviewForm.rejectionReason}
                            onChange={(e) =>
                              setKycReviewForm((prev) => ({
                                ...prev,
                                rejectionReason: e.target.value,
                              }))
                            }
                            placeholder="Please provide a clear reason for rejection..."
                            rows={4}
                            className="w-full p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-transparent resize-none"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                              borderColor: "rgba(239, 68, 68, 0.2)",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-4 pt-8 mt-8 border-t border-yellow-500/20">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowKYCReviewModal(false)}
                        className="px-6 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                        style={{ borderColor: "rgba(245, 158, 11, 0.3)" }}
                      >
                        Cancel
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={submitKYCReview}
                        disabled={
                          actionLoading.kycReview ||
                          (!kycReviewForm.approved &&
                            !kycReviewForm.rejectionReason.trim())
                        }
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 text-white font-semibold shadow-lg hover:shadow-yellow-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading.kycReview ? (
                          <div className="flex items-center space-x-2">
                            <FiRefreshCw className="h-4 w-4 animate-spin" />
                            <span>Processing...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            {kycReviewForm.approved ? (
                              <FiCheck className="h-4 w-4" />
                            ) : (
                              <FiX className="h-4 w-4" />
                            )}
                            <span>
                              {kycReviewForm.approved
                                ? "Approve KYC"
                                : "Reject KYC"}
                            </span>
                          </div>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

// Enhanced User Details Modal Component
const UserDetailsModal = ({ isOpen, onClose, user, isOwner, onCopy }) => {
  if (!isOpen || !user) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case KYC_STATUS.Approved:
        return <FiCheck className="h-4 w-4 text-blue-400" />;
      case KYC_STATUS.Rejected:
        return <FiX className="h-4 w-4 text-red-400" />;
      case KYC_STATUS.Pending:
        return <FiClock className="h-4 w-4 text-yellow-400" />;
      case KYC_STATUS.Cancelled:
        return <FiXCircle className="h-4 w-4 text-orange-400" />;
      default:
        return <FiShield className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      [KYC_STATUS.Approved]: {
        bg: "from-blue-600/30 to-indigo-600/30",
        border: "border-blue-500/50",
        text: "text-blue-300",
      },
      [KYC_STATUS.Rejected]: {
        bg: "from-red-600/30 to-indigo-600/30",
        border: "border-red-500/50",
        text: "text-red-300",
      },
      [KYC_STATUS.Pending]: {
        bg: "from-yellow-600/30 to-orange-600/30",
        border: "border-yellow-500/50",
        text: "text-yellow-300",
      },
      [KYC_STATUS.Cancelled]: {
        bg: "from-orange-600/30 to-red-600/30",
        border: "border-orange-500/50",
        text: "text-orange-300",
      },
      default: {
        bg: "from-gray-600/30 to-slate-600/30",
        border: "border-gray-500/50",
        text: "text-gray-300",
      },
    };

    const config = configs[status] || configs.default;

    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm border ${config.border} ${config.text}`}
        style={{
          background: `linear-gradient(135deg, ${config.bg})`,
        }}
      >
        {getStatusIcon(status)}
        <span className="ml-2">{KYC_STATUS_NAMES[status] || "Unknown"}</span>
      </motion.span>
    );
  };

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
            className="relative inline-block w-full max-w-4xl p-8 my-8 overflow-hidden text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 50%, rgba(15, 11, 19, 0.95) 100%)",
              borderColor: "rgba(139, 92, 246, 0.3)",
              boxShadow: "0 25px 50px rgba(139, 92, 246, 0.2)",
            }}
          >
            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
                      <span className="text-xl font-bold text-white">
                        {user.address.slice(2, 4).toUpperCase()}
                      </span>
                    </div>
                    {user.isOwner && (
                      <div className="absolute -top-2 -right-2 p-2 rounded-full bg-gradient-to-r from-yellow-600 to-amber-600 border-2 border-gray-900">
                        <TfiCrown className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
                      User Profile Details
                    </h3>
                    <p className="text-gray-400 mt-1">
                      Comprehensive user information and verification status
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-3 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors"
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* User Information */}
                  <div
                    className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
                      borderColor: "rgba(59, 130, 246, 0.2)",
                    }}
                  >
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                        <FiUsers className="h-5 w-5 text-blue-300" />
                      </div>
                      <h4 className="font-bold text-blue-300 text-lg">
                        👤 User Information
                      </h4>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-gray-600/10 to-gray-500/10 border border-gray-500/20">
                        <span className="text-sm text-gray-400 block mb-1">
                          Wallet Address:
                        </span>
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-sm text-white break-all bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-500/20">
                            {user.address}
                          </p>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onCopy(user.address, "User address")}
                            className="ml-2 p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                          >
                            <FiCopy className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {user.isOwner && (
                          <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-yellow-600/30 to-amber-600/30 border border-yellow-500/50 text-yellow-300">
                            <TfiCrown className="h-4 w-4 mr-2" />
                            👑 Platform Owner
                          </span>
                        )}
                        {user.isReviewer && (
                          <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border border-purple-500/50 text-purple-300">
                            <FiUserCheck className="h-4 w-4 mr-2" />
                            🔍 KYC Reviewer
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-bold ${
                            user.productCount > 0
                              ? "bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/50 text-blue-300"
                              : "bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-blue-500/50 text-blue-300"
                          }`}
                        >
                          {user.productCount > 0 ? (
                            <>
                              <FiShoppingBag className="h-4 w-4 mr-2" />
                              🏪 Merchant
                            </>
                          ) : (
                            <>
                              <FiUsers className="h-4 w-4 mr-2" />
                              👤 Regular User
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KYC Information */}
                  {user.kyc && (
                    <div
                      className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)",
                        borderColor: "rgba(245, 158, 11, 0.2)",
                      }}
                    >
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                          <FiShield className="h-5 w-5 text-yellow-300" />
                        </div>
                        <h4 className="font-bold text-yellow-300 text-lg">
                          🛡️ KYC Verification
                        </h4>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-300">
                            Verification Status:
                          </span>
                          {getStatusBadge(user.kyc.status)}
                        </div>

                        {user.kyc.id && (
                          <div className="p-3 rounded-xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20">
                            <div className="flex items-center space-x-2 mb-1">
                              <FiDatabase className="h-4 w-4 text-purple-300" />
                              <span className="text-sm font-semibold text-purple-300">
                                KYC ID:
                              </span>
                            </div>
                            <p className="text-sm text-white font-medium">
                              #{user.kyc.id}
                            </p>
                          </div>
                        )}

                        {user.kyc.submittedAt !== "0" && (
                          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20">
                            <div className="flex items-center space-x-2 mb-1">
                              <FiCalendar className="h-4 w-4 text-blue-300" />
                              <span className="text-sm font-semibold text-blue-300">
                                Submitted:
                              </span>
                            </div>
                            <p className="text-sm text-white font-medium">
                              {new Date(
                                parseInt(user.kyc.submittedAt) * 1000
                              ).toLocaleString()}
                            </p>
                          </div>
                        )}

                        {user.kyc.reviewedAt !== "0" && (
                          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20">
                            <div className="flex items-center space-x-2 mb-1">
                              <FiUserCheck className="h-4 w-4 text-blue-300" />
                              <span className="text-sm font-semibold text-blue-300">
                                Reviewed:
                              </span>
                            </div>
                            <p className="text-sm text-white font-medium">
                              {new Date(
                                parseInt(user.kyc.reviewedAt) * 1000
                              ).toLocaleString()}
                            </p>
                            {user.kyc.reviewedBy &&
                              user.kyc.reviewedBy !==
                                "0x0000000000000000000000000000000000000000" && (
                                <p className="text-xs text-gray-400 mt-1">
                                  Reviewed by: {user.kyc.reviewedBy.slice(0, 6)}
                                  ...{user.kyc.reviewedBy.slice(-4)}
                                </p>
                              )}
                          </div>
                        )}

                        {user.kyc.rejectionReason && (
                          <div className="p-3 rounded-xl bg-gradient-to-r from-red-600/10 to-indigo-600/10 border border-red-500/20">
                            <div className="flex items-center space-x-2 mb-1">
                              <FiUserX className="h-4 w-4 text-red-300" />
                              <span className="text-sm font-semibold text-red-300">
                                Rejection Reason:
                              </span>
                            </div>
                            <p className="text-sm text-red-200">
                              {user.kyc.rejectionReason}
                            </p>
                          </div>
                        )}

                        {user.kyc.ipfsHash && (
                          <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-600/10 to-blue-600/10 border border-cyan-500/20">
                            <div className="flex items-center space-x-2 mb-1">
                              <FiDatabase className="h-4 w-4 text-cyan-300" />
                              <span className="text-sm font-semibold text-cyan-300">
                                IPFS Document Hash:
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-white font-mono break-all">
                                {user.kyc.ipfsHash}
                              </p>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  onCopy(user.kyc.ipfsHash, "IPFS hash")
                                }
                                className="ml-2 p-1 rounded-lg bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 text-cyan-300 hover:text-white transition-colors"
                              >
                                <FiCopy className="h-3 w-3" />
                              </motion.button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Performance Metrics */}
                  {user.analytics && (
                    <div
                      className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
                        borderColor: "rgba(34, 197, 94, 0.2)",
                      }}
                    >
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                          <FiTrendingUp className="h-5 w-5 text-blue-300" />
                        </div>
                        <h4 className="font-bold text-blue-300 text-lg">
                          📊 Performance Metrics
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20">
                          <div className="flex items-center space-x-2 mb-2">
                            <FiDollarSign className="h-5 w-5 text-blue-300" />
                            <span className="text-sm text-blue-300 font-semibold">
                              Total Revenue
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            $
                            {parseFloat(
                              user.analytics.totalRevenue
                            ).toLocaleString()}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                            <div className="flex items-center space-x-2 mb-2">
                              <FiActivity className="h-4 w-4 text-blue-300" />
                              <span className="text-xs text-blue-300 font-semibold">
                                Transactions
                              </span>
                            </div>
                            <p className="text-lg font-bold text-white">
                              {user.analytics.totalTransactions}
                            </p>
                          </div>

                          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20">
                            <div className="flex items-center space-x-2 mb-2">
                              <FiShoppingBag className="h-4 w-4 text-purple-300" />
                              <span className="text-xs text-purple-300 font-semibold">
                                Products
                              </span>
                            </div>
                            <p className="text-lg font-bold text-white">
                              {user.productCount}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-blue-600/10 border border-blue-500/20">
                          <span className="text-sm text-blue-300 font-semibold">
                            🔷 ETH Revenue:
                          </span>
                          <span className="text-sm font-bold text-white">
                            {user.analytics.ethRevenue} ETH
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                          <span className="text-sm text-blue-300 font-semibold">
                            💚 USDT Revenue:
                          </span>
                          <span className="text-sm font-bold text-white">
                            ${user.analytics.usdtRevenue}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-cyan-600/10 to-blue-600/10 border border-cyan-500/20">
                          <span className="text-sm text-cyan-300 font-semibold">
                            🔵 USDC Revenue:
                          </span>
                          <span className="text-sm font-bold text-white">
                            ${user.analytics.usdcRevenue}
                          </span>
                        </div>
                      </div>

                      {user.analytics.lastPayoutTime !== "0" && (
                        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20">
                          <div className="flex items-center space-x-2 mb-1">
                            <FiCalendar className="h-4 w-4 text-purple-300" />
                            <span className="text-sm font-semibold text-purple-300">
                              Last Payout:
                            </span>
                          </div>
                          <p className="text-sm text-white">
                            {new Date(
                              parseInt(user.analytics.lastPayoutTime) * 1000
                            ).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pending Payouts */}
                  {user.pendingPayouts && (
                    <div
                      className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)",
                        borderColor: "rgba(251, 191, 36, 0.2)",
                      }}
                    >
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                          <FiDollarSign className="h-5 w-5 text-yellow-300" />
                        </div>
                        <h4 className="font-bold text-yellow-300 text-lg">
                          💰 Pending Payouts
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {parseFloat(user.pendingPayouts.ethAmount) > 0 && (
                          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-blue-600/10 border border-blue-500/20">
                            <span className="text-sm text-blue-300 font-semibold">
                              🔷 ETH:
                            </span>
                            <span className="text-sm font-bold text-white">
                              {user.pendingPayouts.ethAmount} ETH
                            </span>
                          </div>
                        )}
                        {parseFloat(user.pendingPayouts.usdtAmount) > 0 && (
                          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                            <span className="text-sm text-blue-300 font-semibold">
                              💚 USDT:
                            </span>
                            <span className="text-sm font-bold text-white">
                              ${user.pendingPayouts.usdtAmount}
                            </span>
                          </div>
                        )}
                        {parseFloat(user.pendingPayouts.usdcAmount) > 0 && (
                          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-cyan-600/10 to-blue-600/10 border border-cyan-500/20">
                            <span className="text-sm text-cyan-300 font-semibold">
                              🔵 USDC:
                            </span>
                            <span className="text-sm font-bold text-white">
                              ${user.pendingPayouts.usdcAmount}
                            </span>
                          </div>
                        )}

                        {parseFloat(user.pendingPayouts.ethAmount) === 0 &&
                          parseFloat(user.pendingPayouts.usdtAmount) === 0 &&
                          parseFloat(user.pendingPayouts.usdcAmount) === 0 && (
                            <div className="text-center py-4">
                              <span className="text-gray-400 text-sm">
                                No pending payouts
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Products Summary */}
                  {user.products && user.products.length > 0 && (
                    <div
                      className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                        borderColor: "rgba(139, 92, 246, 0.2)",
                      }}
                    >
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                          <FiShoppingBag className="h-5 w-5 text-purple-300" />
                        </div>
                        <h4 className="font-bold text-purple-300 text-lg">
                          🛍️ Products ({user.products.length})
                        </h4>
                      </div>

                      <div className="space-y-3 max-h-40 overflow-y-auto">
                        {user.products.slice(0, 5).map((product, index) => (
                          <div
                            key={product.id}
                            className="p-3 rounded-xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-white truncate">
                                {product.name}
                              </span>
                              <span className="text-xs text-purple-300">
                                #{product.id}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-400">
                                Sales: {product.totalSales}
                              </span>
                              <span className="text-xs text-blue-300">
                                $
                                {parseFloat(
                                  product.totalRevenue || 0
                                ).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                        {user.products.length > 5 && (
                          <div className="text-center py-2">
                            <span className="text-xs text-gray-400">
                              +{user.products.length - 5} more products
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end space-x-4 pt-8 mt-8 border-t border-purple-500/20">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                  style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
                >
                  Close
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
export default Users;
