import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KYC_STATUS, MAX_FEE_RATE } from "../../lib/constants";
import {
  FiSettings,
  FiAlertTriangle,
  FiX,
  FiPause,
  FiPlay,
  FiDollarSign,
  FiZap,
  FiShield,
  FiServer,
  FiActivity,
  FiCheck,
  FiInfo,
  FiSliders,
  FiCpu,
} from "react-icons/fi";
import toast from "react-hot-toast";

const SettingsTab = ({ settings, onUpdateFee, onPause, onUnpause }) => {
  const [tempFee, setTempFee] = useState(settings.platformFee);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const handleFeeUpdate = () => {
    if (tempFee === settings.platformFee) {
      toast.error("Fee rate is already set to this value");
      return;
    }
    onUpdateFee(tempFee);
  };

  const handleEmergencyAction = (action) => {
    setPendingAction(action);
    setShowConfirmModal(true);
  };

  const confirmAction = () => {
    if (pendingAction === "pause") {
      onPause();
    } else if (pendingAction === "unpause") {
      onUnpause();
    }
    setShowConfirmModal(false);
    setPendingAction(null);
  };

  const calculatePercentage = (basisPoints) => {
    return (parseInt(basisPoints) / 100).toFixed(1);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
          <FiSliders className="h-5 w-5 text-purple-300" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">
            Platform Configuration
          </h3>
          <p className="text-gray-400 text-sm">
            Manage fees, emergency controls, and system settings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Platform Fee */}
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
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                <FiDollarSign className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <h4 className="font-bold text-blue-300 text-lg">
                  💰 Platform Fee Configuration
                </h4>
                <p className="text-xs text-gray-400">
                  Manage transaction fees and revenue
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-blue-300 mb-3">
                  Fee Rate Configuration
                </label>

                {/* Fee Input */}
                <div className="space-y-4">
                  <div className="flex items-end space-x-4">
                    <div className="flex-1">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max={MAX_FEE_RATE}
                          value={tempFee}
                          onChange={(e) => setTempFee(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-300"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                            borderColor: "rgba(59, 130, 246, 0.2)",
                          }}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <span className="text-sm text-gray-400 font-medium">
                            basis points
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-center min-w-[80px]">
                      <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                        <div className="text-lg font-bold text-blue-300">
                          {calculatePercentage(tempFee)}%
                        </div>
                        <div className="text-xs text-gray-400">final rate</div>
                      </div>
                    </div>
                  </div>

                  {/* Fee Preview */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-gray-600/10 to-slate-600/10 border border-gray-500/20">
                    <div className="text-xs text-gray-400 mb-2">
                      💡 Fee Preview Example:
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-white font-semibold">$100</div>
                        <div className="text-xs text-gray-400">Transaction</div>
                      </div>
                      <div className="text-center">
                        <div className="text-yellow-300 font-semibold">
                          ${((100 * parseInt(tempFee)) / 10000).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          Platform Fee
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-blue-300 font-semibold">
                          $
                          {(100 - (100 * parseInt(tempFee)) / 10000).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          Merchant Gets
                        </div>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFeeUpdate}
                    disabled={tempFee === settings.platformFee}
                    className="group relative overflow-hidden w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* Button glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                    {/* Button shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                    <div className="relative flex items-center justify-center space-x-2">
                      <FiSettings className="h-4 w-4" />
                      <span>Update Fee Rate</span>
                    </div>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Emergency Controls */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className={`group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 p-6 ${
            settings.isPaused
              ? "hover:shadow-lg hover:shadow-red-500/10"
              : "hover:shadow-lg hover:shadow-yellow-500/10"
          }`}
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: settings.isPaused
              ? "rgba(239, 68, 68, 0.2)"
              : "rgba(245, 158, 11, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-all duration-500 ${
                settings.isPaused
                  ? "bg-gradient-to-bl from-red-600/10 to-transparent group-hover:from-red-600/20"
                  : "bg-gradient-to-bl from-yellow-600/10 to-transparent group-hover:from-yellow-600/20"
              }`}
            ></div>
            <div
              className={`absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl transition-all duration-500 ${
                settings.isPaused
                  ? "bg-gradient-to-tr from-indigo-600/10 to-transparent group-hover:from-indigo-600/20"
                  : "bg-gradient-to-tr from-orange-600/10 to-transparent group-hover:from-orange-600/20"
              }`}
            ></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-6">
              <div
                className={`p-2 rounded-xl border ${
                  settings.isPaused
                    ? "bg-gradient-to-r from-red-600/20 to-indigo-600/20 border-red-500/30"
                    : "bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-yellow-500/30"
                }`}
              >
                <FiZap
                  className={`h-5 w-5 ${
                    settings.isPaused ? "text-red-300" : "text-yellow-300"
                  }`}
                />
              </div>
              <div>
                <h4
                  className={`font-bold text-lg ${
                    settings.isPaused ? "text-red-300" : "text-yellow-300"
                  }`}
                >
                  ⚡ Emergency Controls
                </h4>
                <p className="text-xs text-gray-400">
                  Critical system operation controls
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Warning Section */}
              <div
                className={`p-4 rounded-xl border ${
                  settings.isPaused
                    ? "bg-gradient-to-r from-red-600/10 to-indigo-600/10 border-red-500/20"
                    : "bg-gradient-to-r from-yellow-600/10 to-orange-600/10 border-yellow-500/20"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <FiAlertTriangle
                    className={`h-5 w-5 mt-0.5 ${
                      settings.isPaused ? "text-red-300" : "text-yellow-300"
                    }`}
                  />
                  <div className="flex-1">
                    <h5
                      className={`text-sm font-bold mb-2 ${
                        settings.isPaused ? "text-red-300" : "text-yellow-300"
                      }`}
                    >
                      {settings.isPaused
                        ? "🚨 System Currently Paused"
                        : "⚠️ Critical Operations Warning"}
                    </h5>
                    <p className="text-xs text-gray-300">
                      {settings.isPaused
                        ? "All platform operations are currently suspended. Users cannot create transactions or access services until the system is unpaused."
                        : "Emergency controls allow you to pause/unpause all contract operations. Use these controls only in critical situations that require immediate platform shutdown."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Status */}
              <div
                className="flex items-center justify-between p-4 rounded-xl backdrop-blur-sm border"
                style={{
                  background: settings.isPaused
                    ? "linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)"
                    : "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)",
                  borderColor: settings.isPaused
                    ? "rgba(239, 68, 68, 0.15)"
                    : "rgba(34, 197, 94, 0.15)",
                }}
              >
                <div className="flex items-center space-x-3">
                  <FiServer
                    className={`h-4 w-4 ${
                      settings.isPaused ? "text-red-300" : "text-blue-300"
                    }`}
                  />
                  <span className="text-sm font-semibold text-gray-300">
                    System Status:
                  </span>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm border ${
                    settings.isPaused
                      ? "bg-gradient-to-r from-red-600/30 to-indigo-600/30 border-red-500/50 text-red-300"
                      : "bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border-blue-500/50 text-blue-300"
                  }`}
                >
                  {settings.isPaused ? (
                    <>
                      <FiPause className="h-3 w-3 mr-2 animate-pulse" />
                      ⏸️ PAUSED
                    </>
                  ) : (
                    <>
                      <FiPlay className="h-3 w-3 mr-2" />
                      🟢 ACTIVE
                    </>
                  )}
                </motion.div>
              </div>

              {/* Action Button */}
              <div className="flex space-x-3">
                {settings.isPaused ? (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleEmergencyAction("unpause")}
                    className="group relative overflow-hidden flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                  >
                    {/* Button glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                    <div className="relative flex items-center justify-center space-x-2">
                      <FiPlay className="h-4 w-4" />
                      <span>Resume Operations</span>
                    </div>
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleEmergencyAction("pause")}
                    className="group relative overflow-hidden flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 via-indigo-600 to-rose-600 text-white font-semibold shadow-lg hover:shadow-red-500/25 transition-all duration-300"
                  >
                    {/* Button glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-indigo-600 to-rose-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                    <div className="relative flex items-center justify-center space-x-2">
                      <FiPause className="h-4 w-4" />
                      <span>Emergency Pause</span>
                    </div>
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Platform Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
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
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
              <FiCpu className="h-5 w-5 text-purple-300" />
            </div>
            <div>
              <h4 className="font-bold text-purple-300 text-lg">
                ⚙️ System Configuration
              </h4>
              <p className="text-xs text-gray-400">
                Platform limits and operational parameters
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Maximum Fee Rate */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-300">
                Maximum Allowed Fee Rate
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={`${MAX_FEE_RATE} basis points (${
                    MAX_FEE_RATE / 100
                  }%)`}
                  disabled
                  className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-gray-400 font-mono"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(75, 85, 99, 0.1) 100%)",
                    borderColor: "rgba(107, 114, 128, 0.2)",
                  }}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <FiInfo className="h-4 w-4 text-gray-500" />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Hardcoded smart contract limit
              </p>
            </div>

            {/* Current Status */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-300">
                Platform Operational Status
              </label>
              <div
                className={`p-4 rounded-xl backdrop-blur-sm border ${
                  settings.isPaused
                    ? "bg-gradient-to-r from-red-600/10 to-indigo-600/10 border-red-500/20"
                    : "bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-blue-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        settings.isPaused
                          ? "bg-red-400 animate-pulse"
                          : "bg-blue-400"
                      }`}
                    ></div>
                    <span
                      className={`text-sm font-bold ${
                        settings.isPaused ? "text-red-300" : "text-blue-300"
                      }`}
                    >
                      {settings.isPaused
                        ? "System Paused"
                        : "Fully Operational"}
                    </span>
                  </div>
                  {settings.isPaused ? (
                    <FiPause className="h-4 w-4 text-red-300" />
                  ) : (
                    <FiActivity className="h-4 w-4 text-blue-300" />
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {settings.isPaused
                  ? "All transactions and operations suspended"
                  : "Processing transactions normally"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
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
                onClick={() => setShowConfirmModal(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 50%, rgba(15, 11, 19, 0.95) 100%)",
                  borderColor:
                    pendingAction === "pause"
                      ? "rgba(239, 68, 68, 0.3)"
                      : "rgba(34, 197, 94, 0.3)",
                  boxShadow:
                    pendingAction === "pause"
                      ? "0 25px 50px rgba(239, 68, 68, 0.2)"
                      : "0 25px 50px rgba(34, 197, 94, 0.2)",
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-xl border ${
                          pendingAction === "pause"
                            ? "bg-gradient-to-r from-red-600/20 to-indigo-600/20 border-red-500/30"
                            : "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/30"
                        }`}
                      >
                        {pendingAction === "pause" ? (
                          <FiPause className="h-6 w-6 text-red-300" />
                        ) : (
                          <FiPlay className="h-6 w-6 text-blue-300" />
                        )}
                      </div>
                      <h3
                        className={`text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${
                          pendingAction === "pause"
                            ? "from-red-400 to-indigo-400"
                            : "from-blue-400 to-indigo-400"
                        }`}
                      >
                        {pendingAction === "pause"
                          ? "Confirm Emergency Pause"
                          : "Confirm System Resume"}
                      </h3>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowConfirmModal(false)}
                      className="p-2 rounded-xl bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30 text-gray-300 hover:text-white transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </motion.button>
                  </div>

                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-xl border ${
                        pendingAction === "pause"
                          ? "bg-gradient-to-r from-red-600/10 to-indigo-600/10 border-red-500/20"
                          : "bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-blue-500/20"
                      }`}
                    >
                      <p
                        className={`text-sm mb-2 ${
                          pendingAction === "pause"
                            ? "text-red-200"
                            : "text-blue-200"
                        }`}
                      >
                        {pendingAction === "pause" ? (
                          <>
                            <FiAlertTriangle className="h-4 w-4 inline mr-2" />
                            You are about to pause the entire platform
                          </>
                        ) : (
                          <>
                            <FiCheck className="h-4 w-4 inline mr-2" />
                            You are about to resume platform operations
                          </>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {pendingAction === "pause"
                          ? "This will immediately stop all transactions and operations. Users will not be able to access platform services until resumed."
                          : "This will restore all platform functionality. Users will be able to create transactions and access all services normally."}
                      </p>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowConfirmModal(false)}
                        className="flex-1 px-6 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                        style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={confirmAction}
                        className={`flex-1 px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 ${
                          pendingAction === "pause"
                            ? "bg-gradient-to-r from-red-600 via-indigo-600 to-rose-600 hover:shadow-red-500/25"
                            : "bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:shadow-blue-500/25"
                        } text-white`}
                      >
                        {pendingAction === "pause"
                          ? "Confirm Pause"
                          : "Confirm Resume"}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsTab;
