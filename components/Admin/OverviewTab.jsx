import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiActivity,
  FiDownload,
  FiTrendingUp,
  FiPieChart,
  FiBarChart,
  FiUsers,
  FiClock,
  FiShield,
  FiZap,
  FiServer,
  FiGlobe,
  FiCpu,
  FiDatabase,
} from "react-icons/fi";
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

const OverviewTab = ({ platformStats, recentActivity, systemHealth }) => {
  const chartData = recentActivity.slice(0, 7).map((tx, index) => ({
    name: `Day ${index + 1}`,
    transactions: Math.floor(Math.random() * 50) + 10,
    revenue: Math.floor(Math.random() * 10000) + 5000,
  }));

  const tokenData = [
    {
      name: "ETH",
      value: parseFloat(platformStats?.ethVolume || 0),
      color: "#627EEA",
      gradient: "from-blue-600 to-blue-600",
      icon: "🔷",
    },
    {
      name: "USDT",
      value: parseFloat(platformStats?.usdtVolume || 0),
      color: "#26A17B",
      gradient: "from-blue-600 to-cyan-600",
      icon: "💚",
    },
    {
      name: "USDC",
      value: parseFloat(platformStats?.usdcVolume || 0),
      color: "#2775CA",
      gradient: "from-blue-600 to-cyan-600",
      icon: "🔵",
    },
  ].filter((item) => item.value > 0);

  // Custom tooltip for the line chart
  const CustomLineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-3 border border-purple-500/30 shadow-lg">
          <p className="text-white font-semibold">{label}</p>
          <p className="text-blue-300">
            Transactions: <span className="font-bold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for the pie chart
  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-3 border border-purple-500/30 shadow-lg">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{data.icon}</span>
            <span className="text-white font-semibold">{data.name}</span>
          </div>
          <p className="text-gray-300">
            Volume:{" "}
            <span className="font-bold">${data.value.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
          <FiBarChart className="h-5 w-5 text-blue-300" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">
            Platform Analytics Dashboard
          </h3>
          <p className="text-gray-400 text-sm">
            Real-time insights and performance metrics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Transaction Trends */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(59, 130, 246, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-2xl group-hover:from-blue-600/20 transition-all duration-500"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-600/10 to-transparent rounded-full blur-2xl group-hover:from-purple-600/20 transition-all duration-500"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                  <FiTrendingUp className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-300 text-lg">
                    📈 Transaction Trends
                  </h4>
                  <p className="text-xs text-gray-400">
                    Last 7 days performance
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-blue-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span>Live Data</span>
              </div>
            </div>

            <div className="h-72 relative">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient
                        id="lineGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3B82F6"
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
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    />
                    <Tooltip content={<CustomLineTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="transactions"
                      stroke="url(#lineGradient)"
                      strokeWidth={3}
                      dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "#8B5CF6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FiBarChart className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">
                      No transaction data available
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Enhanced Token Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(34, 197, 94, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-2xl group-hover:from-blue-600/20 transition-all duration-500"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-cyan-600/10 to-transparent rounded-full blur-2xl group-hover:from-cyan-600/20 transition-all duration-500"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                  <FiPieChart className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-300 text-lg">
                    🪙 Token Distribution
                  </h4>
                  <p className="text-xs text-gray-400">
                    Volume by cryptocurrency
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-blue-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span>Real-time</span>
              </div>
            </div>

            <div className="h-72 relative">
              {tokenData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tokenData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {tokenData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke={entry.color}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-4">
                    {tokenData.map((token, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{
                            backgroundColor: token.color,
                            borderColor: token.color,
                          }}
                        ></div>
                        <span className="text-xs text-gray-300 font-medium">
                          {token.icon} {token.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FiPieChart className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">
                      No token volume data available
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced System Health */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-8"
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
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gradient-to-r from-indigo-600/3 to-cyan-600/3 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
              <FiServer className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <h4 className="font-bold text-purple-300 text-xl">
                🖥️ System Health Monitor
              </h4>
              <p className="text-gray-400 text-sm">
                Real-time platform status and metrics
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Users */}
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="group relative overflow-hidden rounded-2xl backdrop-blur-sm border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
                borderColor: "rgba(59, 130, 246, 0.2)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 rounded-2xl"></div>
              <div className="relative z-10 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                    <FiUsers className="h-5 w-5 text-blue-300" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {systemHealth?.totalUsers || 0}
                </div>
                <div className="text-sm text-blue-300 font-semibold">
                  👥 Total Users
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Registered accounts
                </div>
              </div>
            </motion.div>

            {/* Active Transactions */}
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="group relative overflow-hidden rounded-2xl backdrop-blur-sm border transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
                borderColor: "rgba(34, 197, 94, 0.2)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-indigo-600/5 rounded-2xl"></div>
              <div className="relative z-10 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                    <FiZap className="h-5 w-5 text-blue-300" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {systemHealth?.activeTransactions || 0}
                </div>
                <div className="text-sm text-blue-300 font-semibold">
                  ⚡ Active Txns
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Recent activity
                </div>
              </div>
            </motion.div>

            {/* Pending KYC */}
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="group relative overflow-hidden rounded-2xl backdrop-blur-sm border transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)",
                borderColor: "rgba(245, 158, 11, 0.2)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/5 to-amber-600/5 rounded-2xl"></div>
              <div className="relative z-10 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border border-yellow-500/30">
                    <FiClock className="h-5 w-5 text-yellow-300" />
                  </div>
                </div>
                <div
                  className={`text-3xl font-bold text-white mb-2 ${
                    (systemHealth?.pendingKYC || 0) > 5 ? "animate-pulse" : ""
                  }`}
                >
                  {systemHealth?.pendingKYC || 0}
                </div>
                <div className="text-sm text-yellow-300 font-semibold">
                  ⏳ Pending KYC
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Awaiting review
                </div>
              </div>
            </motion.div>

            {/* Contract Status */}
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className={`group relative overflow-hidden rounded-2xl backdrop-blur-sm border transition-all duration-300 p-6 ${
                systemHealth?.isPaused
                  ? "hover:shadow-lg hover:shadow-red-500/10"
                  : "hover:shadow-lg hover:shadow-blue-500/10"
              }`}
              style={{
                background: systemHealth?.isPaused
                  ? "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)"
                  : "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
                borderColor: systemHealth?.isPaused
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(34, 197, 94, 0.2)",
              }}
            >
              <div
                className={`absolute inset-0 rounded-2xl ${
                  systemHealth?.isPaused
                    ? "bg-gradient-to-r from-red-600/5 to-indigo-600/5"
                    : "bg-gradient-to-r from-blue-600/5 to-indigo-600/5"
                }`}
              ></div>
              <div className="relative z-10 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div
                    className={`p-2 rounded-xl border ${
                      systemHealth?.isPaused
                        ? "bg-gradient-to-r from-red-600/20 to-indigo-600/20 border-red-500/30"
                        : "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/30"
                    }`}
                  >
                    <FiShield
                      className={`h-5 w-5 ${
                        systemHealth?.isPaused
                          ? "text-red-300"
                          : "text-blue-300"
                      }`}
                    />
                  </div>
                </div>
                <div
                  className={`text-2xl font-bold text-white mb-2 ${
                    systemHealth?.isPaused ? "animate-pulse" : ""
                  }`}
                >
                  {systemHealth?.isPaused ? "⏸️ PAUSED" : "🟢 ACTIVE"}
                </div>
                <div
                  className={`text-sm font-semibold ${
                    systemHealth?.isPaused ? "text-red-300" : "text-blue-300"
                  }`}
                >
                  Contract Status
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {systemHealth?.isPaused ? "Emergency mode" : "Operational"}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OverviewTab;
