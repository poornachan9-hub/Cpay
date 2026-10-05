import { useState, useEffect, createElement } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FiDollarSign,
  FiShoppingBag,
  FiUsers,
  FiTrendingUp,
  FiCreditCard,
  FiShield,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiZap,
} from "react-icons/fi";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import { contractService } from "../services/contract";
import { KYC_STATUS_NAMES, TOKEN_NAMES, CONTRACT_ADDRESSES } from "../lib/constants";
import toast from "react-hot-toast";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import WithdrawToBank from "../components/WithdrawToBank";
import NetworkGuard from "../components/NetworkGuard";

// You'll need to import your contract ABI here
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";

const Dashboard = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [dashboardData, setDashboardData] = useState({
    platformAnalytics: null,
    merchantAnalytics: null,
    kycData: null,
    loading: true,
  });

  const [recentTransactions, setRecentTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);

  // Mock ABI for demonstration - replace with your actual ABI
  const CONTRACT_ABI = ABI.abi; // Import your actual ABI here

  useEffect(() => {
    if (isConnected && address) {
      loadDashboardData();
    } else {
      setDashboardData((prev) => ({ ...prev, loading: false }));
    }
  }, [isConnected, address]);

  const loadDashboardData = async () => {
    try {
      setDashboardData((prev) => ({ ...prev, loading: true }));

      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);

      // Parallel data loading - much faster than sequential
      const [platformResult, merchantResult, kycResult, transactionsResult] = await Promise.all([
        contractService.getPlatformAnalytics(contract),
        address ? contractService.getMerchantAnalytics(contract, address) : Promise.resolve(null),
        address ? contractService.getKYCData(contract, address) : Promise.resolve(null),
        contractService.getAllTransactions(contract),
      ]);

      if (transactionsResult.success) {
        // Filter transactions for the logged-in user
        const userTransactions = transactionsResult.data.filter(
          (tx) => tx.merchant.toLowerCase() === address.toLowerCase() || tx.buyer.toLowerCase() === address.toLowerCase()
        );

        // Get last 10 transactions
        const recent = userTransactions
          .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
          .slice(0, 10);
        setRecentTransactions(recent);

        // Generate chart data from transactions - memoized to avoid recalculation
        setChartData(generateChartDataMemoized(userTransactions));
      }

      setDashboardData({
        platformAnalytics: platformResult.success ? platformResult.data : null,
        merchantAnalytics: merchantResult?.success ? merchantResult.data : null,
        kycData: kycResult?.success ? kycResult.data : null,
        loading: false,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Failed to load dashboard data");
      setDashboardData((prev) => ({ ...prev, loading: false }));
    }
  };

  // Memoized chart data generation to avoid recalculation
  const generateChartDataMemoized = (transactions) => {
    // Group transactions by day for the last 30 days
    const last30Days = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split("T")[0];

      const dayTransactions = transactions.filter((tx) => {
        const txDate = new Date(parseInt(tx.timestamp) * 1000);
        return txDate.toISOString().split("T")[0] === dayKey;
      });

      const totalVolume = dayTransactions.reduce((sum, tx) => {
        return sum + parseFloat(tx.amount || 0);
      }, 0);

      last30Days.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        volume: totalVolume,
        transactions: dayTransactions.length,
      });
    }

    return last30Days;
  };

  const { platformAnalytics, merchantAnalytics, kycData, loading } =
    dashboardData;

  const pieData = [
    {
      name: "ETH",
      value: parseFloat(platformAnalytics?.ethVolume || 0),
      color: "#3B82F6",
    },
    {
      name: "USDT",
      value: parseFloat(platformAnalytics?.usdtVolume || 0),
      color: "#10B981",
    },
    {
      name: "USDC",
      value: parseFloat(platformAnalytics?.usdcVolume || 0),
      color: "#8B5CF6",
    },
  ].filter((item) => item.value > 0);

  // KYC status configuration
  const getKYCConfig = (status) => {
    const configs = {
      0: {
        icon: FiAlertTriangle,
        color: "from-yellow-500 to-orange-500",
        bg: "from-yellow-600/20 to-orange-600/20",
        border: "border-yellow-500/30",
        message: "Please submit your KYC documents to start selling products.",
      },
      1: {
        icon: FiClock,
        color: "from-blue-500 to-purple-500",
        bg: "from-blue-600/20 to-purple-600/20",
        border: "border-blue-500/30",
        message: "Your KYC submission is under review.",
      },
      2: {
        icon: FiCheckCircle,
        color: "from-blue-500 to-indigo-500",
        bg: "from-blue-600/20 to-indigo-600/20",
        border: "border-blue-500/30",
        message: "KYC approved! You can now sell products.",
      },
      3: {
        icon: FiXCircle,
        color: "from-red-500 to-indigo-500",
        bg: "from-red-600/20 to-indigo-600/20",
        border: "border-red-500/30",
        message: `KYC rejected: ${
          kycData?.rejectionReason || "Please resubmit."
        }`,
      },
    };
    return configs[status] || configs[0];
  };

  // Custom chart tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="backdrop-blur-xl rounded-xl p-4 border shadow-lg"
          style={{
            background: "linear-gradient(135deg, rgba(10,13,20,0.98) 0%, rgba(17,24,39,0.98) 100%)",
            borderColor: "rgba(0,212,255,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.1)",
          }}
        >
          <p style={{ color: "#94a3b8" }} className="font-medium text-sm mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="font-bold text-sm"
              style={{ color: "#00d4ff" }}
            >
              {entry.dataKey === "volume"
                ? `Volume: $${entry.value.toLocaleString()}`
                : `${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout title="Dashboard">
      <NetworkGuard>
      <div className="space-y-8">
        {/* KYC Status Alert */}
        {kycData && kycData.status !== 2 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6 ${
              getKYCConfig(kycData.status).border
            }`}
            style={{
              background: `linear-gradient(135deg, ${
                getKYCConfig(kycData.status).bg
              })`,
            }}
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 via-indigo-600/5 to-blue-600/5"></div>

            <div className="relative flex items-start space-x-4">
              <div
                className={`flex-shrink-0 p-3 rounded-xl bg-gradient-to-r ${
                  getKYCConfig(kycData.status).color
                } shadow-lg`}
              >
                {createElement(getKYCConfig(kycData.status).icon, {
                  className: "h-6 w-6 text-white",
                })}
              </div>
              <div className="flex-1">
                <h3
                  className={`text-lg font-bold mb-2 bg-gradient-to-r ${
                    getKYCConfig(kycData.status).color
                  } bg-clip-text text-transparent`}
                >
                  KYC Status: {KYC_STATUS_NAMES[kycData.status]}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {getKYCConfig(kycData.status).message}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Platform Stats */}
        {kycData?.status === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 rounded-xl border" style={{ background: "rgba(96,165,250,0.12)", borderColor: "rgba(96,165,250,0.25)" }}>
              <FiTrendingUp className="h-6 w-6" style={{ color: "#60a5fa" }} />
            </div>
            <h2
              className="text-2xl font-bold"
              style={{ background: "linear-gradient(135deg, #00d4ff, #c850c0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              Platform Overview
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="USDC + USDT Total Revenue"
              value={
                Number(platformAnalytics?.usdcVolume) +
                  Number(platformAnalytics?.usdtVolume) || "--"
              }
              icon={FiDollarSign}
              loading={loading}
              accentIndex={0}
            />
            <StatsCard
              title="Total Transactions"
              value={platformAnalytics?.totalTransactions || "--"}
              icon={FiCreditCard}
              loading={loading}
              accentIndex={1}
            />
            <StatsCard
              title="Active Merchants"
              value={platformAnalytics?.totalMerchants || "--"}
              icon={FiUsers}
              loading={loading}
              accentIndex={2}
            />
            <StatsCard
              title="Total Products"
              value={platformAnalytics?.totalProducts || "--"}
              icon={FiShoppingBag}
              loading={loading}
              accentIndex={3}
            />
          </div>
        </motion.div>
        )}

        {/* Merchant Stats (if user is a merchant) */}
        {merchantAnalytics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 rounded-xl border" style={{ background: "rgba(96,165,250,0.12)", borderColor: "rgba(96,165,250,0.25)" }}>
                <FiUsers className="h-6 w-6" style={{ color: "#60a5fa" }} />
              </div>
              <h2
                className="text-2xl font-bold"
                style={{ background: "linear-gradient(135deg, #00d4ff, #c850c0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                Your Merchant Stats
              </h2>
              <div className="ml-auto">
                <WithdrawToBank
                  usdcBalance={parseFloat(merchantAnalytics?.usdcRevenue || 0)}
                  usdtBalance={parseFloat(merchantAnalytics?.usdtRevenue || 0)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Your Revenue USDC"
                value={merchantAnalytics?.usdcRevenue || "--"}
                icon={FiDollarSign}
                change="+12.5%"
                changeType="positive"
                accentIndex={0}
              />
              <StatsCard
                title="Your Transactions"
                value={merchantAnalytics.totalTransactions}
                icon={FiCreditCard}
                change="+8.2%"
                changeType="positive"
                accentIndex={1}
              />
              <StatsCard
                title="Your Products"
                value={merchantAnalytics.totalProducts}
                icon={FiShoppingBag}
                accentIndex={2}
              />
              <StatsCard
                title="USDT Revenue"
                value={merchantAnalytics?.usdtRevenue}
                icon={FiTrendingUp}
                accentIndex={3}
              />
            </div>
          </motion.div>
        )}

        {/* Charts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Volume Chart */}
          <div
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl p-6"
            style={{
              background: "linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(26,31,46,0.9) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "inset 0 1px 0 rgba(0,212,255,0.1)",
            }}
          >
            {/* Cyan top-border accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: "linear-gradient(90deg, #00d4ff, #c850c0)" }} />
            <div className="absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(0,212,255,0.06)" }} />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(200,80,192,0.05)" }} />

            <div className="relative z-10">
              <h3 className="text-xl font-bold text-[#f1f5f9] mb-6 flex items-center space-x-3">
                <div className="p-2 rounded-lg" style={{ background: "rgba(96,165,250,0.12)" }}>
                  <FiTrendingUp className="h-5 w-5" style={{ color: "#60a5fa" }} />
                </div>
                <span>Transaction Volume (Last 30 Days)</span>
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(139, 92, 246, 0.1)"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="volume"
                      stroke="url(#volumeGradient)"
                      strokeWidth={3}
                      dot={{ fill: "#8B5CF6", strokeWidth: 2, r: 6 }}
                      activeDot={{ r: 8, fill: "#EC4899" }}
                    />
                    <defs>
                      <linearGradient
                        id="volumeGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="50%" stopColor="#EC4899" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Token Distribution */}
          <div
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl p-6"
            style={{
              background: "linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(26,31,46,0.9) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "inset 0 1px 0 rgba(200,80,192,0.12)",
            }}
          >
            {/* Magenta top-border accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: "linear-gradient(90deg, #c850c0, #00d4ff)" }} />
            <div className="absolute top-0 left-0 w-28 h-28 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(200,80,192,0.06)" }} />
            <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: "rgba(0,212,255,0.05)" }} />

            <div className="relative z-10">
              <h3 className="text-xl font-bold text-[#f1f5f9] mb-6 flex items-center space-x-3">
                <div className="p-2 rounded-lg" style={{ background: "rgba(96,165,250,0.12)" }}>
                  <FiDollarSign className="h-5 w-5" style={{ color: "#60a5fa" }} />
                </div>
                <span>Payment Token Distribution</span>
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center space-x-6 mt-4">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded-full shadow-lg"
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <span className="text-sm text-gray-300 font-medium">
                      {entry.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl"
          style={{
            background: "linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(26,31,46,0.9) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "inset 0 1px 0 rgba(0,212,255,0.08)",
          }}
        >
          {/* Background effects */}
          <div className="absolute top-0 right-1/4 w-40 h-40 bg-gradient-to-bl from-purple-600/5 to-transparent rounded-full blur-3xl"></div>

          {/* Cyan top-border accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: "linear-gradient(90deg, #00d4ff, #60a5fa, #c850c0)" }} />

          <div className="relative z-10">
            <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-xl font-bold text-[#f1f5f9] flex items-center space-x-3">
                <div className="p-2 rounded-lg" style={{ background: "rgba(96,165,250,0.12)" }}>
                  <FiCreditCard className="h-5 w-5" style={{ color: "#60a5fa" }} />
                </div>
                <span>Recent Transactions</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>
                      Transaction ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>
                      Buyer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>
                      Token
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((tx, index) => (
                      <motion.tr
                        key={tx.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="transition-all duration-200"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.04)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold" style={{ color: "#f1f5f9" }}>
                          <span
                            className="px-2 py-1 rounded-lg font-mono"
                            style={{ background: "rgba(163,230,53,0.1)", color: "#a78bfa", border: "1px solid rgba(163,230,53,0.2)" }}
                          >
                            #{tx.id}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: "#94a3b8" }}>
                          {tx.buyer.slice(0, 6)}...{tx.buyer.slice(-4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className="px-2 py-1 rounded-lg font-semibold"
                            style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}
                          >
                            {TOKEN_NAMES[tx.token]}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold" style={{ color: "#60a5fa" }}>
                          {contractService.formatTokenAmount(tx.amount, tx.token)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: "#94a3b8" }}>
                          {new Date(parseInt(tx.timestamp) * 1000).toLocaleDateString()}
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center space-y-3">
                          <div className="p-4 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <FiCreditCard className="h-8 w-8" style={{ color: "#94a3b8" }} />
                          </div>
                          <p className="text-lg font-medium" style={{ color: "#94a3b8" }}>
                            {loading ? "Loading transactions..." : "No transactions found"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
      </NetworkGuard>
    </Layout>
  );
};

export default Dashboard;