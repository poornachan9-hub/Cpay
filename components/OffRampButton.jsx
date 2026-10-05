import React, { useState } from "react";
import { FiDollarSign, FiArrowRight, FiX, FiCheckCircle, FiLoader } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function OffRampButton({ balance, userWallet, phone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(balance > 0 ? balance.toString() : "0");
  const [bankAccount, setBankAccount] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Retrieve token from Next.js auth system
  const getAuthToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("token") || "";
  };

  const handleCashOut = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return toast.error("Please enter a valid amount");
    if (amount > balance) return toast.error("Insufficient balance");
    if (!bankAccount || bankAccount.length < 9) return toast.error("Enter a valid Bank Account number");
    if (!ifscCode || ifscCode.length !== 11) return toast.error("Enter a valid 11-character IFSC code");

    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/offramp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          cryptoAmount: parseFloat(amount),
          userWallet,
          userBankIFSC: ifscCode.toUpperCase(),
          userBankAccount: bankAccount,
          userPhone: phone || ""
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to process transaction");
      }

      setResult(data);
      toast.success("Off-ramp request initiated successfully!");

      // If Mudrex returns a hosted checkout URL, seamlessly redirect the user
      if (data.redirect_url) {
        setTimeout(() => {
          window.location.href = data.redirect_url;
        }, 1500);
      }

    } catch (err) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setResult(null);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all font-semibold"
      >
        <FiDollarSign size={18} />
        <span>Cash Out USDC to INR</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-md relative"
            >
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
              >
                <FiX size={20} />
              </button>

              <h2 className="text-xl font-bold text-white mb-2">Withdraw to Bank</h2>
              
              {!result ? (
                <>
                  <p className="text-gray-400 text-sm mb-6">Available Balance: <span className="text-indigo-400 font-mono font-bold">{balance} USDC</span></p>

                  <form onSubmit={handleCashOut} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Amount to Cash Out (USDC)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        max={balance}
                        step="0.01"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Bank Account Number</label>
                      <input
                        type="password"
                        placeholder="e.g. 1234567890"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="e.g. SBIN0001234"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                        maxLength={11}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono uppercase"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-semibold py-3 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <><FiLoader className="animate-spin mr-2" size={18} /> Processing...</>
                      ) : (
                        <>Get INR Quote <FiArrowRight className="ml-2" size={18} /></>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-6">
                  <FiCheckCircle className="text-indigo-500 mx-auto mb-4" size={48} />
                  <h3 className="text-2xl font-bold text-white mb-2">Order Created!</h3>
                  <p className="text-gray-300 mb-6">
                    You are getting approximately <span className="font-bold text-indigo-400">₹{result.estimatedINR}</span> INR.
                  </p>
                  
                  {result.redirect_url ? (
                    <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
                      <FiLoader className="animate-spin" /> Redirecting to Mudrex checkout...
                    </p>
                  ) : (
                     <p className="text-sm text-gray-400">
                      Your payout is currently <span className="font-semibold text-yellow-400 uppercase">{result.status}</span>. We will notify you when it clears.
                     </p>
                  )}

                  <button
                    onClick={closeModal}
                    className="mt-8 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
