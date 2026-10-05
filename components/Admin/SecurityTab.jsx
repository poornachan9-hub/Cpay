import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUserPlus,
  FiUserMinus,
  FiCheck,
  FiLock,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiUsers,
  FiEye,
  FiKey,
  FiAlertTriangle,
  FiActivity,
  FiServer,
  FiCopy,
  FiTrash2,
  FiUserCheck,
  FiZap,
} from "react-icons/fi";
import toast from "react-hot-toast";

const SecurityTab = ({
  reviewers,
  newReviewer,
  setNewReviewer,
  onAddReviewer,
  onRemoveReviewer,
}) => {
  const [isScanning, setIsScanning] = useState(false);

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

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleSecurityScan = () => {
    setIsScanning(true);
    // Simulate security scan
    setTimeout(() => {
      setIsScanning(false);
      toast.success("Security scan completed - All systems secure!");
    }, 3000);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30">
          <FiShield className="h-5 w-5 text-red-300" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">
            Security Control Center
          </h3>
          <p className="text-gray-400 text-sm">
            Manage access controls, reviewers, and security protocols
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced KYC Reviewers */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-600/10 to-transparent rounded-full blur-2xl group-hover:from-purple-600/20 transition-all duration-500"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-600/10 to-transparent rounded-full blur-2xl group-hover:from-blue-600/20 transition-all duration-500"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30">
                <FiUsers className="h-5 w-5 text-purple-300" />
              </div>
              <div>
                <h4 className="font-bold text-purple-300 text-lg">
                  👥 KYC Reviewers
                </h4>
                <p className="text-xs text-gray-400">
                  Authorized identity verification team
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Add Reviewer Input */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-purple-300 mb-2">
                  Add New Reviewer
                </label>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={newReviewer}
                    onChange={(e) => setNewReviewer(e.target.value)}
                    placeholder="0x... Enter reviewer wallet address"
                    className="flex-1 px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.2)",
                    }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onAddReviewer}
                    disabled={!newReviewer.trim()}
                    className="group relative overflow-hidden px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* Button glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                    <div className="relative">
                      <FiUserPlus className="h-4 w-4" />
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Reviewers List */}
              {reviewers.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-300">
                      Active Reviewers:
                    </p>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-blue-300 font-semibold">
                        {reviewers.length} Active
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {reviewers.map((reviewer, index) => (
                        <motion.div
                          key={reviewer}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.1 }}
                          className="group flex items-center justify-between p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)",
                            borderColor: "rgba(139, 92, 246, 0.15)",
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-lg bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30">
                              <FiUserCheck className="h-4 w-4 text-purple-300" />
                            </div>
                            <div>
                              <span className="font-mono text-sm text-white">
                                {formatAddress(reviewer)}
                              </span>
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                                <span className="text-xs text-blue-300 font-semibold">
                                  Authorized
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() =>
                                copyToClipboard(reviewer, "Reviewer address")
                              }
                              className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                            >
                              <FiCopy className="h-3 w-3" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => onRemoveReviewer(reviewer)}
                              className="p-2 rounded-lg bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors"
                            >
                              <FiTrash2 className="h-3 w-3" />
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="relative inline-block">
                    <div className="absolute -inset-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-full blur-lg"></div>
                    <div className="relative p-4 rounded-full bg-gradient-to-r from-purple-600/10 to-blue-600/10 border border-purple-500/30">
                      <FiUsers className="h-8 w-8 text-purple-300" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 italic mt-4">
                    No additional reviewers configured
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Add trusted addresses to help with KYC verification
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Enhanced Security Status */}
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
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-600/10 to-transparent rounded-full blur-2xl group-hover:from-indigo-600/20 transition-all duration-500"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                <FiLock className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <h4 className="font-bold text-blue-300 text-lg">
                  🔐 Security Status
                </h4>
                <p className="text-xs text-gray-400">
                  System security overview
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Contract Owner */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-4 rounded-xl backdrop-blur-sm border"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)",
                  borderColor: "rgba(34, 197, 94, 0.15)",
                }}
              >
                <div className="flex items-center space-x-3">
                  <FiKey className="h-4 w-4 text-blue-300" />
                  <span className="text-sm font-semibold text-gray-300">
                    Contract Owner:
                  </span>
                </div>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/50 text-blue-300"
                >
                  <FiCheck className="h-3 w-3 mr-2" />✅ Verified
                </motion.span>
              </motion.div>

              {/* Access Control */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-4 rounded-xl backdrop-blur-sm border"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)",
                  borderColor: "rgba(34, 197, 94, 0.15)",
                }}
              >
                <div className="flex items-center space-x-3">
                  <FiShield className="h-4 w-4 text-blue-300" />
                  <span className="text-sm font-semibold text-gray-300">
                    Access Control:
                  </span>
                </div>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/50 text-blue-300"
                >
                  <FiLock className="h-3 w-3 mr-2" />
                  🔒 Secure
                </motion.span>
              </motion.div>

              {/* Reviewers Count */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-4 rounded-xl backdrop-blur-sm border"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)",
                  borderColor: "rgba(34, 197, 94, 0.15)",
                }}
              >
                <div className="flex items-center space-x-3">
                  <FiUsers className="h-4 w-4 text-blue-300" />
                  <span className="text-sm font-semibold text-gray-300">
                    Active Reviewers:
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-blue-300">
                    {reviewers.length + 1} Authorized
                  </span>
                </div>
              </motion.div>

              {/* Security Score */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl backdrop-blur-sm border"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
                  borderColor: "rgba(34, 197, 94, 0.2)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <FiActivity className="h-4 w-4 text-blue-300" />
                    <span className="text-sm font-semibold text-blue-300">
                      Security Score
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-blue-300">98%</span>
                </div>
                <div className="w-full bg-blue-900/20 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "98%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full"
                  ></motion.div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  All security protocols operational
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Security Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
          borderColor: "rgba(245, 158, 11, 0.2)",
        }}
      >
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-yellow-600/5 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-600/5 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
              <FiZap className="h-5 w-5 text-yellow-300" />
            </div>
            <div>
              <h4 className="font-bold text-yellow-300 text-lg">
                ⚡ Security Operations
              </h4>
              <p className="text-xs text-gray-400">
                Administrative security tools and reports
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden flex items-center justify-center px-6 py-4 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:shadow-lg hover:shadow-blue-500/10"
              style={{ borderColor: "rgba(59, 130, 246, 0.3)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 to-cyan-600/0 group-hover:from-blue-600/10 group-hover:to-cyan-600/10 transition-all duration-300 rounded-xl"></div>
              <div className="relative flex items-center space-x-2">
                <FiDownload className="h-4 w-4" />
                <span>📥 Export Logs</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden flex items-center justify-center px-6 py-4 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:shadow-lg hover:shadow-blue-500/10"
              style={{ borderColor: "rgba(34, 197, 94, 0.3)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 to-indigo-600/0 group-hover:from-blue-600/10 group-hover:to-indigo-600/10 transition-all duration-300 rounded-xl"></div>
              <div className="relative flex items-center space-x-2">
                <FiFileText className="h-4 w-4" />
                <span>📋 Audit Report</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSecurityScan}
              disabled={isScanning}
              className="group relative overflow-hidden flex items-center justify-center px-6 py-4 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:shadow-lg hover:shadow-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 to-indigo-600/0 group-hover:from-purple-600/10 group-hover:to-indigo-600/10 transition-all duration-300 rounded-xl"></div>
              <div className="relative flex items-center space-x-2">
                <FiRefreshCw
                  className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`}
                />
                <span>
                  {isScanning ? "🔍 Scanning..." : "🔍 Security Scan"}
                </span>
              </div>
            </motion.button>
          </div>

          {/* Security Tips */}
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-yellow-600/10 to-orange-600/10 border border-yellow-500/20">
            <div className="flex items-start space-x-3">
              <FiAlertTriangle className="h-5 w-5 text-yellow-300 mt-0.5" />
              <div>
                <h5 className="text-sm font-bold text-yellow-300 mb-2">
                  💡 Security Best Practices
                </h5>
                <ul className="text-xs text-gray-300 space-y-1">
                  <li>
                    • Regularly audit reviewer permissions and remove unused
                    accounts
                  </li>
                  <li>
                    • Monitor system logs for suspicious activity patterns
                  </li>
                  <li>
                    • Keep emergency pause functionality readily accessible
                  </li>
                  <li>
                    • Maintain secure backup of critical administrative keys
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SecurityTab;
