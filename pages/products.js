import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiPlus,
  FiEdit,
  FiPause,
  FiPlay,
  FiTrash2,
  FiEye,
  FiExternalLink,
  FiShoppingBag,
  FiShare2,
  FiCopy,
  FiLink,
  FiSearch,
  FiFilter,
  FiDollarSign,
  FiTrendingUp,
  FiPackage,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import { contractService } from "../services/contract";
import { pinataService } from "../services/pinata";
import { PRODUCT_STATUS_NAMES } from "../lib/constants";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";
const PINATA_URL = process.env.NEXT_PUBLIC_PINATA_GATEWAY?.endsWith("/") ? process.env.NEXT_PUBLIC_PINATA_GATEWAY : (process.env.NEXT_PUBLIC_PINATA_GATEWAY ? process.env.NEXT_PUBLIC_PINATA_GATEWAY + "/" : "https://gateway.pinata.cloud/ipfs/");
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const NATIVE_TOKEN_LABEL = process.env.NEXT_PUBLIC_NETWORK === "polygon" ? "POL" : "ETH";

async function uploadProductMetadata(metadata) {
  const token = localStorage.getItem("cropcoin_token");
  if (!token) throw new Error("Authenticate your wallet before uploading product data");
  const response = await fetch(`${BACKEND_URL}/uploads/metadata`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ipfsHash) {
    throw new Error(result.error || "Product metadata upload failed");
  }
  return result.ipfsHash;
}

const generateBatchCode = () => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AGRI-${timestamp}-${randomStr}`;
};

const Products = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const CONTRACT_ABI = ABI.abi;

  useEffect(() => {
    if (isConnected && address) {
      loadProducts();
    }
  }, [isConnected, address]);
  //
  const loadProducts = async () => {
    try {
      setLoading(true);
      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);
      const result = await contractService.getMerchantProducts(
        contract,
        address
      );

      if (result.success) {
        const productsWithImages = await Promise.all(
          result.data.map(async (product) => {
            if (product.ipfsHash) {
              try {
                const metadata = await pinataService.fetchFromIPFS(product.ipfsHash);
                if (metadata) {
                  // Reconstruct proper image path just in case IPFS protocols are passed directly
                  let resolvedImage = metadata.image;
                  if (resolvedImage && resolvedImage.startsWith("ipfs://")) {
                    resolvedImage = resolvedImage.replace("ipfs://", PINATA_URL);
                  } else if (resolvedImage && !resolvedImage.startsWith("http")) {
                     resolvedImage = PINATA_URL + resolvedImage;
                  }
                  
                  // Fallback for older products created before the batchCode feature
                  const fallbackBatch = `AGRI-${Date.now() - (product.id * 100000)}-O${Math.abs(product.id || 0).toString(16).toUpperCase()}`;
                  return { 
                    ...product, 
                    image: resolvedImage || null,
                    batchCode: metadata.batchCode || fallbackBatch,
                    weight: metadata.weight || ""
                  };
                }
              } catch (e) {
                console.error("Failed to fetch product metadata for", product.id, e);
              }
            }
            return product;
          })
        );
        setProducts(productsWithImages);
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

  const handleCreateProduct = async (productData) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );

      const batchCode = generateBatchCode();

      // Upload metadata to IPFS if provided
      let ipfsHash = "";
      if (true) {
        const metadata = {
          name: productData.name,
          description: productData.description,
          weight: productData.weight,
          image: productData.image,
          batchCode: batchCode,
          ...productData.metadata,
        };

        ipfsHash = await uploadProductMetadata(metadata);
      }

      const result = await contractService.createProduct(
        contract,
        productData.name,
        productData.description,
        ipfsHash,
        productData.priceETH || 0,
        0,
        0
      );

      if (result.success) {
        toast.success("Product created successfully!");
        setShowCreateModal(false);
        await loadProducts();
      } else {
        toast.error(result.error || "Failed to create product");
      }
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error(error.message || "Failed to create product");
    }
  };

  const handleUpdateProduct = async (productId, productData) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      // Check if trying to edit without an ID
      if (!productId && productId !== 0) {
        toast.error("Invalid product. Cannot update.");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );

      // Re-upload metadata to IPFS to reflect updates
      let ipfsHash = "";
      
      const newMetadata = {
        name: productData.name,
        description: productData.description,
        weight: productData.weight,
        // Carry forward the new or existing image
        image: productData.image || (selectedProduct ? selectedProduct.image : null),
        // Preserve original batch code, else make one up
        batchCode: (selectedProduct && selectedProduct.batchCode) ? selectedProduct.batchCode : generateBatchCode(),
        ...productData.metadata,
      };

      ipfsHash = await uploadProductMetadata(newMetadata);

      const result = await contractService.updateProduct(
        contract,
        productId,
        productData.name,
        productData.description,
        ipfsHash,
        productData.priceETH || 0,
        0,
        0
      );

      if (result.success) {
        toast.success("Product updated successfully!");
        setShowEditModal(false);
        setSelectedProduct(null);
        await loadProducts();
      } else {
        toast.error(result.error || "Failed to update product");
      }
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error(error.message || "Failed to update product");
    }
  };

  const handlePauseProduct = async (productId) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.pauseProduct(contract, productId);

      if (result.success) {
        toast.success("Product paused successfully!");
        await loadProducts();
      } else {
        toast.error(result.error || "Failed to pause product");
      }
    } catch (error) {
      console.error("Error pausing product:", error);
      toast.error("Failed to pause product");
    }
  };

  const handleResumeProduct = async (productId) => {
    try {
      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.resumeProduct(contract, productId);

      if (result.success) {
        toast.success("Product resumed successfully!");
        await loadProducts();
      } else {
        toast.error(result.error || "Failed to resume product");
      }
    } catch (error) {
      console.error("Error resuming product:", error);
      toast.error("Failed to resume product");
    }
  };

  const generatePaymentLink = (productId) => {
    return `${window.location.origin}/pay/${productId}`;
  };

  const copyPaymentLink = (productId, productName) => {
    const link = generatePaymentLink(productId);
    navigator.clipboard
      .writeText(link)
      .then(() => {
        toast.success(`Payment link for "${productName}" copied to clipboard!`);
      })
      .catch(() => {
        toast.error("Failed to copy payment link");
      });
  };

  const sharePaymentLink = (product) => {
    const link = generatePaymentLink(product.id);
    if (navigator.share) {
      navigator
        .share({
          title: `Pay for ${product.name}`,
          text: `Complete your payment for ${product.name}`,
          url: link,
        })
        .catch(() => {
          copyPaymentLink(product.id, product.name);
        });
    } else {
      copyPaymentLink(product.id, product.name);
    }
  };

  const openShareModal = (product) => {
    setSelectedProduct(product);
    setShowShareModal(true);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.batchCode && product.batchCode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter =
      filterStatus === "all" ||
      PRODUCT_STATUS_NAMES[product.status].toLowerCase() === filterStatus;

    return matchesSearch && matchesFilter;
  });

  // Get status configuration for styling
  const getStatusConfig = (status) => {
    const configs = {
      0: {
        // Active
        bg: "from-blue-600/20 to-indigo-600/20",
        border: "border-blue-500/30",
        text: "text-blue-300",
        glow: "shadow-blue-500/20",
      },
      1: {
        // Deactivated
        bg: "from-red-600/20 to-indigo-600/20",
        border: "border-red-500/30",
        text: "text-red-300",
        glow: "shadow-red-500/20",
      },
      2: {
        // Paused
        bg: "from-yellow-600/20 to-orange-600/20",
        border: "border-yellow-500/30",
        text: "text-yellow-300",
        glow: "shadow-yellow-500/20",
      },
    };
    return configs[status] || configs[0];
  };

  return (
    <Layout title="Products">
      <div className="space-y-8">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
              <FiShoppingBag className="h-8 w-8 text-purple-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Products
              </h1>
              <p className="text-gray-400 mt-1">
                Manage your product catalog and share payment links
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="group relative overflow-hidden rounded-2xl px-6 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-semibold shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

            {/* Button shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

            <div className="relative flex items-center space-x-2">
              <FiPlus className="h-5 w-5" />
              <span>Create Product</span>
            </div>
          </motion.button>
        </motion.div>

        {/* Enhanced Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
        >
          <div className="flex-1 relative group">
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
          </div>

          <div className="relative">
            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-10 pr-8 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent appearance-none cursor-pointer"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
                borderColor: "rgba(59, 130, 246, 0.2)",
              }}
            >
              <option value="all" className="bg-gray-800">
                All Status
              </option>
              <option value="active" className="bg-gray-800">
                Active
              </option>
              <option value="paused" className="bg-gray-800">
                Paused
              </option>
              <option value="deactivated" className="bg-gray-800">
                Deactivated
              </option>
            </select>
          </div>
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
                {/* Loading skeleton with gradients */}
                <div className="space-y-4">
                  <div className="h-6 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-lg animate-pulse"></div>
                  <div className="h-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg animate-pulse"></div>
                  <div className="h-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-lg w-2/3 animate-pulse"></div>
                  <div className="h-10 bg-gradient-to-r from-gray-600/20 to-gray-500/20 rounded-lg animate-pulse"></div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
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

                  <div className="relative z-10 p-6">
                    <div className="mb-4 aspect-video rounded-xl overflow-hidden border border-purple-500/20 bg-gray-800 flex items-center justify-center">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <FiPackage className="h-12 w-12 text-gray-500" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white truncate group-hover:text-purple-200 transition-colors">
                        {product.name}
                      </h3>
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-full backdrop-blur-sm border ${
                          getStatusConfig(product.status).border
                        } ${getStatusConfig(product.status).text}`}
                        style={{
                          background: `linear-gradient(135deg, ${
                            getStatusConfig(product.status).bg
                          })`,
                        }}
                      >
                        {PRODUCT_STATUS_NAMES[product.status]}
                      </motion.span>
                    </div>

                    <p className="text-gray-400 text-sm mb-4 line-clamp-2 group-hover:text-gray-300 transition-colors">
                      {product.description}
                    </p>
                    {product.weight && (
                      <p className="text-indigo-300 font-semibold text-sm mb-4">
                        Weight: {product.weight}
                      </p>
                    )}

                    {/* Batch Code Display */}
                    {product.batchCode && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-900/20 border border-indigo-500/20 mb-4">
                        <div className="flex items-center space-x-3">
                          <FiPackage className="h-5 w-5 text-indigo-400" />
                          <span className="font-mono text-indigo-300 font-medium tracking-wider text-xs">
                            {product.batchCode}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(product.batchCode);
                            toast.success("Batch code copied!");
                          }}
                          className="p-2 hover:bg-indigo-500/20 rounded-lg transition-colors"
                          title="Copy Batch Code"
                        >
                          <FiCopy className="h-4 w-4 text-indigo-400" />
                        </button>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex justify-between text-sm mb-4 p-3 rounded-lg bg-gradient-to-r from-gray-600/10 to-gray-500/10 border border-gray-500/20">
                      <div className="flex items-center space-x-2">
                        <FiTrendingUp className="h-4 w-4 text-blue-400" />
                        <span className="text-gray-400">Sales: </span>
                        <span className="font-bold text-blue-300">
                          {product.totalSales}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {/* Edit Button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowEditModal(true);
                        }}
                        className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-gray-500/30 text-gray-300 hover:text-white hover:border-purple-500/50 hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-indigo-600/20"
                      >
                        <FiEdit className="h-4 w-4 mr-2" />
                        Edit
                      </motion.button>

                      {/* Pause/Resume Button */}
                      {product.status === 0 ? (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handlePauseProduct(product.id)}
                          className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-yellow-500/30 text-yellow-300 hover:text-white hover:bg-gradient-to-r hover:from-yellow-600/20 hover:to-orange-600/20"
                          title="Pause Product"
                        >
                          <FiPause className="h-4 w-4" />
                        </motion.button>
                      ) : product.status === 2 ? (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleResumeProduct(product.id)}
                          className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-blue-500/30 text-blue-300 hover:text-white hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-indigo-600/20"
                          title="Resume Product"
                        >
                          <FiPlay className="h-4 w-4" />
                        </motion.button>
                      ) : null}

                      {/* Share Payment Link Button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openShareModal(product)}
                        className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-blue-500/30 text-blue-300 hover:text-white hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20"
                        title="Share Payment Link"
                      >
                        <FiShare2 className="h-4 w-4" />
                      </motion.button>

                      {/*/ View Metadata Button */}
                      {product.ipfsHash && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            window.open(
                              `${PINATA_URL}${product.ipfsHash}`,
                              "_blank"
                            )
                          }
                          className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-gradient-to-r hover:from-indigo-600/20 hover:to-purple-600/20"
                          title="View Metadata"
                        >
                          <FiExternalLink className="h-4 w-4" />
                        </motion.button>
                      )}
                    </div>

                    {/* Quick Share Actions */}
                    <div className="pt-4 border-t border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">
                          Payment Link:
                        </span>
                        <div className="flex space-x-3">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() =>
                              copyPaymentLink(product.id, product.name)
                            }
                            className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300"
                            title="Copy Payment Link"
                          >
                            <FiCopy className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => sharePaymentLink(product)}
                            className="p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300"
                            title="Share Payment Link"
                          >
                            <FiShare2 className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() =>
                              window.open(
                                generatePaymentLink(product.id),
                                "_blank"
                              )
                            }
                            className="p-2 rounded-lg bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-300 hover:text-white transition-all duration-300"
                            title="Open Payment Page"
                          >
                            <FiExternalLink className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
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
              <div className="relative p-6 rounded-full bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/30">
                <FiPackage className="h-16 w-16 text-purple-300 mx-auto" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mt-6 mb-2">
              No products found
            </h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              {searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filter criteria to find products"
                : "Create your first product to start accepting crypto payments"}
            </p>
            {!searchTerm && filterStatus === "all" && (
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-semibold shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
              >
                <FiPlus className="h-5 w-5 mr-2" />
                Create Product
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Create Product Modal */}
        <ProductModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateProduct}
          title="Create New Product"
          mode="create"
        />

        {/* Edit Product Modal */}
        <ProductModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
          onSubmit={(data) => handleUpdateProduct(selectedProduct?.id, data)}
          title="Edit Product"
          mode="edit"
          initialData={selectedProduct}
        />

        {/* Share Modal */}
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          paymentLink={
            selectedProduct ? generatePaymentLink(selectedProduct.id) : ""
          }
        />
      </div>
    </Layout>
  );
};

// Enhanced Share Modal Component
const ShareModal = ({ isOpen, onClose, product, paymentLink }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(paymentLink)
      .then(() => {
        setCopied(true);
        toast.success("Payment link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast.error("Failed to copy link");
      });
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Pay for ${product?.name}`,
          text: `Complete your payment for ${product?.name}`,
          url: paymentLink,
        })
        .catch(() => {
          copyToClipboard();
        });
    } else {
      copyToClipboard();
    }
  };

  const openInNewTab = () => {
    window.open(paymentLink, "_blank");
  };

  if (!isOpen || !product) return null;

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
            className="relative inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl"
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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                    <FiShare2 className="h-6 w-6 text-purple-300" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    Share Payment Link
                  </h3>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
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
                  <FiPackage className="h-4 w-4 text-purple-300" />
                  <span>{product.name}</span>
                </h4>
                <p className="text-sm text-gray-300 line-clamp-2 mb-3">
                  {product.description}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {product.batchCode && (
                    <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-cyan-600/20 to-indigo-600/20 border border-cyan-500/30 text-cyan-300 font-mono font-semibold">
                      Batch: {product.batchCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Payment Link */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-purple-300 mb-2 flex items-center space-x-2">
                  <FiLink className="h-4 w-4" />
                  <span>Payment Link</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={paymentLink}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-xl text-sm backdrop-blur-sm border font-mono text-gray-300 focus:outline-none"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.2)",
                    }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={copyToClipboard}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                      copied
                        ? "bg-gradient-to-r from-blue-600/30 to-indigo-600/30 text-blue-300 border-blue-500/30"
                        : "bg-gradient-to-r from-gray-600/20 to-gray-500/20 text-gray-300 border-gray-500/30 hover:from-purple-600/30 hover:to-indigo-600/30 hover:text-white"
                    } border backdrop-blur-sm`}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </motion.button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 mb-6">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={shareLink}
                  className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
                >
                  <FiShare2 className="h-5 w-5 mr-2" />
                  Share Link
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={openInNewTab}
                  className="w-full flex items-center justify-center px-4 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                  style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
                >
                  <FiExternalLink className="h-5 w-5 mr-2" />
                  Open Payment Page
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={copyToClipboard}
                  className="w-full flex items-center justify-center px-4 py-3 rounded-xl backdrop-blur-sm border text-blue-300 hover:text-white transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20"
                  style={{ borderColor: "rgba(59, 130, 246, 0.3)" }}
                >
                  <FiCopy className="h-5 w-5 mr-2" />
                  Copy to Clipboard
                </motion.button>
              </div>

              {/* Usage Instructions */}
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
                    <FiLink className="h-4 w-4 text-blue-300" />
                  </div>
                  <div className="text-xs text-blue-200">
                    <p className="font-bold mb-2">
                      How to use this payment link:
                    </p>
                    <ul className="space-y-1 text-gray-300">
                      <li className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                        <span>
                          Share this link with customers via any channel
                        </span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                        <span>
                          Customers can pay without creating an account
                        </span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                        <span>
                          Payments are processed securely on blockchain
                        </span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                        <span>
                          You'll receive notifications when payments complete
                        </span>
                      </li>
                    </ul>
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

// Enhanced Product Modal Component
const ProductModal = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  mode,
  initialData = null,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    weight: "",
    priceETH: "",
    image: null,
    metadata: {},
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (initialData && mode === "edit") {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        weight: initialData.weight || "",
        priceETH: initialData.priceETH || "",
        image: null,
        metadata: {},
      });
    } else {
      setFormData({
        name: "",
        description: "",
        weight: "",
        priceETH: "",
        image: null,
        metadata: {},
      });
    }
  }, [initialData, mode, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (!formData.priceETH || Number(formData.priceETH) <= 0) {
      toast.error(`Enter a valid ${NATIVE_TOKEN_LABEL} price`);
      return;
    }

    setUploading(true);
    await onSubmit(formData);
    setUploading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const token = localStorage.getItem("cropcoin_token");
      if (!token) throw new Error("Authenticate your wallet before uploading product images");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${BACKEND_URL}/uploads/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const uploadResult = await response.json().catch(() => ({}));
      if (!response.ok || !uploadResult.ipfsHash) {
        throw new Error(uploadResult.error || "Image upload failed");
      }

      setFormData((prev) => ({
        ...prev,
        image: `${PINATA_URL}${uploadResult.ipfsHash}`,
      }));
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
                    <FiPackage className="h-6 w-6 text-purple-300" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                    {title}
                  </h3>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </motion.button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-purple-300 mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.2)",
                    }}
                    placeholder="Enter product name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-purple-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300 resize-none"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.2)",
                    }}
                    placeholder="Enter product description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-purple-300 mb-2">
                    Weight (e.g. 50 kg)
                  </label>
                  <input
                    type="text"
                    value={formData.weight}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, weight: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.2)",
                    }}
                    placeholder="Enter crop weight"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-blue-300 mb-2">
                      {NATIVE_TOKEN_LABEL} Price
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.priceETH}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          priceETH: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-300"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
                        borderColor: "rgba(59, 130, 246, 0.2)",
                      }}
                      placeholder="0.00"
                    />
                  </div>

                </div>

                <p className="text-xs text-gray-400">
                  Set the purchase price in {NATIVE_TOKEN_LABEL}. You only need POL for Polygon transaction fees.
                </p>

                  <div>
                  <label className="block text-sm font-bold text-indigo-300 mb-2">
                    Product Image
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-indigo-600/20 file:to-purple-600/20 file:text-indigo-300 hover:file:from-indigo-600/30 hover:file:to-purple-600/30 file:transition-all file:duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all duration-300"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                      borderColor: "rgba(236, 72, 153, 0.2)",
                    }}
                  />
                  {formData.image && (
                    <div className="mt-3">
                      <img
                        src={formData.image}
                        alt="Product preview"
                        className="w-20 h-20 object-cover rounded-xl border border-indigo-500/30 shadow-lg"
                      />
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 pt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-3 rounded-xl backdrop-blur-sm border text-gray-300 hover:text-white transition-all duration-300 font-semibold hover:bg-gradient-to-r hover:from-gray-600/20 hover:to-gray-500/20"
                    style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading
                      ? "Processing..."
                      : mode === "create"
                      ? "Create Product"
                      : "Update Product"}
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Products;
