import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiEye,
  FiCheck,
  FiX,
  FiShield,
  FiUser,
  FiCalendar,
  FiFileText,
  FiAlertTriangle,
  FiClock,
  FiExternalLink,
  FiUserCheck,
  FiUserX,
  FiCopy,
  FiLock,
} from "react-icons/fi";
import { pinataService } from "../../services/pinata";
import toast from "react-hot-toast";

const PINATA_URL = process.env.NEXT_PUBLIC_PINATA_GATEWAY;

const KYCTab = ({ pendingKYC, onKYCReview }) => {
  const [selectedKYC, setSelectedKYC] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

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

  const handleApprove = (userAddress) => {
    onKYCReview(userAddress, true);
  };

  const handleReject = (userAddress) => {
    setSelectedKYC(userAddress);
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (rejectionReason.trim()) {
      onKYCReview(selectedKYC, false, rejectionReason);
      setShowRejectModal(false);
      setRejectionReason("");
      setSelectedKYC(null);
    } else {
      toast.error("Please provide a rejection reason");
    }
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getInitials = (address) => {
    return address.slice(2, 4).toUpperCase();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
            <FiShield className="h-5 w-5 text-yellow-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">
              Identity Verification Queue
            </h3>
            <p className="text-gray-400 text-sm">
              Review and approve user identity submissions
            </p>
          </div>
        </div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`inline-flex items-center px-4 py-2 rounded-xl font-bold text-sm backdrop-blur-sm border ${
            pendingKYC.length > 5
              ? "bg-gradient-to-r from-red-600/30 to-indigo-600/30 border-red-500/50 text-red-300"
              : pendingKYC.length > 0
              ? "bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border-yellow-500/50 text-yellow-300"
              : "bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border-blue-500/50 text-blue-300"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full mr-2 ${
              pendingKYC.length > 5
                ? "bg-red-400 animate-pulse"
                : pendingKYC.length > 0
                ? "bg-yellow-400 animate-pulse"
                : "bg-blue-400"
            }`}
          ></div>
          {pendingKYC.length} Pending Reviews
          {pendingKYC.length > 5 && (
            <FiAlertTriangle className="h-4 w-4 ml-2" />
          )}
        </motion.div>
      </div>

      {pendingKYC.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <AnimatePresence>
            {pendingKYC.map((kyc, index) => (
              <motion.div
                key={kyc.id || kyc.userAddress}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{
                  delay: index * 0.1,
                  duration: 0.3,
                  ease: "easeOut",
                }}
                whileHover={{ scale: 1.01, y: -4 }}
                className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 p-6"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
                  borderColor: "rgba(245, 158, 11, 0.2)",
                }}
              >
                {/* Background effects */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-yellow-600/10 to-transparent rounded-full blur-xl group-hover:from-yellow-600/20 transition-all duration-500"></div>
                  <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-orange-600/10 to-transparent rounded-full blur-xl group-hover:from-orange-600/20 transition-all duration-500"></div>
                </div>

                <div className="relative z-10">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    {/* User Info */}
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="h-12 w-12 bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <span className="text-sm font-bold text-white">
                            {getInitials(kyc.userAddress)}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border-2 border-yellow-500/50 rounded-full flex items-center justify-center">
                          <FiClock className="h-2 w-2 text-yellow-300" />
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <FiUser className="h-4 w-4 text-yellow-300" />
                          <p className="font-bold text-white text-lg">
                            Identity Verification
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-400">
                              Address:
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-sm text-white bg-yellow-900/20 px-3 py-1 rounded-lg border border-yellow-500/20">
                                {formatAddress(kyc.userAddress)}
                              </span>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() =>
                                  copyToClipboard(kyc.userAddress, "Address")
                                }
                                className="p-1 rounded-lg bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 text-yellow-300 hover:text-white transition-colors"
                              >
                                <FiCopy className="h-3 w-3" />
                              </motion.button>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 text-sm">
                            <FiCalendar className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-400">Submitted:</span>
                            <span className="text-white font-medium">
                              {new Date(
                                parseInt(kyc.submittedAt) * 1000
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
                      {kyc.ipfsHash && (
                        <motion.button
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            window.open(
                              `${PINATA_URL}${kyc.ipfsHash}`,
                              "_blank"
                            )
                          }
                          className="group relative overflow-hidden px-4 py-2 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20"
                          style={{ borderColor: "rgba(59, 130, 246, 0.3)" }}
                        >
                          <div className="flex items-center space-x-2">
                            <FiEye className="h-4 w-4" />
                            <span>View Documents</span>
                            <FiExternalLink className="h-3 w-3" />
                          </div>
                        </motion.button>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleApprove(kyc.userAddress)}
                        className="group relative overflow-hidden px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                      >
                        {/* Button glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                        {/* Button shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                        <div className="relative flex items-center space-x-2">
                          <FiUserCheck className="h-4 w-4" />
                          <span>Approve</span>
                        </div>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleReject(kyc.userAddress)}
                        className="group relative overflow-hidden px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-indigo-600 to-rose-600 text-white font-semibold shadow-lg hover:shadow-red-500/25 transition-all duration-300"
                      >
                        {/* Button glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-indigo-600 to-rose-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                        {/* Button shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                        <div className="relative flex items-center space-x-2">
                          <FiUserX className="h-4 w-4" />
                          <span>Reject</span>
                        </div>
                      </motion.button>
                    </div>
                  </div>

                  {/* Priority Indicator */}
                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-yellow-500/20">
                    <div className="flex items-center space-x-2">
                      <FiLock className="h-4 w-4 text-yellow-300" />
                      <span className="text-sm text-yellow-300 font-semibold">
                        Identity Verification Required
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                      <span>Awaiting admin review</span>
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
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-full blur-xl"></div>
            <div className="relative p-8 rounded-full bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/30">
              <FiUserCheck className="h-16 w-16 text-blue-300 mx-auto" />
            </div>
          </div>
          <h4 className="text-2xl font-bold text-white mt-6 mb-3">
            All Caught Up! 🎉
          </h4>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            No pending KYC submissions to review. All identity verifications are
            up to date and processed.
          </p>
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <FiShield className="h-4 w-4" />
            <span>Secure • Compliant • Verified</span>
          </div>
        </motion.div>
      )}

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && (
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
                onClick={() => setShowRejectModal(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 50%, rgba(15, 11, 19, 0.95) 100%)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                  boxShadow: "0 25px 50px rgba(239, 68, 68, 0.2)",
                }}
              >
                {/* Background effects */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-600/10 to-transparent rounded-full blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-600/10 to-transparent rounded-full blur-2xl"></div>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30">
                        <FiUserX className="h-6 w-6 text-red-300" />
                      </div>
                      <h3 className="text-xl font-bold bg-gradient-to-r from-red-400 to-indigo-400 bg-clip-text text-transparent">
                        Reject KYC Application
                      </h3>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowRejectModal(false)}
                      className="p-2 rounded-xl bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30 text-gray-300 hover:text-white transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </motion.button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-gradient-to-r from-red-600/10 to-indigo-600/10 border border-red-500/20">
                      <p className="text-sm text-red-200 mb-2">
                        <FiAlertTriangle className="h-4 w-4 inline mr-2" />
                        You are about to reject this KYC application
                      </p>
                      <p className="text-xs text-gray-400">
                        Please provide a clear reason for rejection to help the
                        user understand and address the issues.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-red-300 mb-2">
                        Rejection Reason *
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter detailed reason for rejection..."
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-transparent transition-all duration-300 resize-none"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                          borderColor: "rgba(239, 68, 68, 0.2)",
                        }}
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowRejectModal(false)}
                        className="flex-1 px-6 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                        style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={confirmReject}
                        disabled={!rejectionReason.trim()}
                        className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 via-indigo-600 to-rose-600 text-white font-bold shadow-lg hover:shadow-red-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Confirm Rejection
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

export default KYCTab;
