import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
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
  AreaChart,
  Area,
} from "recharts";
import {
  FiTrendingUp,
  FiDollarSign,
  FiUsers,
  FiShoppingBag,
  FiCalendar,
  FiDownload,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiTarget,
  FiRefreshCw,
  FiFilter,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import { contractService } from "../services/contract";
import { TOKEN_NAMES } from "../lib/constants";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";

const Analytics = () => {
  const { address, isConnected } = useAccount();

  const [analyticsData, setAnalyticsData] = useState({
    platform: null,
    merchant: null,
    loading: true,
  });

  const [timeRange, setTimeRange] = useState("30d");
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState({
    revenue: [],
    volume: [],
    tokens: [],
    growth: [],
  });

  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    if (isConnected && address) {
      loadAnalyticsData();
    }
  }, [isConnected, address, timeRange]);

  const loadAnalyticsData = async () => {
    try {
      setAnalyticsData((prev) => ({ ...prev, loading: true }));

      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);

      // Load platform analytics
      const platformResult = await contractService.getPlatformAnalytics(
        contract
      );

      // Load merchant analytics
      const merchantResult = await contractService.getMerchantAnalytics(
        contract,
        address
      );

      // Load transaction history for charts
      const transactionsResult = await contractService.getAllTransactions(
        contract
      );

      if (transactionsResult.success) {
        generateChartData(transactionsResult.data);
      }

      setAnalyticsData({
        platform: platformResult.success ? platformResult.data : null,
        merchant: merchantResult.success ? merchantResult.data : null,
        loading: false,
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Failed to load analytics data");
      setAnalyticsData((prev) => ({ ...prev, loading: false }));
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    setRefreshing(false);
    toast.success("Analytics data refreshed");
  };

  const generateChartData = (transactions) => {
    const now = new Date();
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;

    // Generate revenue chart data
    const revenueData = [];
    const volumeData = [];
    const tokenDistribution = { ETH: 0, USDT: 0, USDC: 0 };

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split("T")[0];

      const dayTransactions = transactions.filter((tx) => {
        const txDate = new Date(parseInt(tx.timestamp) * 1000);
        return txDate.toISOString().split("T")[0] === dayKey;
      });

      let dailyRevenue = 0;
      let dailyVolume = 0;

      dayTransactions.forEach((tx) => {
        const amount = parseFloat(
          contractService.formatTokenAmount(tx.amount, tx.token)
        );
        dailyRevenue += parseFloat(
          contractService.formatTokenAmount(tx.platformFee, tx.token)
        );
        dailyVolume += amount;

        const tokenName = TOKEN_NAMES[tx.token];
        tokenDistribution[tokenName] += amount;
      });

      revenueData.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        revenue: dailyRevenue,
        transactions: dayTransactions.length,
      });

      volumeData.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        volume: dailyVolume,
        transactions: dayTransactions.length,
      });
    }

    // Token distribution data
    const tokenData = Object.entries(tokenDistribution)
      .filter(([_, value]) => value > 0)
      .map(([token, value]) => ({
        name: token,
        value: value,
        color:
          token === "ETH"
            ? "#627EEA"
            : token === "USDT"
            ? "#26A17B"
            : "#2775CA",
      }));

    // Growth data
    const growthData = revenueData.map((item, index) => ({
      ...item,
      growth:
        index > 0
          ? ((item.revenue - revenueData[index - 1].revenue) /
              (revenueData[index - 1].revenue || 1)) *
            100
          : 0,
    }));

    setChartData({
      revenue: revenueData,
      volume: volumeData,
      tokens: tokenData,
      growth: growthData,
    });
  };

  const { platform, merchant, loading } = analyticsData;

  const exportData = () => {
    const data = {
      platform: platform,
      merchant: merchant,
      chartData: chartData,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Analytics data exported successfully");
  };

  // Custom chart tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="backdrop-blur-xl rounded-xl p-4 border shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 100%)",
            borderColor: "rgba(139, 92, 246, 0.3)",
          }}
        >
          <p className="text-gray-300 font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              style={{ color: entry.color }}
              className="font-semibold text-white"
            >
              {entry.name}:{" "}
              {typeof entry.value === "number"
                ? entry.value.toFixed(2)
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout title="Analytics">
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
              <FiBarChart2 className="h-8 w-8 text-purple-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Analytics Dashboard
              </h1>
              <p className="text-gray-400 mt-1">
                Comprehensive insights into platform performance
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.05, rotate: 180 }}
              whileTap={{ scale: 0.95 }}
              onClick={refreshData}
              disabled={refreshing}
              className="p-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300"
              title="Refresh Data"
            >
              <FiRefreshCw
                className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
              />
            </motion.button>

            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="pl-10 pr-8 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent appearance-none cursor-pointer"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
                  borderColor: "rgba(59, 130, 246, 0.2)",
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
              </select>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportData}
              className="group relative overflow-hidden rounded-xl px-6 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
            >
              {/* Button glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

              <div className="relative flex items-center space-x-2">
                <FiDownload className="h-5 w-5" />
                <span>Export</span>
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* Platform Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Total Transactions"
              value={platform?.totalTransactions}
              icon={FiTrendingUp}
              change="+24.1%"
              changeType="positive"
              loading={loading}
            />
            <StatsCard
              title="Total Volume"
              value={
                platform
                  ? `$${(
                      parseFloat(platform.ethVolume) +
                      parseFloat(platform.usdtVolume) +
                      parseFloat(platform.usdcVolume)
                    ).toLocaleString()}`
                  : "--"
              }
              icon={FiTrendingUp}
              change="+8.2%"
              changeType="positive"
              loading={loading}
            />
            <StatsCard
              title="Active Merchants"
              value={platform?.totalMerchants || "--"}
              icon={FiUsers}
              change="+15.1%"
              changeType="positive"
              loading={loading}
            />
            <StatsCard
              title="Total Products"
              value={platform?.totalProducts || "--"}
              icon={FiShoppingBag}
              change="+6.3%"
              changeType="positive"
              loading={loading}
            />
          </div>
        </motion.div>

        {/* Merchant Analytics */}
        {merchant && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                <FiTarget className="h-6 w-6 text-blue-300" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Your Performance
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Your Revenue USDC"
                value={`$${parseFloat(merchant.usdcRevenue).toLocaleString()}`}
                icon={FiDollarSign}
                change="+18.2%"
                changeType="positive"
              />
              <StatsCard
                title="Your Transactions"
                value={merchant?.totalTransactions}
                icon={FiTrendingUp}
                change="+24.1%"
                changeType="positive"
              />
              <StatsCard
                title="Your Products"
                value={merchant?.totalProducts}
                icon={FiShoppingBag}
              />
              <StatsCard
                title="Your Revenue USDT"
                value={merchant?.usdtRevenue}
                icon={FiCalendar}
                change="+5.4%"
                changeType="positive"
              />
            </div>
          </motion.div>
        )}

        {/* Charts Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Revenue Chart */}
          <div
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-600/10 to-transparent rounded-full blur-2xl"></div>

            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20">
                  <FiActivity className="h-5 w-5 text-blue-300" />
                </div>
                <span>Revenue Trend</span>
              </h3>
              <div className="h-80">
                {chartData.revenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.revenue}>
                      <defs>
                        <linearGradient
                          id="revenueGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#8B5CF6"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#8B5CF6"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
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
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#revenueGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative inline-block">
                        <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full blur-xl"></div>
                        <div className="relative p-6 rounded-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30">
                          <FiTrendingUp className="h-12 w-12 text-blue-300 mx-auto" />
                        </div>
                      </div>
                      <p className="text-gray-400 mt-4">
                        No revenue data available
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Volume Chart */}
          <div
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-indigo-600/10 to-transparent rounded-full blur-2xl"></div>

            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20">
                  <FiBarChart2 className="h-5 w-5 text-blue-300" />
                </div>
                <span>Transaction Volume</span>
              </h3>
              <div className="h-80">
                {chartData.volume.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.volume}>
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
                      <Bar
                        dataKey="volume"
                        fill="url(#volumeGradient)"
                        radius={[4, 4, 0, 0]}
                      />
                      <defs>
                        <linearGradient
                          id="volumeGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#EC4899" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative inline-block">
                        <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-full blur-xl"></div>
                        <div className="relative p-6 rounded-full bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/30">
                          <FiShoppingBag className="h-12 w-12 text-blue-300 mx-auto" />
                        </div>
                      </div>
                      <p className="text-gray-400 mt-4">
                        No volume data available
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Additional Charts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Token Distribution */}
          <div
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute top-0 right-1/4 w-32 h-32 bg-gradient-to-bl from-yellow-600/10 to-transparent rounded-full blur-2xl"></div>

            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-yellow-600/20 to-orange-600/20">
                  <FiPieChart className="h-5 w-5 text-yellow-300" />
                </div>
                <span>Payment Token Distribution</span>
              </h3>
              <div className="h-80">
                {chartData.tokens.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.tokens}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.tokens.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative inline-block">
                        <div className="absolute -inset-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-full blur-xl"></div>
                        <div className="relative p-6 rounded-full bg-gradient-to-r from-yellow-600/10 to-orange-600/10 border border-yellow-500/30">
                          <FiDollarSign className="h-12 w-12 text-yellow-300 mx-auto" />
                        </div>
                      </div>
                      <p className="text-gray-400 mt-4">
                        No token data available
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Growth Chart */}
          <div
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-gradient-to-tr from-cyan-600/10 to-transparent rounded-full blur-2xl"></div>

            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-600/20 to-blue-600/20">
                  <FiTrendingUp className="h-5 w-5 text-cyan-300" />
                </div>
                <span>Revenue Growth Rate</span>
              </h3>
              <div className="h-80">
                {chartData.growth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.growth}>
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
                        dataKey="growth"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={{ fill: "#10B981", strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, fill: "#34D399" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative inline-block">
                        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 rounded-full blur-xl"></div>
                        <div className="relative p-6 rounded-full bg-gradient-to-r from-cyan-600/10 to-blue-600/10 border border-cyan-500/30">
                          <FiTrendingUp className="h-12 w-12 text-cyan-300 mx-auto" />
                        </div>
                      </div>
                      <p className="text-gray-400 mt-4">
                        No growth data available
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Detailed Analytics Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl border"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute top-0 right-1/3 w-40 h-40 bg-gradient-to-bl from-purple-600/5 to-transparent rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <div className="px-6 py-4 border-b border-purple-500/20">
              <h3 className="text-xl font-bold text-white flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-purple-600/20 to-indigo-600/20">
                  <FiActivity className="h-5 w-5 text-purple-300" />
                </div>
                <span>Token Performance Breakdown</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-full">
                {/* Table Header */}
                <div className="grid grid-cols-5 gap-4 p-6 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border-b border-purple-500/20">
                  <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                    Token
                  </div>
                  <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                    Volume
                  </div>
                  <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                    Revenue Share
                  </div>
                  <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                    Transactions
                  </div>
                  <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                    Avg. Amount
                  </div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-purple-500/10">
                  {platform &&
                    [
                      {
                        token: "ETH",
                        volume: platform.ethVolume,
                        gradient: "from-blue-600/10 to-purple-600/10",
                        border: "border-blue-500/30",
                        textColor: "text-blue-300",
                        iconColor: "bg-blue-500",
                      },
                      {
                        token: "USDT",
                        volume: platform.usdtVolume,
                        gradient: "from-blue-600/10 to-cyan-600/10",
                        border: "border-blue-500/30",
                        textColor: "text-blue-300",
                        iconColor: "bg-blue-500",
                      },
                      {
                        token: "USDC",
                        volume: platform.usdcVolume,
                        gradient: "from-purple-600/10 to-indigo-600/10",
                        border: "border-purple-500/30",
                        textColor: "text-purple-300",
                        iconColor: "bg-purple-500",
                      },
                    ].map((tokenData, index) => {
                      const volume = parseFloat(tokenData.volume);
                      const totalVolume =
                        parseFloat(platform.ethVolume) +
                        parseFloat(platform.usdtVolume) +
                        parseFloat(platform.usdcVolume);
                      const share =
                        totalVolume > 0 ? (volume / totalVolume) * 100 : 0;

                      return (
                        <motion.div
                          key={tokenData.token}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`grid grid-cols-5 gap-4 p-6 hover:bg-gradient-to-r hover:${tokenData.gradient} transition-all duration-300`}
                        >
                          {/* Token */}
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-4 h-4 rounded-full ${tokenData.iconColor} shadow-lg`}
                            ></div>
                            <span
                              className={`font-bold ${tokenData.textColor}`}
                            >
                              {tokenData.token}
                            </span>
                          </div>

                          {/* Volume */}
                          <div className="text-white font-semibold">
                            {tokenData.token === "ETH"
                              ? `${volume.toFixed(4)} ETH`
                              : `${volume.toLocaleString()}`}
                          </div>

                          {/* Revenue Share */}
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-600/20 rounded-full h-2">
                              <div
                                className={`h-2 bg-gradient-to-r ${tokenData.gradient.replace(
                                  "/10",
                                  "/80"
                                )} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.min(share, 100)}%` }}
                              />
                            </div>
                            <span className="text-white font-semibold text-sm">
                              {share.toFixed(1)}%
                            </span>
                          </div>

                          {/* Transactions */}
                          <div className="text-gray-400">
                            <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30">
                              -
                            </span>
                          </div>

                          {/* Avg Amount */}
                          <div className="text-gray-400">
                            <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30">
                              -
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Key Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 50%, rgba(236, 72, 153, 0.1) 100%)",
            borderColor: "rgba(59, 130, 246, 0.3)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-gradient-to-br from-blue-600/5 to-transparent rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-gradient-to-tl from-purple-600/5 to-transparent rounded-full blur-2xl"></div>
          </div>

          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                <FiTarget className="h-6 w-6 text-blue-300" />
              </div>
              <span>Key Insights</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-start space-x-4 p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 backdrop-blur-sm"
              >
                <div className="flex-shrink-0 relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur opacity-75"></div>
                  <div className="relative w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                    <FiTrendingUp className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Growth Trend</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Platform revenue has grown by{" "}
                    <span className="text-blue-400 font-semibold">12.5%</span>{" "}
                    compared to the previous period, showing strong market
                    adoption.
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-start space-x-4 p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20 backdrop-blur-sm"
              >
                <div className="flex-shrink-0 relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur opacity-75"></div>
                  <div className="relative w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                    <FiUsers className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">User Engagement</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Active merchant count increased by{" "}
                    <span className="text-blue-400 font-semibold">15.1%</span>{" "}
                    with improved retention rates and higher transaction
                    frequency.
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-start space-x-4 p-4 rounded-xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20 backdrop-blur-sm"
              >
                <div className="flex-shrink-0 relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full blur opacity-75"></div>
                  <div className="relative w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                    <FiDollarSign className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">
                    Token Preference
                  </h4>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {chartData.tokens.length > 0
                      ? `${chartData.tokens[0]?.name} leads as the most preferred payment method with strong user adoption.`
                      : "Payment token distribution is being analyzed for optimization insights."}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Analytics;
