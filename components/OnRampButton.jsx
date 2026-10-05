import React, { useState } from "react";
import { FiCreditCard, FiLoader, FiExternalLink } from "react-icons/fi";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function OnRampButton({ product, onSuccess }) {
  const [loading, setLoading] = useState(false);

  // Retrieve token from Next.js auth system
  const getAuthToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("token") || "";
  };

  const handleFiatCheckout = async (e) => {
    e.preventDefault();
    if (!product || !product.priceUSDC || product.priceUSDC <= 0) {
      return toast.error("Product price in USDC must be defined for Fiat Checkout");
    }

    setLoading(true);
    const toastId = toast.loading("Generating Secure Fiat Checkout Route...");

    try {
      const token = getAuthToken();
      
      const payload = {
        productPriceUSDC: parseFloat(product.priceUSDC),
        productId: product.id,
        productName: product.name,
        merchantWallet: product.merchant,
      };

      const res = await fetch("/api/onramp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate fiat checkout");
      }

      toast.success(`Opening demo checkout (₹${data.requiredINR})`, { id: toastId });

      if (data.redirect_url) {
        const checkoutUrl = new URL(data.redirect_url, window.location.origin);
        window.location.href = checkoutUrl.toString();
      }
      
      if (onSuccess) onSuccess(data);

    } catch (err) {
      toast.error(err.message || "An unexpected error occurred", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleFiatCheckout}
      disabled={loading}
      className="w-full relative overflow-hidden rounded-xl px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 mt-3 flex items-center justify-center space-x-2 border border-blue-500/50"
    >
      {loading ? (
        <><FiLoader className="animate-spin h-5 w-5" /> <span>Connecting...</span></>
      ) : (
        <>
          <FiCreditCard className="h-5 w-5 text-blue-200" />
          <span>Pay with Fiat (Card)</span>
          <FiExternalLink className="h-4 w-4 ml-1 opacity-60" />
        </>
      )}
    </motion.button>
  );
}
