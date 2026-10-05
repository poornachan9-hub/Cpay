import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiCreditCard,
  FiShoppingCart,
  FiCheck,
  FiX,
  FiExternalLink,
  FiAlertTriangle,
  FiShield,
  FiRefreshCw,
  FiSearch,
  FiTrendingUp,
  FiDollarSign,
  FiLock,
  FiStar,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import { contractService } from "../services/contract";
import { pinataService } from "../services/pinata";
import OnRampButton from "../components/OnRampButton";
import { CONTRACT_ADDRESSES } from "../lib/constants";
import {
  PAYMENT_TOKENS,
  TOKEN_NAMES,
} from "../lib/constants";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";
const PINATA_URL = process.env.NEXT_PUBLIC_PINATA_GATEWAY;

import { isAdminAddress } from "../lib/constants";

function ProductImage({ ipfsHash, alt }) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    async function fetchImage() {
      if (ipfsHash) {
        try {
          const metadata = await pinataService.fetchFromIPFS(ipfsHash);
          if (metadata && metadata.image) {
            setImageUrl(metadata.image);
          }
        } catch (e) {
          console.error("Failed to load metadata", e);
        }
      }
    }

    fetchImage();
  }, [ipfsHash]);

  return imageUrl ? (
    <img
      src={imageUrl}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      onError={(e) => {
        e.target.style.display = "none";
        e.target.parentElement.innerHTML = `
                  <div class="flex items-center justify-center h-full bg-gradient-to-br from-purple-600/20 to-indigo-600/20">
                    <svg class="h-16 w-16 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                `;
      }}
    />
  ) : (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-600/20 to-indigo-600/20">
      <FiShoppingCart className="h-16 w-16 text-purple-300" />
    </div>
  );
}

const Payments = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tokenBalances, setTokenBalances] = useState({});
  const [tokenAllowances, setTokenAllowances] = useState({});
  const [configurationValid, setConfigurationValid] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Check if current user is admin
  const isAdmin = isAdminAddress(address);

  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    // Validate configuration on component mount
    const isValid = Boolean(CONTRACT_ADDRESSES.PAYMENT_GATEWAY);
    setConfigurationValid(isValid);

    if (!isValid) {
      toast.error("Payment gateway is not configured for this network.");
    }

    if (isConnected) {
      loadProducts();
      loadTokenBalances();
    }
  }, [isConnected]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);
      const result = await contractService.getAllProducts(contract);

      if (result.success) {
        setProducts(result.data.filter((product) => product.isActive && product.status === 0));
      } else {
        toast.error("Failed to load products");
      }
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const loadTokenBalances = async () => {
    if (!isConnected || !address || !walletClient) return;

    try {
      setBalanceLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const polBalance = await provider.getBalance(address);
      setTokenBalances({ POL: ethers.utils.formatEther(polBalance) });
      setTokenAllowances({});
    } catch (error) {
      console.error("Error loading POL balance:", error);
      setTokenBalances({});
    } finally {
      setBalanceLoading(false);
    }
  };

  const handlePayment = async (productId, token, amount, metadata = {}) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      if (!configurationValid) {
        toast.error(
          "Token configuration is incomplete. Please check environment variables."
        );
        return;
      }



      setPaymentProcessing(true);

      // Create loading toast
      const loadingToastId = toast.loading("Processing payment...");

      try {
        const contract = await contractService.getContractWithWagmi(
          walletClient,
          CONTRACT_ABI
        );

        // Upload payment metadata to IPFS if provided
        let ipfsHash = "";
        if (Object.keys(metadata).length > 0) {
          toast.loading("Uploading payment metadata...", {
            id: loadingToastId,
          });

          const paymentMetadata = {
            ...metadata,
            timestamp: new Date().toISOString(),
            buyer: address,
            productId,
            token: TOKEN_NAMES[token],
          };

          const uploadResult = await pinataService.uploadJSON(paymentMetadata, {
            name: `Payment-${productId}-${address}-${Date.now()}`,
            keyvalues: {
              type: "payment-metadata",
              buyer: address,
              productId: productId.toString(),
            },
          });

          if (uploadResult.success) {
            ipfsHash = uploadResult.ipfsHash;
          }
        }

        toast.loading("Executing payment transaction...", {
          id: loadingToastId,
        });

        if (token !== PAYMENT_TOKENS.ETH) {
          throw new Error("Only POL payments are currently supported");
        }
        const result = await contractService.payWithETH(
          contract,
          productId,
          ipfsHash,
          amount
        );

        toast.dismiss(loadingToastId);

        if (result.success) {
          toast.success(
            `Payment successful! Transaction: ${result.hash.slice(0, 10)}...`
          );
          setShowPaymentModal(false);
          setSelectedProduct(null);

          // Refresh data
          toast.loading("Updating balances...");
          await Promise.all([loadProducts(), loadTokenBalances()]);
          toast.dismiss();
        } else {
          toast.error(`Payment failed: ${result.error}`);
        }
      } catch (error) {
        toast.dismiss(loadingToastId);
        throw error;
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error(`Payment failed: ${error.message}`);
    } finally {
      setPaymentProcessing(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openPaymentModal = (product) => {
    setSelectedProduct(product);
    setShowPaymentModal(true);
  };

  const getTokenBalance = (token) => {
    const balance = tokenBalances[token];
    return balance ? parseFloat(balance).toFixed(6) : "0.000000";
  };

  const refreshBalances = () => {
    if (isConnected) {
      loadTokenBalances();
      toast.success("Balances refreshed");
    }
  };

  return (
    <Layout title="Make Payments">
      <div className="space-y-8">
        {/* Configuration Warning */}
        {!configurationValid && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)",
              borderColor: "rgba(239, 68, 68, 0.3)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 via-indigo-600/5 to-red-600/5"></div>

            <div className="relative flex items-start space-x-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30">
                <FiAlertTriangle className="h-6 w-6 text-red-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-300 mb-2">
                  Configuration Issue
                </h3>
                <div className="text-gray-300 text-sm space-y-2">
                  <p>Token addresses are not properly configured. Please:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Check that your active network’s payment gateway address is configured.
                    </li>
                    <li>Ensure tokens are deployed to your current network</li>
                    <li>
                      Restart your development server after updating .env.local
                    </li>
                  </ul>
                </div>
                <div className="mt-4 flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => debugConfiguration()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600/30 to-indigo-600/30 border border-red-500/30 text-red-300 hover:text-white transition-all duration-300 text-sm font-medium"
                  >
                    Debug Configuration
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-600/30 to-gray-500/30 border border-gray-500/30 text-gray-300 hover:text-white transition-all duration-300 text-sm font-medium"
                  >
                    Reload Page
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}



        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
              <FiShoppingCart className="h-8 w-8 text-purple-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Products Marketplace
              </h1>
              <p className="text-gray-400 mt-1">
                Browse and purchase products with cryptocurrency
              </p>
            </div>
          </div>

          {/* Balance Display */}
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
                borderColor: "rgba(139, 92, 246, 0.2)",
              }}
            >
              {/* Background effects */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-xl"></div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <FiDollarSign className="h-5 w-5 text-blue-400" />
                    <span className="text-sm font-bold text-blue-300">
                      Your Wallet {isAdmin && <span className="text-purple-400">(Admin)</span>}
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 180 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={refreshBalances}
                    disabled={balanceLoading}
                    className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300"
                    title="Refresh balances"
                  >
                    <FiRefreshCw
                      className={`h-4 w-4 ${
                        balanceLoading ? "animate-spin" : ""
                      }`}
                    />
                  </motion.button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="text-center p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20">
                    <div className="font-bold text-blue-300 text-lg">
                      {getTokenBalance("POL")}
                    </div>
                    <div className="text-xs text-gray-400 font-medium">POL (Gas)</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-md relative group"
        >
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-purple-400 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
            style={{
              background:
                "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
            }}
          />
        </motion.div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
                  borderColor: "rgba(139, 92, 246, 0.2)",
                }}
              >
                {/* Loading skeleton */}
                <div className="space-y-4">
                  <div className="h-48 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-xl animate-pulse"></div>
                  <div className="h-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg animate-pulse"></div>
                  <div className="h-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-lg animate-pulse"></div>
                  <div className="h-10 bg-gradient-to-r from-gray-600/20 to-gray-500/20 rounded-lg animate-pulse"></div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  onBuyClick={openPaymentModal}
                  isConnected={isConnected}
                  configurationValid={configurationValid}
                  isAdmin={isAdmin}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="relative inline-block">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-full blur-xl"></div>
              <div className="relative p-8 rounded-full bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/30">
                <FiShoppingCart className="h-20 w-20 text-purple-300 mx-auto" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mt-6 mb-2">
              No products found
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {searchTerm
                ? "Try adjusting your search criteria to find products"
                : "No products are currently available for purchase"}
            </p>
          </motion.div>
        )}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onPayment={handlePayment}
          processing={paymentProcessing}
          tokenBalances={tokenBalances}
          tokenAllowances={tokenAllowances}
          isAdmin={isAdmin}
        />
      </div>
    </Layout>
  );
};

// Enhanced Product Card Component
const ProductCard = ({
  product,
  index,
  onBuyClick,
  isConnected,
  configurationValid,
  isAdmin,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
      style={{
        background:
          "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
        borderColor: "rgba(139, 92, 246, 0.2)",
      }}
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-600/10 to-transparent rounded-full blur-xl group-hover:from-purple-600/20 transition-all duration-500"></div>
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-indigo-600/10 to-transparent rounded-full blur-xl group-hover:from-indigo-600/20 transition-all duration-500"></div>
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-indigo-600/0 to-blue-600/0 group-hover:from-purple-600/5 group-hover:via-indigo-600/5 group-hover:to-blue-600/5 transition-all duration-500 rounded-2xl"></div>

      <div className="relative z-10">
        {/* Product Image */}
        <div className="h-48 rounded-t-2xl overflow-hidden relative">
          <ProductImage ipfsHash={product.ipfsHash} alt={product.name} />

          {/* Sales badge */}
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm border border-blue-500/30">
            <div className="flex items-center space-x-1 text-xs font-bold text-white">
              <FiTrendingUp className="h-3 w-3" />
              <span>{product.totalSales} sold</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold text-white truncate group-hover:text-purple-200 transition-colors">
              {product.name}
            </h3>
            <div className="flex items-center space-x-1">
              <FiStar className="h-4 w-4 text-yellow-400 fill-current" />
              <span className="text-xs text-gray-400">4.8</span>
            </div>
          </div>

          <p className="text-gray-400 text-sm mb-4 line-clamp-2 group-hover:text-gray-300 transition-colors">
            {product.description}
          </p>

          {/* Price display removed from UI per requirements */}

          {/* Merchant Info */}
          <div className="flex items-center justify-between text-xs mb-4 p-3 rounded-xl bg-gradient-to-r from-gray-600/10 to-gray-500/10 border border-gray-500/20">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {product.merchant.slice(2, 4).toUpperCase()}
                </span>
              </div>
              <span className="text-gray-400 font-mono">
                {product.merchant.slice(0, 6)}...{product.merchant.slice(-4)}
              </span>
            </div>
            {product.ipfsHash && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() =>
                  window.open(`${PINATA_URL}${product.ipfsHash}`, "_blank")
                }
                className="p-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300"
                title="View product details"
              >
                <FiExternalLink className="h-4 w-4" />
              </motion.button>
            )}
          </div>

          {/* Buy Button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onBuyClick(product)}
            disabled={!isConnected || !configurationValid}
            className="w-full group/btn relative overflow-hidden rounded-xl px-6 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-0 group-hover/btn:opacity-100 blur transition-opacity duration-300"></div>

            {/* Button shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>

            <div className="relative flex items-center justify-center space-x-2">
              <FiCreditCard className="h-5 w-5" />
              <span>
                {!isConnected
                  ? "Connect Wallet"
                  : !configurationValid
                  ? "Config Error"
                  : "Buy Now"}
              </span>
            </div>
          </motion.button>
          <OnRampButton product={product} />
        </div>
      </div>
    </motion.div>
  );
};

// Enhanced Price Row Component
const PriceRow = ({ icon, label, price, gradient, border, textColor }) => (
  <div
    className={`flex items-center justify-between p-2 rounded-lg bg-gradient-to-r ${gradient} border ${border} transition-all duration-300 hover:shadow-sm`}
  >
    <div className="flex items-center space-x-2">
      {icon}
      <span className={`text-sm font-medium ${textColor}`}>{label}</span>
    </div>
    <span className="font-bold text-white">{price}</span>
  </div>
);

// Enhanced Payment Modal Component
const PaymentModal = ({
  isOpen,
  onClose,
  product,
  onPayment,
  processing,
  tokenBalances = {},
  tokenAllowances = {},
  isAdmin,
}) => {
  const [selectedToken, setSelectedToken] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");

  useEffect(() => {
    if (product && isOpen) {
      setSelectedToken(
        parseFloat(product.priceETH) > 0 ? PAYMENT_TOKENS.ETH : null
      );
    }
  }, [product, isOpen, isAdmin]);

  if (!isOpen || !product) return null;

  const availableTokens = parseFloat(product.priceETH) > 0
    ? [{
        token: PAYMENT_TOKENS.ETH,
        name: "POL",
        price: product.priceETH,
        available: true,
        icon: FiDollarSign,
        color: "text-blue-300",
        gradient: "from-blue-600/20 to-purple-600/20",
        border: "border-blue-500/30",
      }]
    : [];

  const selectedTokenData = availableTokens.find(
    (t) => t.token === selectedToken
  );

  const getTokenBalance = (tokenName) => {
    const balance = tokenBalances[tokenName];
    return balance ? parseFloat(balance) : 0;
  };

  const hasEnoughBalance = (tokenData) => {
    const balance = getTokenBalance(tokenData.name);
    const requiredAmount = parseFloat(tokenData.price);
    return balance >= requiredAmount;
  };

  const needsApproval = (tokenData) => {
    if (tokenData.name === "POL") return false;

    const allowance = tokenAllowances[tokenData.name];
    if (!allowance) return true;

    const requiredAmount = ethers.utils.parseUnits(
      tokenData.price,
      TOKEN_CONFIG[tokenData.name].decimals
    );
    return allowance.lt(requiredAmount);
  };

  const handlePayment = () => {
    if (selectedToken === null || !selectedTokenData) {
      toast.error("Please select a payment method");
      return;
    }

    if (!hasEnoughBalance(selectedTokenData)) {
      toast.error(`Insufficient ${selectedTokenData.name} balance`);
      return;
    }

    const metadata = {
      note: paymentNote.trim(),
      paymentMethod: selectedTokenData.name,
      productName: product.name,
    };

    onPayment(product.id, selectedToken, selectedTokenData.price, metadata);
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
            className="relative inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 50%, rgba(15, 11, 19, 0.95) 100%)",
              borderColor: "rgba(139, 92, 246, 0.3)",
              boxShadow: "0 25px 50px rgba(139, 92, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-600/10 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-600/10 to-transparent rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                    <FiCreditCard className="h-6 w-6 text-purple-300" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    Purchase Product
                  </h3>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  disabled={processing}
                  className="p-2 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  <FiX className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Product Info */}
              <div
                className="mb-6 p-4 rounded-xl border backdrop-blur-sm"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                  borderColor: "rgba(139, 92, 246, 0.2)",
                }}
              >
                <h4 className="font-bold text-white mb-2 flex items-center space-x-2">
                  <FiShoppingCart className="h-4 w-4 text-purple-300" />
                  <span>{product.name}</span>
                </h4>
                <p className="text-sm text-gray-300 line-clamp-2 mb-3">
                  {product.description}
                </p>
                <div className="flex items-center space-x-2 text-xs text-gray-400">
                  <span>Merchant:</span>
                  <span className="font-mono px-2 py-1 rounded-lg bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30">
                    {product.merchant.slice(0, 6)}...
                    {product.merchant.slice(-4)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-purple-300 mb-3 flex items-center space-x-2">
                  <FiDollarSign className="h-4 w-4" />
                  <span>Select Payment Method</span>
                </label>
                {availableTokens.length > 0 ? (
                  <div className="space-y-3">
                    {availableTokens.map((tokenData) => {
                      const hasBalance = hasEnoughBalance(tokenData);
                      const needsTokenApproval = needsApproval(tokenData);

                      return (
                        <PaymentMethodOption
                          key={tokenData.token}
                          tokenData={tokenData}
                          selected={selectedToken === tokenData.token}
                          hasBalance={hasBalance}
                          needsApproval={needsTokenApproval}
                          balance={getTokenBalance(tokenData.name)}
                          onSelect={() => setSelectedToken(tokenData.token)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)",
                      borderColor: "rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <FiAlertTriangle className="h-5 w-5 text-red-400" />
                      <span className="font-bold text-red-300">
                        No Payment Methods Available
                      </span>
                    </div>
                    <p className="text-sm text-red-200">
                      This product has no POL price. Ask the merchant to update its listing.
                    </p>
                  </div>
                )}
              </div>

              {/* Token Approval Warning */}
              {selectedTokenData &&
                selectedTokenData.name !== "POL" &&
                needsApproval(selectedTokenData) && (
                  <div
                    className="mb-4 p-4 rounded-xl border"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%)",
                      borderColor: "rgba(245, 158, 11, 0.3)",
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                        <FiShield className="h-4 w-4 text-yellow-300" />
                      </div>
                      <div className="text-sm">
                        <p className="font-bold text-yellow-300 mb-1">
                          Token Approval Required
                        </p>
                        <p className="text-yellow-200">
                          You'll need to approve the contract to spend your{" "}
                          {selectedTokenData.name} tokens. This will require two
                          transactions: approval and payment.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* Payment Note */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-purple-300 mb-2">
                  Payment Note (Optional)
                </label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={3}
                  disabled={processing}
                  className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300 disabled:opacity-50 resize-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                    borderColor: "rgba(139, 92, 246, 0.2)",
                  }}
                  placeholder="Add a note for this payment..."
                />
              </div>

              {/* Payment Summary */}
              {selectedTokenData && (
                <PaymentSummary
                  tokenData={selectedTokenData}
                  balance={getTokenBalance(selectedTokenData.name)}
                  hasEnoughBalance={hasEnoughBalance(selectedTokenData)}
                />
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 mb-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onClose}
                  disabled={processing}
                  className="flex-1 px-6 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold disabled:opacity-50 hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                  style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePayment}
                  disabled={
                    processing ||
                    selectedToken === null ||
                    !selectedTokenData ||
                    !hasEnoughBalance(selectedTokenData)
                  }
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </div>
                  ) : selectedTokenData &&
                    !hasEnoughBalance(selectedTokenData) ? (
                    "Insufficient Balance"
                  ) : selectedTokenData &&
                    selectedTokenData.name !== "POL" &&
                    needsApproval(selectedTokenData) ? (
                    "Approve & Pay"
                  ) : (
                    "Pay Now"
                  )}
                </motion.button>
              </div>

              {/* Security Notice */}
              <div
                className="p-4 rounded-xl backdrop-blur-sm border"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                  borderColor: "rgba(59, 130, 246, 0.2)",
                }}
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                    <FiShield className="h-4 w-4 text-blue-300" />
                  </div>
                  <div className="text-xs text-blue-200">
                    <p className="font-bold mb-1">Secure Payment</p>
                    <p className="text-gray-300">
                      Your payment is processed securely on the blockchain.
                      {selectedTokenData &&
                        selectedTokenData.name !== "POL" &&
                        needsApproval(selectedTokenData) &&
                        " Two transactions will be required: token approval and payment."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Enhanced Payment Method Option Component
const PaymentMethodOption = ({
  tokenData,
  selected,
  hasBalance,
  needsApproval,
  balance,
  onSelect,
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      disabled={!hasBalance}
      className={`w-full flex items-center justify-between p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
        selected
          ? `bg-gradient-to-r ${tokenData.gradient} ${tokenData.border} ring-2 ring-opacity-50`
          : hasBalance
          ? `hover:bg-gradient-to-r ${tokenData.gradient} border-gray-500/30 hover:${tokenData.border}`
          : "border-red-500/30 bg-gradient-to-r from-red-600/10 to-indigo-600/10"
      } ${!hasBalance ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30">
          <tokenData.icon className={`h-5 w-5 ${tokenData.color}`} />
        </div>
        <div className="text-left">
          <div className="font-bold text-white">{tokenData.name}</div>
          <div className="text-xs text-gray-400">
            Balance: {balance.toFixed(6)}
          </div>
          {needsApproval && hasBalance && (
            <div className="text-xs text-yellow-300 flex items-center mt-1">
              <FiAlertTriangle className="h-3 w-3 mr-1" />
              Approval required
            </div>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-white">
          {tokenData.price} {tokenData.name}
        </div>
        {!hasBalance && (
          <div className="text-xs text-red-300">Insufficient balance</div>
        )}
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center mt-1"
          >
            <FiCheck className="h-4 w-4 text-blue-400" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
};

// Enhanced Payment Summary Component
const PaymentSummary = ({ tokenData, balance, hasEnoughBalance }) => {
  return (
    <div
      className="mb-6 p-4 rounded-xl backdrop-blur-sm border"
      style={{
        background:
          "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 50%, rgba(59, 130, 246, 0.1) 100%)",
        borderColor: "rgba(139, 92, 246, 0.2)",
      }}
    >
      <h5 className="font-bold text-white mb-3 flex items-center space-x-2">
        <FiDollarSign className="h-4 w-4 text-blue-400" />
        <span>Payment Summary</span>
      </h5>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Product Price:</span>
          <span className="font-bold text-white">
            {tokenData.price} {tokenData.name}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Payment Method:</span>
          <div className="flex items-center space-x-2">
            <tokenData.icon className={`h-4 w-4 ${tokenData.color}`} />
            <span className="font-bold text-white">{tokenData.name}</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Your Balance:</span>
          <span
            className={`font-bold ${
              hasEnoughBalance ? "text-blue-300" : "text-red-300"
            }`}
          >
            {balance.toFixed(6)} {tokenData.name}
          </span>
        </div>
        <div className="border-t border-purple-500/20 pt-2 mt-3">
          <div className="flex justify-between items-center font-bold text-lg">
            <span className="text-purple-300">Total:</span>
            <span className="text-white">
              {tokenData.price} {tokenData.name}
            </span>
          </div>
        </div>
        {!hasEnoughBalance && (
          <div
            className="text-xs text-red-300 mt-3 p-3 rounded-lg border"
            style={{
              background:
                "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)",
              borderColor: "rgba(239, 68, 68, 0.3)",
            }}
          >
            ⚠️ Insufficient balance. You need {tokenData.price} {tokenData.name}{" "}
            but only have {balance.toFixed(6)} {tokenData.name}.
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;