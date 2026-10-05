import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiShield,
  FiSettings,
  FiUsers,
  FiDollarSign,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiClock,
  FiRefreshCw,
  FiEye,
  FiEdit,
  FiTrash2,
  FiPause,
  FiPlay,
  FiDownload,
  FiUpload,
  FiBarChart,
  FiActivity,
  FiLock,
  FiUnlock,
  FiUserPlus,
  FiUserMinus,
  FiTrendingUp,
  FiFileText,
  FiDatabase,
  FiZap,
  FiCpu,
  FiServer,
  FiGlobe,
  FiCommand,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import { contractService } from "../services/contract";
import { pinataService } from "../services/pinata";
import {
  KYC_STATUS,
  KYC_STATUS_NAMES,
  MAX_FEE_RATE,
  TOKEN_NAMES,
  isAdminAddress,
} from "../lib/constants";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";

import ActivityTab from "../components/Admin/ActivityTab";
import KYCTab from "../components/Admin/KYCTab";
import OverviewTab from "../components/Admin/OverviewTab";
import SecurityTab from "../components/Admin/SecurityTab";
import SettingsTab from "../components/Admin/SettingsTab";
import UsersTab from "../components/Admin/UsersTab";

const Admin = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [withdrawalLoading, setWithdrawalLoading] = useState({});
  const [contractBalances, setContractBalances] = useState({
    eth: "0",
    usdt: "0",
    usdc: "0",
  });

  const [adminData, setAdminData] = useState({
    isOwner: false,
    platformStats: null,
    recentActivity: [],
    pendingKYC: [],
    systemHealth: null,
    loading: true,
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [settings, setSettings] = useState({
    platformFee: "250",
    isPaused: false,
    maintenanceMode: false,
  });

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [reviewers, setReviewers] = useState([]);
  const [newReviewer, setNewReviewer] = useState("");

  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    if (isConnected && address) {
      checkAdminAccess();
      loadContractBalances();
    }
  }, [isConnected, address]);

  const checkAdminAccess = async () => {
    try {
      setAdminData((prev) => ({ ...prev, loading: true }));

      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);

      // Check if user is owner or configured admin
      let isOwner = isAdminAddress(address);
      if (!isOwner) {
        try {
          const owner = await contract.owner();
          isOwner = owner && owner.toLowerCase() === address.toLowerCase();
        } catch (e) {
          console.warn("Could not query contract owner:", e);
        }
      }

      if (!isOwner) {
        toast.error("Access denied. Admin privileges required.");
        setAdminData((prev) => ({ ...prev, isOwner: false, loading: false }));
        return;
      }

      // Load admin data
      try {
        await loadAdminData(contract);
      } catch (err) {
        console.warn("Error loading admin data from contract:", err);
      }

      setAdminData((prev) => ({ ...prev, isOwner: true, loading: false }));
    } catch (error) {
      console.error("Error checking admin access:", error);
      if (isAdminAddress(address)) {
        setAdminData((prev) => ({ ...prev, isOwner: true, loading: false }));
      } else {
        toast.error("Failed to verify admin access");
        setAdminData((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  const loadAdminData = async (contract) => {
    try {
      // Load platform analytics
      const platformResult = await contractService.getPlatformAnalytics(
        contract
      );

      // Load pending KYC submissions
      const kycUsers = await contract.getKYCUsers();
      const pendingKYC = [];

      for (const userAddr of kycUsers.slice(0, 10)) {
        // Limit to recent 10
        const kycResult = await contractService.getKYCData(contract, userAddr);
        if (kycResult.success && kycResult.data.status === KYC_STATUS.Pending) {
          pendingKYC.push({
            ...kycResult.data,
            userAddress: userAddr,
          });
        }
      }

      // Load recent transactions for activity feed
      const transactionsResult = await contractService.getAllTransactions(
        contract
      );

      // Get all authorized reviewers using contract service
      const reviewersResult = await contractService.getAllAuthorizedReviewers(
        contract
      );
      const authorizedReviewersList = reviewersResult.success
        ? reviewersResult.data
        : [];
      setReviewers(authorizedReviewersList);

      const recentActivity = transactionsResult.success
        ? transactionsResult.data
            .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
            .slice(0, 10)
        : [];

      // Get platform fee
      const platformFee = await contract.platformFeeRate();

      // Check if contract is paused
      const isPaused = await contract.paused();

      setAdminData((prev) => ({
        ...prev,
        platformStats: platformResult.success ? platformResult.data : null,
        pendingKYC,
        recentActivity,
        systemHealth: {
          totalUsers: kycUsers.length,
          activeTransactions: recentActivity.length,
          pendingKYC: pendingKYC.length,
          platformFee: platformFee.toString(),
          isPaused,
        },
      }));

      setSettings((prev) => ({
        ...prev,
        platformFee: platformFee.toString(),
        isPaused,
      }));
    } catch (error) {
      console.error("Error loading admin data:", error);
      toast.error("Failed to load admin data");
    }
  };

  const handleUpdatePlatformFee = async (newFeeRate) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.updatePlatformFee(
        contract,
        parseInt(newFeeRate)
      );

      if (result.success) {
        toast.success("Platform fee updated successfully!");
        setSettings((prev) => ({ ...prev, platformFee: newFeeRate }));
        await loadAdminData(contractService.getReadOnlyContract(CONTRACT_ABI));
      } else {
        toast.error("Failed to update platform fee");
      }
    } catch (error) {
      console.error("Error updating platform fee:", error);
      toast.error("Failed to update platform fee");
    }
  };

  const handleEmergencyPause = async () => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.emergencyPause(contract);

      if (result.success) {
        toast.success("Contract paused successfully!");
        setSettings((prev) => ({ ...prev, isPaused: true }));
      } else {
        toast.error("Failed to pause contract");
      }
    } catch (error) {
      console.error("Error pausing contract:", error);
      toast.error("Failed to pause contract");
    }
  };

  const handleEmergencyUnpause = async () => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.emergencyUnpause(contract);

      if (result.success) {
        toast.success("Contract unpaused successfully!");
        setSettings((prev) => ({ ...prev, isPaused: false }));
      } else {
        toast.error("Failed to unpause contract");
      }
    } catch (error) {
      console.error("Error unpausing contract:", error);
      toast.error("Failed to unpause contract");
    }
  };

  const handleKYCReview = async (
    userAddress,
    approved,
    rejectionReason = ""
  ) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.reviewKYC(
        contract,
        userAddress,
        approved,
        rejectionReason
      );

      if (result.success) {
        toast.success(
          `KYC ${approved ? "approved" : "rejected"} successfully!`
        );
        await loadAdminData(contractService.getReadOnlyContract(CONTRACT_ABI));
      } else {
        toast.error("Failed to review KYC");
      }
    } catch (error) {
      console.error("Error reviewing KYC:", error);
      toast.error("Failed to review KYC");
    }
  };

  const addReviewer = async () => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      if (!newReviewer || !newReviewer.match(/^0x[a-fA-F0-9]{40}$/)) {
        toast.error("Please enter a valid Ethereum address");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.addReviewer(contract, newReviewer);

      if (result.success) {
        toast.success("Reviewer added successfully!");
        setReviewers((prev) => [...prev, newReviewer]);
        setNewReviewer("");
      } else {
        toast.error("Failed to add reviewer");
      }
    } catch (error) {
      console.error("Error adding reviewer:", error);
      toast.error("Failed to add reviewer");
    }
  };

  const removeReviewer = async (reviewerAddress) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = contractService.getContract(walletClient, CONTRACT_ABI);
      const result = await contractService.removeReviewer(
        contract,
        reviewerAddress
      );

      if (result.success) {
        toast.success("Reviewer removed successfully!");
        setReviewers((prev) => prev.filter((addr) => addr !== reviewerAddress));
      } else {
        toast.error("Failed to remove reviewer");
      }
    } catch (error) {
      console.error("Error removing reviewer:", error);
      toast.error("Failed to remove reviewer");
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setShowModal(true);
  };

  // Function to load contract balances
  const loadContractBalances = async () => {
    if (!walletClient) return;

    try {
      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const balancesResult = await contractService.getContractBalances(
        contract
      );

      if (balancesResult.success) {
        setContractBalances(balancesResult.data);
      }
    } catch (error) {
      console.error("Error loading contract balances:", error);
    }
  };

  // Function to withdraw platform fees
  const withdrawPlatformFees = async (tokenType, amount) => {
    if (!walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      setWithdrawalLoading((prev) => ({ ...prev, [tokenType]: true }));

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.withdrawPlatformFees(
        contract,
        tokenType,
        amount
      );

      if (result.success) {
        toast.success(result.message);

        // Wait for transaction confirmation
        await result.tx.wait();

        // Reload balances after successful withdrawal
        await loadContractBalances();

        console.log(
          `✅ Successfully withdrew ${result.amount} ${result.token}`
        );
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error withdrawing platform fees:", error);
      toast.error(`Failed to withdraw fees: ${error.message}`);
    } finally {
      setWithdrawalLoading((prev) => ({ ...prev, [tokenType]: false }));
    }
  };

  // Example usage in JSX
  const handleWithdraw = (tokenType) => {
    const amounts = {
      0: contractBalances.eth, // ETH
      1: contractBalances.usdt, // USDT
      2: contractBalances.usdc, // USDC
    };

    const amount = prompt(
      `Enter amount to withdraw (Available: ${amounts[tokenType]})`
    );
    if (amount && parseFloat(amount) > 0) {
      withdrawPlatformFees(tokenType, amount);
    }
  };

  const tabs = [
    { id: "overview", name: "Overview", icon: FiBarChart },
    { id: "kyc", name: "KYC Review", icon: FiShield },
    { id: "settings", name: "Platform Settings", icon: FiSettings },
    { id: "security", name: "Security", icon: FiLock },
    { id: "activity", name: "Activity Log", icon: FiActivity },
  ];

  if (adminData.loading) {
    return (
      <Layout title="Admin Dashboard">
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="relative inline-block">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-full blur-xl animate-pulse"></div>
              <div className="relative p-6 rounded-full bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/30">
                <FiRefreshCw className="animate-spin h-12 w-12 text-purple-300" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mt-6 mb-2">
              Loading Admin Dashboard
            </h3>
            <p className="text-gray-400">
              Verifying permissions and loading system data...
            </p>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (!adminData.isOwner) {
    return (
      <Layout title="Admin Dashboard">
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="relative inline-block">
              <div className="absolute -inset-4 bg-gradient-to-r from-red-600/20 to-indigo-600/20 rounded-full blur-xl"></div>
              <div className="relative p-6 rounded-full bg-gradient-to-r from-red-600/10 to-indigo-600/10 border border-red-500/30">
                <FiLock className="h-16 w-16 text-red-300 mx-auto" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mt-6 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-400 max-w-md mx-auto">
              You don't have administrative privileges to access this dashboard.
              Only contract owners can manage platform operations.
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mt-4">
              <FiShield className="h-4 w-4" />
              <span>Secure • Protected • Authorized Access Only</span>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard">
      <div className="min-h-screen space-y-8">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-red-600/20 to-purple-600/20 border border-red-500/30">
              <FiCommand className="h-8 w-8 text-red-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-gray-400 mt-1">
                Comprehensive blockchain payment gateway management
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {settings.isPaused && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300"
              >
                <FiPause className="h-4 w-4 mr-2" />
                Contract Paused
              </motion.div>
            )}
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                loadAdminData(contractService.getReadOnlyContract(CONTRACT_ABI))
              }
              className="group relative overflow-hidden rounded-2xl px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
            >
              {/* Button glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

              <div className="relative flex items-center space-x-2">
                <FiRefreshCw className="h-5 w-5" />
                <span>Refresh</span>
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* Enhanced System Health Alert */}
        {adminData.systemHealth && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6 ${
              settings.isPaused
                ? "bg-gradient-to-r from-red-600/10 to-indigo-600/10 border-red-500/30"
                : "bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-blue-500/30"
            }`}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${
                  settings.isPaused
                    ? "bg-gradient-to-bl from-red-600/20 to-transparent"
                    : "bg-gradient-to-bl from-blue-600/20 to-transparent"
                }`}
              ></div>
            </div>

            <div className="relative z-10 flex items-start space-x-4">
              <div
                className={`p-3 rounded-xl border ${
                  settings.isPaused
                    ? "bg-gradient-to-r from-red-600/20 to-indigo-600/20 border-red-500/30"
                    : "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/30"
                }`}
              >
                {settings.isPaused ? (
                  <FiAlertTriangle className="h-6 w-6 text-red-300" />
                ) : (
                  <FiCheck className="h-6 w-6 text-blue-300" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3
                    className={`font-bold text-lg ${
                      settings.isPaused ? "text-red-300" : "text-blue-300"
                    }`}
                  >
                    System Status:{" "}
                    {settings.isPaused ? "⏸️ Paused" : "🟢 Operational"}
                  </h3>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      settings.isPaused
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {settings.isPaused ? "EMERGENCY MODE" : "LIVE"}
                  </div>
                </div>
                <p className="text-gray-300 text-sm">
                  {settings.isPaused
                    ? "⚠️ Platform is currently paused. All transactions and operations are suspended for maintenance or security reasons."
                    : "✅ All blockchain systems are operational and processing transactions normally."}
                </p>
                {settings.isPaused && (
                  <div className="mt-3 flex items-center space-x-2 text-xs text-red-300">
                    <FiZap className="h-3 w-3" />
                    <span>
                      Emergency protocols activated • All funds remain secure
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Enhanced Quick Stats */}
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
              borderColor: "rgba(34, 197, 94, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-xl group-hover:from-blue-600/20 transition-all duration-500"></div>
            </div>

            <div className="relative z-10 flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                <FiDollarSign className="h-8 w-8 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  💰 Total Revenue USDT + USDC
                </p>
                <p className="text-2xl font-bold text-white">
                  {adminData.platformStats
                    ? `$${parseFloat(
                        Number(adminData.platformStats.usdcVolume) +
                          Number(adminData.platformStats.usdtVolume)
                      ).toLocaleString()}`
                    : "--"}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <FiTrendingUp className="h-3 w-3 text-blue-400" />
                  <span className="text-xs text-blue-400 font-semibold">
                    +12.5%
                  </span>
                </div>
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
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                <FiUsers className="h-8 w-8 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  👥 Active Users
                </p>
                <p className="text-2xl font-bold text-white">
                  {adminData.systemHealth?.totalUsers?.toString() || "--"}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <FiTrendingUp className="h-3 w-3 text-blue-400" />
                  <span className="text-xs text-blue-400 font-semibold">
                    +8.2%
                  </span>
                </div>
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
                  ⏳ Pending KYC
                </p>
                <p className="text-2xl font-bold text-white">
                  {adminData.systemHealth?.pendingKYC?.toString() || "--"}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      adminData.pendingKYC.length > 5
                        ? "bg-red-400"
                        : "bg-blue-400"
                    }`}
                  ></div>
                  <span
                    className={`text-xs font-semibold ${
                      adminData.pendingKYC.length > 5
                        ? "text-red-400"
                        : "text-blue-400"
                    }`}
                  >
                    {adminData.pendingKYC.length > 5
                      ? "High Priority"
                      : "Normal"}
                  </span>
                </div>
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
                <FiTrendingUp className="h-8 w-8 text-purple-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-300 mb-1">
                  💎 Platform Fee
                </p>
                <p className="text-2xl font-bold text-white">
                  {`${(
                    parseInt(adminData.systemHealth?.platformFee || 0) / 100
                  ).toFixed(1)}%`}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <FiZap className="h-3 w-3 text-purple-400" />
                  <span className="text-xs text-purple-400 font-semibold">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Navigation Tabs */}
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

          <div className="relative z-10 border-b border-purple-500/20">
            <nav className="flex space-x-1 overflow-x-auto p-2">
              {tabs.map((tab, index) => (
                <motion.button
                  key={tab.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center px-6 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-all duration-300 ${
                    activeTab === tab.id
                      ? "text-white shadow-lg"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                  style={
                    activeTab === tab.id
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)",
                          borderColor: "rgba(139, 92, 246, 0.3)",
                          border: "1px solid",
                        }
                      : {}
                  }
                >
                  {/* Active tab glow effect */}
                  {activeTab === tab.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 rounded-xl blur"></div>
                  )}

                  <div className="relative flex items-center space-x-2">
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </div>
                </motion.button>
              ))}
            </nav>
          </div>
        </motion.div>

        {/* Enhanced Tab Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl border shadow-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-purple-600/5 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-600/5 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-r from-indigo-600/3 to-cyan-600/3 rounded-full blur-2xl"></div>
          </div>

          <div className="relative z-10 p-8">
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                      <FiBarChart className="h-6 w-6 text-blue-300" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        System Overview
                      </h2>
                      <p className="text-gray-400 text-sm">
                        Real-time platform metrics and performance insights
                      </p>
                    </div>
                  </div>
                  <OverviewTab
                    platformStats={adminData.platformStats}
                    recentActivity={adminData.recentActivity}
                    systemHealth={adminData.systemHealth}
                  />
                </motion.div>
              )}

              {/* {activeTab === "users" && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                      <FiUsers className="h-6 w-6 text-blue-300" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        User Management
                      </h2>
                      <p className="text-gray-400 text-sm">
                        Manage user accounts, permissions, and activities
                      </p>
                    </div>
                  </div>
                  <UsersTab />
                </motion.div>
              )} */}

              {activeTab === "kyc" && (
                <motion.div
                  key="kyc"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                      <FiShield className="h-6 w-6 text-yellow-300" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        KYC Review Center
                      </h2>
                      <p className="text-gray-400 text-sm">
                        Review and approve user identity verifications
                      </p>
                    </div>
                  </div>
                  <KYCTab
                    pendingKYC={adminData.pendingKYC}
                    onKYCReview={handleKYCReview}
                  />
                </motion.div>
              )}

              {activeTab === "settings" && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                      <FiSettings className="h-6 w-6 text-purple-300" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                        Platform Configuration
                      </h2>
                      <p className="text-gray-400 text-sm">
                        Configure platform settings, fees, and operational
                        parameters
                      </p>
                    </div>
                  </div>
                  <SettingsTab
                    settings={settings}
                    onUpdateFee={handleUpdatePlatformFee}
                    onPause={handleEmergencyPause}
                    onUnpause={handleEmergencyUnpause}
                  />
                </motion.div>
              )}

              {activeTab === "security" && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30">
                      <FiLock className="h-6 w-6 text-red-300" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-indigo-400 bg-clip-text text-transparent">
                        Security Management
                      </h2>
                      <p className="text-gray-400 text-sm">
                        Manage reviewers, access controls, and security
                        protocols
                      </p>
                    </div>
                  </div>
                  <SecurityTab
                    reviewers={reviewers}
                    newReviewer={newReviewer}
                    setNewReviewer={setNewReviewer}
                    onAddReviewer={addReviewer}
                    onRemoveReviewer={removeReviewer}
                  />
                </motion.div>
              )}

              {activeTab === "activity" && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30">
                      <FiActivity className="h-6 w-6 text-cyan-300" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Activity Monitor
                      </h2>
                      <p className="text-gray-400 text-sm">
                        Real-time system activities and transaction logs
                      </p>
                    </div>
                  </div>
                  <ActivityTab recentActivity={adminData.recentActivity} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Admin;
