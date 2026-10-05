import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiActivity,
  FiDownload,
  FiClock,
  FiUser,
  FiDollarSign,
  FiZap,
  FiTrendingUp,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiCreditCard,
  FiDatabase,
} from "react-icons/fi";
import { TOKEN_NAMES } from "../../lib/constants";
import { contractService } from "../../services/contract";

const ActivityTab = ({ recentActivity }) => {
  const getTokenIcon = (tokenName) => {
    const icons = {
      ETH: "🔷",
      USDT: "💚",
      USDC: "🔵",
    };
    return icons[tokenName] || "💎";
  };

  const getTokenGradient = (tokenName) => {
    const gradients = {
      ETH: "from-blue-600/20 to-blue-600/20",
      USDT: "from-blue-600/20 to-cyan-600/20",
      USDC: "from-blue-600/20 to-cyan-600/20",
    };
    return gradients[tokenName] || "from-purple-600/20 to-indigo-600/20";
  };

  const getTokenBorder = (tokenName) => {
    const borders = {
      ETH: "border-blue-500/30",
      USDT: "border-blue-500/30",
      USDC: "border-blue-500/30",
    };
    return borders[tokenName] || "border-purple-500/30";
  };

  const getTokenColor = (tokenName) => {
    const colors = {
      ETH: "text-blue-300",
      USDT: "text-blue-300",
      USDC: "text-cyan-300",
    };
    return colors[tokenName] || "text-purple-300";
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(parseInt(timestamp) * 1000);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30">
            <FiDatabase className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">
              Real-time Activity Feed
            </h3>
            <p className="text-gray-400 text-sm">
              Live blockchain transactions and system events
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-xl px-4 py-2 bg-gradient-to-r from-blue-600 via-cyan-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
        >
          {/* Button glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-cyan-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

          {/* Button shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

          <div className="relative flex items-center space-x-2">
            <FiDownload className="h-4 w-4" />
            <span>Export Log</span>
          </div>
        </motion.button>
      </div>

      {recentActivity.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <AnimatePresence>
            {recentActivity.map((activity, index) => (
              <motion.div
                key={activity.id || index}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{
                  delay: index * 0.05,
                  duration: 0.3,
                  ease: "easeOut",
                }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="group relative overflow-hidden rounded-2xl backdrop-blur-sm border transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 p-6"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(236, 72, 153, 0.05) 50%, rgba(6, 182, 212, 0.05) 100%)",
                  borderColor: "rgba(6, 182, 212, 0.2)",
                }}
              >
                {/* Background effects */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-cyan-600/10 to-transparent rounded-full blur-xl group-hover:from-cyan-600/20 transition-all duration-500"></div>
                  <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-purple-600/10 to-transparent rounded-full blur-xl group-hover:from-purple-600/20 transition-all duration-500"></div>
                </div>

                <div className="relative z-10 flex items-center space-x-4">
                  {/* Activity Icon */}
                  <div className="flex-shrink-0">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-r ${getTokenGradient(
                        TOKEN_NAMES[activity.token]
                      )} border ${getTokenBorder(TOKEN_NAMES[activity.token])}`}
                    >
                      <div className="relative">
                        <FiZap
                          className={`h-5 w-5 ${getTokenColor(
                            TOKEN_NAMES[activity.token]
                          )}`}
                        />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                      {/* Transaction Info */}
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <p className="text-base font-bold text-white">
                            Transaction #{activity.id.slice(0, 8)}...
                          </p>
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm border ${getTokenBorder(
                              TOKEN_NAMES[activity.token]
                            )} ${getTokenColor(TOKEN_NAMES[activity.token])}`}
                            style={{
                              background: `linear-gradient(135deg, ${getTokenGradient(
                                TOKEN_NAMES[activity.token]
                              )})`,
                            }}
                          >
                            <span className="mr-1">
                              {getTokenIcon(TOKEN_NAMES[activity.token])}
                            </span>
                            {TOKEN_NAMES[activity.token]}
                          </motion.span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center space-x-2 text-sm">
                        <FiClock className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-400 font-medium">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sender Info */}
                      <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20">
                        <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                          <FiArrowUpRight className="h-4 w-4 text-blue-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-blue-300 font-semibold mb-1">
                            From (Buyer)
                          </p>
                          <div className="flex items-center space-x-2">
                            <FiUser className="h-3 w-3 text-gray-400" />
                            <span className="font-mono text-xs text-white bg-blue-900/20 px-2 py-1 rounded border border-blue-500/20">
                              {activity.buyer?.slice(0, 6)}...
                              {activity.buyer?.slice(-4)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Amount Info */}
                      <div
                        className={`flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r ${getTokenGradient(
                          TOKEN_NAMES[activity.token]
                        )} border ${getTokenBorder(
                          TOKEN_NAMES[activity.token]
                        )}`}
                      >
                        <div
                          className={`p-2 rounded-lg bg-gradient-to-r ${getTokenGradient(
                            TOKEN_NAMES[activity.token]
                          )} border ${getTokenBorder(
                            TOKEN_NAMES[activity.token]
                          )}`}
                        >
                          <FiDollarSign
                            className={`h-4 w-4 ${getTokenColor(
                              TOKEN_NAMES[activity.token]
                            )}`}
                          />
                        </div>
                        <div className="flex-1">
                          <p
                            className={`text-xs font-semibold mb-1 ${getTokenColor(
                              TOKEN_NAMES[activity.token]
                            )}`}
                          >
                            Transaction Amount
                          </p>
                          <div className="flex items-center space-x-2">
                            <FiCreditCard className="h-3 w-3 text-gray-400" />
                            <span className="font-bold text-white text-sm">
                              {TOKEN_NAMES[activity.token] === "ETH"
                                ? `${contractService.formatTokenAmount(
                                    activity.amount,
                                    activity.token
                                  )} ETH`
                                : `$${contractService.formatTokenAmount(
                                    activity.amount,
                                    activity.token
                                  )}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-blue-300 font-semibold">
                          ✅ Processed Successfully
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <FiTrendingUp className="h-3 w-3" />
                        <span>Block confirmed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 rounded-full blur-xl"></div>
            <div className="relative p-8 rounded-full bg-gradient-to-r from-cyan-600/10 to-blue-600/10 border border-cyan-500/30">
              <FiActivity className="h-16 w-16 text-cyan-300 mx-auto" />
            </div>
          </div>
          <h4 className="text-2xl font-bold text-white mt-6 mb-3">
            No Recent Activity
          </h4>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            The activity feed will populate with real-time blockchain
            transactions and system events as they occur.
          </p>
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <FiDatabase className="h-4 w-4" />
            <span>Monitoring blockchain • Live updates • Real-time sync</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ActivityTab;
