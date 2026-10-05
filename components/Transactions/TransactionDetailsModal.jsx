import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  FiCopy,
  FiShare2,
  FiLink,
  FiCode,
  FiPackage,
} from "react-icons/fi";
import toast from "react-hot-toast";

const TransactionDetailsModal = ({ isOpen, onClose, transaction }) => {
  if (!isOpen || !transaction) return null;

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
    return gradients[tokenName] || "from-blue-600/10 to-cyan-600/10";
  };

  const getTokenBorder = (tokenName) => {
    const borders = {
      ETH: "border-blue-500/30",
      USDT: "border-blue-500/30",
      USDC: "border-blue-500/30",
    };
    return borders[tokenName] || "border-blue-500/30";
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
            className="relative inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.95) 100%)",
              borderColor: "rgba(59, 130, 246, 0.3)",
              boxShadow: "0 25px 50px rgba(59, 130, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-700/10 to-cyan-600/10 rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gradient-to-r from-blue-500/5 to-cyan-600/5 rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/20 to-blue-800/20 border border-blue-500/30">
                    <FiDatabase className="h-8 w-8 text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                      Transaction Details
                    </h3>
                    <p className="text-gray-400 mt-1">
                      Complete blockchain transaction information
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-3 rounded-xl bg-gradient-to-r from-red-600/20 to-blue-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors"
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Transaction Info */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(14, 165, 233, 0.1) 100%)",
                      borderColor: "rgba(59, 130, 246, 0.2)",
                    }}
                  >
                    {/* Section glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-cyan-600/5 rounded-2xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-800/20 border border-blue-500/30">
                          <FiZap className="h-5 w-5 text-blue-300" />
                        </div>
                        <h4 className="font-bold text-blue-300 text-lg">
                          Transaction Information
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-r from-gray-600/10 to-gray-500/10 border border-gray-500/20">
                          <span className="text-sm text-gray-400 block mb-1">
                            Transaction ID:
                          </span>
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-white font-semibold">
                              #{transaction.id}
                            </p>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                copyToClipboard(
                                  transaction.id,
                                  "Transaction ID"
                                )
                              }
                              className="p-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                            >
                              <FiCopy className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                          <span className="text-sm text-blue-300 block mb-1">
                            Date & Time:
                          </span>
                          <p className="font-semibold text-white">
                            {transaction.date.toLocaleString()}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                          <span className="text-sm text-blue-300 block mb-1">
                            Status:
                          </span>
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm border ${
                              transaction.processed
                                ? "bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border-blue-500/50 text-blue-300"
                                : "bg-gradient-to-r from-yellow-600/30 to-amber-600/30 border-yellow-500/50 text-yellow-300"
                            }`}
                          >
                            {transaction.processed ? (
                              <FiCheck className="h-4 w-4 mr-2" />
                            ) : (
                              <FiClock className="h-4 w-4 mr-2" />
                            )}
                            {transaction.processed ? "Processed" : "Pending"}
                          </motion.span>
                        </div>

                        <div
                          className={`p-3 rounded-xl bg-gradient-to-r ${getTokenGradient(
                            transaction.tokenName
                          )} border ${getTokenBorder(transaction.tokenName)}`}
                        >
                          <span className="text-sm text-gray-300 block mb-1">
                            Payment Token:
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">
                              {getTokenIcon(transaction.tokenName)}
                            </span>
                            <p className="font-bold text-white text-lg">
                              {transaction.tokenName}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Product Info */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 184, 166, 0.1) 100%)",
                      borderColor: "rgba(16, 185, 129, 0.2)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-cyan-600/5 rounded-2xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                          <FiPackage className="h-5 w-5 text-blue-300" />
                        </div>
                        <h4 className="font-bold text-blue-300 text-lg">
                          Product Information
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-r from-gray-600/10 to-gray-500/10 border border-gray-500/20">
                          <span className="text-sm text-gray-400 block mb-1">
                            Product Name:
                          </span>
                          <div className="flex items-center space-x-2">
                            <FiShoppingBag className="h-4 w-4 text-blue-300" />
                            <p className="font-semibold text-white">
                              {transaction.productName}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-gradient-to-r from-gray-600/10 to-gray-500/10 border border-gray-500/20">
                          <span className="text-sm text-gray-400 block mb-1">
                            Product ID:
                          </span>
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-white font-semibold">
                              #{transaction.productId}
                            </p>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                copyToClipboard(
                                  transaction.productId,
                                  "Product ID"
                                )
                              }
                              className="p-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                            >
                              <FiCopy className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Payment Details */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)",
                      borderColor: "rgba(34, 197, 94, 0.2)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-cyan-600/5 rounded-2xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                          <FiDollarSign className="h-5 w-5 text-blue-300" />
                        </div>
                        <h4 className="font-bold text-blue-300 text-lg">
                          Payment Breakdown
                        </h4>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <FiTrendingUp className="h-4 w-4 text-blue-300" />
                              <span className="text-sm text-blue-300">
                                Total Amount:
                              </span>
                            </div>
                            <span className="font-bold text-xl text-white">
                              {transaction.tokenName === "ETH"
                                ? `${transaction.formattedAmount} ETH`
                                : `${transaction.formattedAmount} ${transaction.tokenName}`}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-r from-red-600/10 to-blue-600/10 border border-red-500/20">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <FiActivity className="h-4 w-4 text-red-300" />
                              <span className="text-sm text-red-300">
                                Platform Fee:
                              </span>
                            </div>
                            <span className="font-semibold text-red-300">
                              -
                              {transaction.tokenName === "ETH"
                                ? `${transaction.formattedFee} ETH`
                                : `${transaction.formattedFee} ${transaction.tokenName}`}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 border-t-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <FiCheck className="h-4 w-4 text-blue-300" />
                              <span className="text-sm text-blue-300 font-semibold">
                                Merchant Receives:
                              </span>
                            </div>
                            <span className="font-bold text-xl text-blue-300">
                              {transaction.tokenName === "ETH"
                                ? `${transaction.formattedMerchantAmount} ETH`
                                : `${transaction.formattedMerchantAmount} ${transaction.tokenName}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Transaction Parties */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(14, 165, 233, 0.1) 100%)",
                      borderColor: "rgba(59, 130, 246, 0.2)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-cyan-600/5 rounded-2xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                          <FiUser className="h-5 w-5 text-blue-300" />
                        </div>
                        <h4 className="font-bold text-blue-300 text-lg">
                          Transaction Parties
                        </h4>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                          <div className="flex items-center space-x-2 mb-2">
                            <FiArrowUpRight className="h-4 w-4 text-blue-300" />
                            <span className="text-sm text-blue-300 font-semibold">
                              Buyer:
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-xs text-white bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-500/20 break-all">
                              {transaction.buyer}
                            </p>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                copyToClipboard(
                                  transaction.buyer,
                                  "Buyer address"
                                )
                              }
                              className="ml-2 p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                            >
                              <FiCopy className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                          <div className="flex items-center space-x-2 mb-2">
                            <FiArrowDownLeft className="h-4 w-4 text-blue-300" />
                            <span className="text-sm text-blue-300 font-semibold">
                              Merchant:
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-xs text-white bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-500/20 break-all">
                              {transaction.merchant}
                            </p>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                copyToClipboard(
                                  transaction.merchant,
                                  "Merchant address"
                                )
                              }
                              className="ml-2 p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                            >
                              <FiCopy className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Full Width Sections */}
              <div className="grid grid-cols-1 gap-6 mt-6">
                {/* Metadata */}
                {transaction.metadata && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(75, 85, 99, 0.1) 100%)",
                      borderColor: "rgba(107, 114, 128, 0.2)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-600/5 to-slate-600/5 rounded-2xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-gray-600/20 to-slate-600/20 border border-gray-500/30">
                          <FiCode className="h-5 w-5 text-gray-300" />
                        </div>
                        <h4 className="font-bold text-gray-300 text-lg">
                          Transaction Metadata
                        </h4>
                      </div>

                      <div className="p-4 rounded-xl bg-gradient-to-r from-gray-800/50 to-slate-800/50 border border-gray-600/30">
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(transaction.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* IPFS Link */}
                {transaction.ipfsHash && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="relative overflow-hidden rounded-2xl backdrop-blur-sm border p-6"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)",
                      borderColor: "rgba(245, 158, 11, 0.2)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/5 to-amber-600/5 rounded-2xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border border-yellow-500/30">
                          <FiLink className="h-5 w-5 text-yellow-300" />
                        </div>
                        <h4 className="font-bold text-yellow-300 text-lg">
                          Decentralized Storage
                        </h4>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-yellow-600/10 to-amber-600/10 border border-yellow-500/20">
                        <div className="flex-1">
                          <p className="text-sm text-yellow-300 mb-1">
                            IPFS Hash:
                          </p>
                          <p className="font-mono text-xs text-white bg-yellow-900/20 px-3 py-2 rounded-lg border border-yellow-500/20 break-all">
                            {transaction.ipfsHash}
                          </p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() =>
                              copyToClipboard(transaction.ipfsHash, "IPFS hash")
                            }
                            className="p-2 rounded-lg bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border border-yellow-500/30 text-yellow-300 hover:text-white transition-colors"
                          >
                            <FiCopy className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() =>
                              window.open(
                                `https://gateway.pinata.cloud/ipfs/${transaction.ipfsHash}`,
                                "_blank"
                              )
                            }
                            className="px-4 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-semibold"
                          >
                            <FiExternalLink className="h-4 w-4 mr-2 inline" />
                            View on IPFS
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-8 border-t border-blue-500/20"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                  style={{ borderColor: "rgba(59, 130, 246, 0.3)" }}
                >
                  Close
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const txUrl = `${window.location.origin}/transactions?id=${transaction.id}`;
                    copyToClipboard(txUrl, "Transaction link");
                  }}
                  className="group relative overflow-hidden px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                >
                  {/* Button glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                  {/* Button shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                  <div className="relative flex items-center space-x-2">
                    <FiShare2 className="h-5 w-5" />
                    <span>Share Transaction</span>
                  </div>
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TransactionDetailsModal;
