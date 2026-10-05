import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiCreditCard,
  FiExternalLink,
  FiShield,
  FiAlertTriangle,
  FiArrowLeft,
  FiShare2,
  FiCopy,
  FiRefreshCw,
  FiCheckCircle,
  FiDollarSign,
  FiUser,
  FiPackage,
  FiLock,
  FiStar,
  FiDownload,
  FiMail,
  FiCheck,
} from "react-icons/fi";
import { SiEthereum } from "react-icons/si";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "framer-motion";
import { contractService } from "../../services/contract";
import { pinataService } from "../../services/pinata";
import {
  PAYMENT_TOKENS,
  TOKEN_NAMES,
  getTokenAddress,
  TOKEN_CONFIG,
  validateContractAddresses,
} from "../../lib/constants";
import { ethers } from "ethers";
import toast, { Toaster } from "react-hot-toast";
import { CONTRACT_ADDRESSES } from "../../lib/constants";
import ABI from "../../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";
import OnRampButton from "../../components/OnRampButton";

// Payment Success Confirmation Component
function PaymentSuccessModal({
  isOpen,
  onClose,
  transactionHash,
  product,
  paymentDetails,
  onNewPayment,
}) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const copyTransactionHash = () => {
    navigator.clipboard
      .writeText(transactionHash)
      .then(() => toast.success("Transaction hash copied!"))
      .catch(() => toast.error("Failed to copy"));
  };

  const viewOnExplorer = () => {
    window.open(`https://etherscan.io/tx/${transactionHash}`, "_blank");
  };

  const sharePayment = () => {
    const shareText = `I just completed a secure crypto payment for ${product?.name}! 🎉\n\nTransaction: ${transactionHash}\n\nPowered by blockchain technology ⚡`;

    if (navigator.share) {
      navigator.share({
        title: "Payment Successful!",
        text: shareText,
      });
    } else {
      navigator.clipboard
        .writeText(shareText)
        .then(() => toast.success("Payment details copied to clipboard!"))
        .catch(() => toast.error("Failed to copy"));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15, 11, 19, 0.95)" }}
        >
          {/* Confetti Effect */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(50)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: Math.random() * window.innerWidth,
                    y: -10,
                    rotate: 0,
                    scale: 0,
                  }}
                  animate={{
                    y: window.innerHeight + 10,
                    rotate: 360,
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 3,
                    delay: Math.random() * 2,
                    ease: "easeOut",
                  }}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: [
                      "#8B5CF6",
                      "#EC4899",
                      "#3B82F6",
                      "#10B981",
                      "#F59E0B",
                    ][Math.floor(Math.random() * 5)],
                  }}
                />
              ))}
            </div>
          )}

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            className="relative max-w-lg w-full mx-auto backdrop-blur-xl rounded-3xl border overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.9) 0%, rgba(26, 22, 37, 0.9) 50%, rgba(15, 11, 19, 0.9) 100%)",
              borderColor: "rgba(34, 197, 94, 0.3)",
              boxShadow: "0 25px 50px rgba(34, 197, 94, 0.2)",
            }}
          >
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-500/20 to-transparent rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10 p-8">
              {/* Success Icon */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 10,
                    delay: 0.2,
                  }}
                  className="relative inline-block"
                >
                  <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/30 to-blue-500/30 rounded-full blur-xl animate-pulse"></div>
                  <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-blue-500 to-blue-500 flex items-center justify-center shadow-lg">
                    <FiCheckCircle className="h-10 w-10 text-white" />
                  </div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-400 bg-clip-text text-transparent mt-4 mb-2"
                >
                  Payment Successful! 🎉
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-gray-300 mb-6"
                >
                  Your payment has been processed successfully on the blockchain
                </motion.p>
              </div>

              {/* Payment Details */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-4 mb-6"
              >
                {/* Product Info */}
                <div className="flex items-center space-x-4 p-4 rounded-xl backdrop-blur-sm border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-blue-500/10">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-indigo-600/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                    <FiPackage className="h-8 w-8 text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg">
                      {product?.name}
                    </h3>
                    <p className="text-gray-300 text-sm">
                      {product?.description}
                    </p>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="p-4 rounded-xl backdrop-blur-sm border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
                  <h4 className="font-bold text-white mb-3 flex items-center">
                    <FiDollarSign className="h-4 w-4 mr-2 text-blue-400" />
                    Payment Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount Paid:</span>
                      <span className="font-bold text-white">
                        {paymentDetails?.amount} {paymentDetails?.token}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Payment Method:</span>
                      <span className="font-bold text-blue-300">
                        {paymentDetails?.token}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status:</span>
                      <span className="font-bold text-blue-300 flex items-center">
                        <FiCheck className="h-3 w-3 mr-1" />
                        Confirmed
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Hash */}
                <div className="p-4 rounded-xl backdrop-blur-sm border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                  <h4 className="font-bold text-white mb-3 flex items-center">
                    <FiShield className="h-4 w-4 mr-2 text-blue-400" />
                    Transaction Details
                  </h4>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400">
                      Transaction Hash:
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 px-3 py-2 bg-black/30 rounded-lg text-xs font-mono text-blue-300 border border-blue-500/20">
                        {transactionHash}
                      </code>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={copyTransactionHash}
                        className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors"
                      >
                        <FiCopy className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={viewOnExplorer}
                    className="flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all font-medium"
                  >
                    <FiExternalLink className="h-4 w-4 mr-2" />
                    View on Explorer
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={sharePayment}
                    className="flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all font-medium"
                  >
                    <FiShare2 className="h-4 w-4 mr-2" />
                    Share
                  </motion.button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onNewPayment}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  Make Another Payment
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="w-full py-3 px-6 rounded-xl border border-gray-500/30 text-gray-300 hover:text-white hover:bg-gray-600/20 transition-all font-medium"
                >
                  Close
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const ShareablePaymentPage = () => {
  const router = useRouter();
  const { productId } = router.query;
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [tokenBalances, setTokenBalances] = useState({});
  const [tokenAllowances, setTokenAllowances] = useState({});
  const [configurationValid, setConfigurationValid] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Payment Success States
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastPaymentHash, setLastPaymentHash] = useState("");
  const [lastPaymentDetails, setLastPaymentDetails] = useState(null);

  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    // Validate configuration
    const isValid = validateContractAddresses();
    setConfigurationValid(isValid);

    if (productId) {
      loadProduct();
    }
  }, [productId]);

  // Load balances when wallet connects or changes
  useEffect(() => {
    if (isConnected && address && walletClient) {
      console.log("👛 Wallet connected, loading balances...");
      loadTokenBalances();
    } else {
      // Clear balances when wallet disconnects
      setTokenBalances({});
      setTokenAllowances({});
    }
  }, [isConnected, address, walletClient]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);
      const result = await contractService.getProduct(contract, productId);

      if (result.success && result.data.isActive) {
        let productData = result.data;
        if (productData.ipfsHash) {
          try {
            const metadata = await pinataService.fetchFromIPFS(productData.ipfsHash);
            if (metadata) {
              const PINATA_URL = process.env.NEXT_PUBLIC_PINATA_GATEWAY?.endsWith("/") ? process.env.NEXT_PUBLIC_PINATA_GATEWAY : (process.env.NEXT_PUBLIC_PINATA_GATEWAY ? process.env.NEXT_PUBLIC_PINATA_GATEWAY + "/" : "https://gateway.pinata.cloud/ipfs/");
              let resolvedImage = metadata.image;
              if (resolvedImage && resolvedImage.startsWith("ipfs://")) {
                resolvedImage = resolvedImage.replace("ipfs://", PINATA_URL);
              } else if (resolvedImage && !resolvedImage.startsWith("http")) {
                 resolvedImage = PINATA_URL + resolvedImage;
              }
              productData = { ...productData, image: resolvedImage || null };
            }
          } catch (e) {
            console.error("Failed to fetch metadata", e);
          }
        }
        setProduct(productData);
        console.log("📦 Product loaded:", productData);

        // This checkout accepts native POL only.
        if (parseFloat(result.data.priceETH) > 0) {
          setSelectedToken(PAYMENT_TOKENS.ETH);
        } else {
          setSelectedToken(null);
        }
      } else {
        toast.error("Product not found or inactive");
        router.push("/");
      }
    } catch (error) {
      console.error("Error loading product:", error);
      toast.error("Failed to load product");
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const loadTokenBalances = async () => {
    try {
      if (!isConnected || !address || !walletClient) {
        console.log("❌ Cannot load balances - wallet not ready");
        return;
      }

      console.log("🔄 Loading token balances...");
      setBalanceLoading(true);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      // Reset balances first
      setTokenBalances({});
      setTokenAllowances({});

      // Load native POL balance
      try {
        const polBalance = await provider.getBalance(address);
        const formattedPOL = ethers.utils.formatEther(polBalance);

        setTokenBalances((prev) => ({
          ...prev,
          POL: formattedPOL,
        }));
      } catch (error) {
        console.error("Error loading POL balance:", error);
      }
    } catch (error) {
      console.error("❌ Error in loadTokenBalances:", error);
    } finally {
      setBalanceLoading(false);
    }
  };

  const refreshBalances = () => {
    if (isConnected && address && walletClient) {
      console.log("🔄 Manual balance refresh triggered");
      loadTokenBalances();
      toast.success("Refreshing balances...");
    } else {
      toast.error("Please connect your wallet first");
    }
  };

  const handlePayment = async () => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      if (!configurationValid) {
        toast.error("Payment system is not properly configured");
        return;
      }

      if (!hasEnoughBalance(selectedTokenData)) {
        toast.error(`Insufficient ${selectedTokenData.name} balance`);
        return;
      }

      setPaymentProcessing(true);

      const loadingToastId = toast.loading("Processing payment...");

      try {
        const contract = await contractService.getContractWithWagmi(
          walletClient,
          CONTRACT_ABI
        );

        // Upload payment metadata
        let ipfsHash = "";
        if (paymentNote.trim()) {
          const paymentMetadata = {
            note: paymentNote.trim(),
            timestamp: new Date().toISOString(),
            buyer: address,
            productId,
            token: TOKEN_NAMES[selectedToken],
            paymentMethod: selectedTokenData.name,
            productName: product.name,
            shareableLink: true,
          };

          const uploadResult = await pinataService.uploadJSON(paymentMetadata, {
            name: `ShareablePayment-${productId}-${address}-${Date.now()}`,
            keyvalues: {
              type: "shareable-payment-metadata",
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

        if (selectedToken !== PAYMENT_TOKENS.ETH) {
          throw new Error("Only POL payments are currently supported");
        }
        const result = await contractService.payWithETH(
          contract,
          productId,
          ipfsHash,
          selectedTokenData.price
        );

        toast.dismiss(loadingToastId);

        if (result.success) {
          // Store payment details for success modal
          setLastPaymentHash(result.hash);
          setLastPaymentDetails({
            amount: selectedTokenData.price,
            token: selectedTokenData.name,
            timestamp: new Date().toISOString(),
          });

          // Show success modal
          setShowSuccessModal(true);

          // Clear payment form
          setPaymentNote("");

          // Refresh balances after successful payment
          setTimeout(() => {
            loadTokenBalances();
          }, 2000);
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

  const handleNewPayment = () => {
    setShowSuccessModal(false);
    setLastPaymentHash("");
    setLastPaymentDetails(null);
    setPaymentNote("");
    // Optionally refresh balances
    loadTokenBalances();
  };

  const copyPaymentLink = () => {
    const link = `${window.location.origin}/pay/${productId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        toast.success("Payment link copied to clipboard!");
      })
      .catch(() => {
        toast.error("Failed to copy link");
      });
  };

  const sharePaymentLink = () => {
    const link = `${window.location.origin}/pay/${productId}`;
    if (navigator.share) {
      navigator.share({
        title: `Pay for ${product?.name}`,
        text: `Complete your payment for ${product?.name}`,
        url: link,
      });
    } else {
      copyPaymentLink();
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: "#0F0B13" }}
      >
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "linear-gradient(135deg, #1a1625 0%, #2d1b3d 100%)",
              color: "#fff",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(139, 92, 246, 0.2)",
            },
          }}
        />

        {/* Animated background particles */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-transparent border-t-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-spin animate-reverse mx-auto"></div>
          </div>
          <p className="bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent text-xl font-bold">
            Loading payment page...
          </p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: "#0F0B13" }}
      >
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "linear-gradient(135deg, #1a1625 0%, #2d1b3d 100%)",
              color: "#fff",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(139, 92, 246, 0.2)",
            },
          }}
        />

        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-gradient-to-r from-red-500/10 to-indigo-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-center max-w-md mx-auto p-8">
          <div className="relative inline-block mb-6">
            <div className="absolute -inset-4 bg-gradient-to-r from-red-600/20 to-indigo-600/20 rounded-full blur-xl"></div>
            <div className="relative p-6 rounded-full bg-gradient-to-r from-red-600/10 to-indigo-600/10 border border-red-500/30">
              <FiPackage className="h-16 w-16 text-red-300 mx-auto" />
            </div>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-indigo-400 bg-clip-text text-transparent mb-2">
            Product Not Found
          </h2>
          <p className="text-gray-400 mb-6">
            The product you're looking for doesn't exist or is no longer
            available.
          </p>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/")}
            className="inline-flex items-center px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
          >
            <FiArrowLeft className="h-5 w-5 mr-2" />
            Go Home
          </motion.button>
        </div>
      </div>
    );
  }

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
    if (!isConnected) return false;
    const balance = getTokenBalance(tokenData.name);
    const requiredAmount = parseFloat(tokenData.price);
    console.log(
      `💰 Balance check for ${tokenData.name}: have ${balance}, need ${requiredAmount}`
    );
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

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ backgroundColor: "#0F0B13" }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "linear-gradient(135deg, #1a1625 0%, #2d1b3d 100%)",
            color: "#fff",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(139, 92, 246, 0.2)",
          },
        }}
      />

      {/* Payment Success Modal */}
      <PaymentSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        transactionHash={lastPaymentHash}
        product={product}
        paymentDetails={lastPaymentDetails}
        onNewPayment={handleNewPayment}
      />

      {/* Animated background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-purple-600/5 to-indigo-600/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-600/5 to-cyan-600/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-0 w-72 h-72 bg-gradient-to-r from-blue-600/5 to-cyan-600/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Header */}
      <header
        className="backdrop-blur-xl border-b sticky top-0 z-30 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 100%)",
          borderColor: "rgba(139, 92, 246, 0.2)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 via-indigo-600/5 to-blue-600/5"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => router.push("/")}
                className="p-2 rounded-xl bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30 text-gray-300 hover:text-white transition-all duration-300"
              >
                <FiArrowLeft className="h-5 w-5" />
              </motion.button>
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-purple-600/20 to-indigo-600/20">
                  <FiCreditCard className="h-5 w-5 text-purple-300" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                  Secure Payment
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyPaymentLink}
                className="inline-flex items-center px-4 py-2 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 text-sm font-medium hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
              >
                <FiCopy className="h-4 w-4 mr-2" />
                Copy Link
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sharePaymentLink}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
              >
                <FiShare2 className="h-4 w-4 mr-2" />
                Share
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <div className="relative z-10 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Section - Product Information */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl border shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
              boxShadow: "0 25px 50px rgba(139, 92, 246, 0.1)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-600/10 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-600/10 to-transparent rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10 p-6">
              <div className="mb-6">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-64 md:h-80 rounded-2xl object-cover border border-purple-500/30 shadow-lg"
                  />
                ) : (
                  <div className="w-full h-64 md:h-80 bg-gradient-to-br from-purple-600/20 to-indigo-600/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                    <FiPackage className="h-20 w-20 text-purple-300" />
                  </div>
                )}
              </div>

              {/* Product Header */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-white mb-3">
                      {product.name}
                    </h2>
                    <p className="text-gray-300 text-lg leading-relaxed mb-4">
                      {product.description}
                    </p>
                  </div>

                  {/* Sales badge */}
                  <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm border border-blue-500/30">
                    <div className="flex items-center space-x-2 text-sm font-bold text-white">
                      <FiStar className="h-4 w-4" />
                      <span>{product.totalSales} Sales</span>
                    </div>
                  </div>
                </div>

                {/* Merchant Info */}
                <div className="flex items-center space-x-3 p-4 rounded-xl backdrop-blur-sm border border-purple-500/20 bg-gradient-to-r from-purple-600/10 to-indigo-600/10">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                    <FiUser className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Merchant</div>
                    <div className="font-mono text-purple-300 font-medium">
                      {product.merchant.slice(0, 8)}...
                      {product.merchant.slice(-6)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Details */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                  <FiPackage className="h-5 w-5 text-purple-300" />
                  <span>Product Details</span>
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  {/* Available Payment Methods */}
                  <div className="p-4 rounded-xl backdrop-blur-sm border border-blue-500/20 bg-gradient-to-r from-blue-600/10 to-cyan-600/10">
                    <h4 className="font-bold text-blue-300 mb-3 flex items-center">
                      <FiDollarSign className="h-4 w-4 mr-2" />
                      Available Payment Methods
                    </h4>
                    <div className="space-y-2">
                      {availableTokens.map((tokenData) => (
                        <div
                          key={tokenData.token}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="text-gray-300 flex items-center space-x-2">
                            <tokenData.icon
                              className={`h-4 w-4 ${tokenData.color}`}
                            />
                            <span>{tokenData.name}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security Info */}
                  <div className="p-4 rounded-xl backdrop-blur-sm border border-blue-500/20 bg-gradient-to-r from-blue-600/10 to-cyan-600/10">
                    <h4 className="font-bold text-blue-300 mb-3 flex items-center">
                      <FiShield className="h-4 w-4 mr-2" />
                      Security & Trust
                    </h4>
                    <div className="space-y-2 text-sm text-blue-200">
                      <div className="flex items-center space-x-2">
                        <FiCheckCircle className="h-3 w-3 text-blue-400" />
                        <span>Blockchain secured payments</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FiCheckCircle className="h-3 w-3 text-blue-400" />
                        <span>End-to-end encryption</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FiCheckCircle className="h-3 w-3 text-blue-400" />
                        <span>Transparent transaction records</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Section - Payment Options */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl border shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
              boxShadow: "0 25px 50px rgba(139, 92, 246, 0.1)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10">
              {/* Configuration Warning */}
              {!configurationValid && (
                <div
                  className="p-4 border-b border-red-500/20"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)",
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30">
                      <FiAlertTriangle className="h-4 w-4 text-red-300" />
                    </div>
                    <div className="text-sm text-red-200">
                      Payment system is not properly configured. Please contact
                      the merchant.
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20">
                      <FiDollarSign className="h-5 w-5 text-blue-300" />
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Select Payment Method
                    </h3>
                  </div>
                  {isConnected && (
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 180 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={refreshBalances}
                      disabled={balanceLoading}
                      className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300 disabled:opacity-50"
                      title="Refresh balances"
                    >
                      <FiRefreshCw
                        className={`h-4 w-4 ${
                          balanceLoading ? "animate-spin" : ""
                        }`}
                      />
                    </motion.button>
                  )}
                </div>

                {availableTokens.length > 0 ? (
                  <div className="space-y-4 mb-6">
                    {availableTokens.map((tokenData, index) => {
                      const hasBalance = hasEnoughBalance(tokenData);
                      const needsTokenApproval = needsApproval(tokenData);
                      const balance = getTokenBalance(tokenData.name);

                      return (
                        <motion.button
                          key={tokenData.token}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedToken(tokenData.token)}
                          disabled={!isConnected}
                          className={`w-full flex items-center justify-between p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
                            selectedToken === tokenData.token
                              ? `bg-gradient-to-r ${tokenData.gradient} ${tokenData.border} ring-2 ring-opacity-50`
                              : `hover:bg-gradient-to-r hover:${tokenData.gradient} border-gray-500/30 hover:${tokenData.border}`
                          } ${
                            !isConnected ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="p-3 rounded-lg bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30">
                              <tokenData.icon
                                className={`h-6 w-6 ${tokenData.color}`}
                              />
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-white text-lg">
                                {tokenData.name}
                              </div>
                              {isConnected && (
                                <div className="text-sm text-gray-400">
                                  Balance:{" "}
                                  {balanceLoading ? (
                                    <span className="inline-block w-16 h-4 bg-gradient-to-r from-gray-600/20 to-gray-500/20 rounded animate-pulse"></span>
                                  ) : (
                                    <span
                                      className={`font-mono ${
                                        hasBalance
                                          ? "text-blue-300"
                                          : "text-red-300"
                                      }`}
                                    >
                                      {balance.toFixed(6)}
                                    </span>
                                  )}
                                </div>
                              )}
                              {isConnected &&
                                needsTokenApproval &&
                                hasBalance && (
                                  <div className="text-xs text-yellow-300 flex items-center mt-1">
                                    <FiAlertTriangle className="h-3 w-3 mr-1" />
                                    Approval required
                                  </div>
                                )}
                            </div>
                          </div>
                          <div className="text-right">
                            {isConnected && !hasBalance && !balanceLoading && (
                              <div className="text-xs text-red-300 mt-1">
                                Insufficient balance
                              </div>
                            )}
                            {selectedToken === tokenData.token && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center mt-1"
                              >
                                <FiCheckCircle className="h-5 w-5 text-blue-400" />
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="p-6 rounded-xl border mb-6"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)",
                      borderColor: "rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    <div className="flex items-center space-x-3 mb-2">
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

                {/* Payment Note */}
                {isConnected && (
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-purple-300 mb-3 flex items-center space-x-2">
                      <FiLock className="h-4 w-4" />
                      <span>Payment Note (Optional)</span>
                    </label>
                    <textarea
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      rows={3}
                      disabled={paymentProcessing}
                      className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300 disabled:opacity-50 resize-none"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                        borderColor: "rgba(139, 92, 246, 0.2)",
                      }}
                      placeholder="Add a note for this payment..."
                    />
                  </div>
                )}

                {/* Payment Summary */}
                {isConnected && selectedTokenData && (
                  <div
                    className="mb-6 p-4 rounded-xl backdrop-blur-sm border"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 50%, rgba(59, 130, 246, 0.1) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.2)",
                    }}
                  >
                    <h4 className="font-bold text-white mb-3 flex items-center space-x-2">
                      <FiDollarSign className="h-4 w-4 text-blue-400" />
                      <span>Payment Summary</span>
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Your Balance:</span>
                        <span
                          className={`font-bold ${
                            hasEnoughBalance(selectedTokenData)
                              ? "text-blue-300"
                              : "text-red-300"
                          }`}
                        >
                          {getTokenBalance(selectedTokenData.name).toFixed(6)}{" "}
                          {selectedTokenData.name}
                        </span>
                      </div>
                      {!hasEnoughBalance(selectedTokenData) &&
                        !balanceLoading && (
                          <div
                            className="text-xs text-red-300 mt-3 p-3 rounded-lg border"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)",
                              borderColor: "rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            ⚠️ Insufficient balance. You need{" "}
                            {selectedTokenData.price} {selectedTokenData.name}{" "}
                            but only have{" "}
                            {getTokenBalance(selectedTokenData.name).toFixed(6)}{" "}
                            {selectedTokenData.name}.
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {!isConnected ? (
                  <div className="text-center py-8">
                    <div className="relative inline-block mb-6">
                      <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full blur-xl"></div>
                      <div className="relative p-6 rounded-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30">
                        <FiCreditCard className="h-12 w-12 text-blue-300 mx-auto" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Connect Your Wallet
                    </h3>
                    <p className="text-gray-400 mb-6 max-w-sm mx-auto">
                      Please connect your wallet to make a secure cryptocurrency
                      payment
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                    >
                      <ConnectButton />
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePayment}
                    disabled={
                      paymentProcessing ||
                      !hasEnoughBalance(selectedTokenData) ||
                      !configurationValid ||
                      balanceLoading
                    }
                    className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold text-lg shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  >
                    {/* Button glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                    {/* Button shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                    <div className="relative">
                      {paymentProcessing ? (
                        <div className="flex items-center justify-center space-x-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          />
                          <span>Processing Payment...</span>
                        </div>
                      ) : balanceLoading ? (
                        <div className="flex items-center justify-center space-x-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          />
                          <span>Loading Balances...</span>
                        </div>
                      ) : selectedTokenData &&
                        !hasEnoughBalance(selectedTokenData) ? (
                        "Insufficient Balance"
                      ) : selectedTokenData &&
                        selectedTokenData.name !== "POL" &&
                        needsApproval(selectedTokenData) ? (
                        "Approve & Pay"
                      ) : (
                        "Complete Payment"
                      )}
                    </div>
                  </motion.button>
                )}
                
                {/* Fiat Checkout Option */}
                {product && (
                  <div className="mt-4">
                    <OnRampButton product={product} />
                  </div>
                )}

                {/* Security Notice */}
                <div
                  className="mt-6 p-4 rounded-xl backdrop-blur-sm border"
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
                    <div className="text-sm">
                      <p className="font-bold text-blue-300 mb-1">
                        Secure Blockchain Payment
                      </p>
                      <p className="text-blue-200 leading-relaxed">
                        Your payment is processed securely on the blockchain
                        with end-to-end encryption.
                        {selectedTokenData &&
                          selectedTokenData.name !== "POL" &&
                          needsApproval(selectedTokenData) &&
                          " Two transactions will be required: token approval and payment."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ShareablePaymentPage;
