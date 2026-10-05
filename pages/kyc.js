import { useState, useEffect, useCallback, createElement } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiUpload,
  FiCheck,
  FiX,
  FiClock,
  FiFileText,
  FiUser,
  FiShield,
  FiEye,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiLock,
  FiUserCheck,
  FiCalendar,
  FiDownload,
  FiMaximize2,
  FiMinimize2,
  FiFile,
  FiExternalLink,
  FiHash,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import Layout from "../components/Layout";
import DocScanner from "../components/DocScanner";
import { contractService } from "../services/contract";
import { pinataService } from "../services/pinata";
import {
  KYC_STATUS,
  KYC_STATUS_NAMES,
  CONTRACT_ADDRESSES,
  getContractAddresses,
  isAdminAddress,
} from "../lib/constants";
import { isValidAadhaar, generateAadhaarProofHash, formatAadhaar } from "../lib/aadhaar";
import toast from "react-hot-toast";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";

const PINATA_URL = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
const LOCALHOST_CHAIN_ID = 1337;
const POLYGON_CHAIN_ID = 137;
const LOCALHOST_CHAIN_HEX = "0x539";
const CONTRACT_ABI = ABI.abi;

// Document Viewer Modal Component
const DocumentViewerModal = ({ isOpen, onClose, documents, userAddress }) => {
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedDocument = documents?.[selectedDocumentIndex];

  const getDocumentTypeLabel = (type) => {
    const labels = {
      identity: "Identity Document",
      address: "Address Proof",
      business: "Business Document",
      bank: "Bank Statement",
    };
    return labels[type] || "Document";
  };

  const getDocumentTypeIcon = (type) => {
    switch (type) {
      case "identity":
        return FiUser;
      case "address":
        return FiFileText;
      case "business":
        return FiShield;
      case "bank":
        return FiFile;
      default:
        return FiFileText;
    }
  };

  const getDocumentTypeColor = (type) => {
    const colors = {
      identity: "from-blue-600/20 to-blue-600/20 border-blue-500/30",
      address: "from-blue-600/20 to-indigo-600/20 border-blue-500/30",
      business: "from-purple-600/20 to-purple-600/20 border-purple-500/30",
      bank: "from-orange-600/20 to-amber-600/20 border-orange-500/30",
    };
    return colors[type] || "from-gray-600/20 to-gray-500/20 border-gray-500/30";
  };

  const isImageFile = (filename) => {
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".svg",
      ".webp",
      ".jpe",
    ];
    return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
  };

  const isPdfFile = (filename) => {
    return filename.toLowerCase().endsWith(".pdf");
  };

  const downloadDocument = (document) => {
    // Try multiple gateways for download
    const gateways = [
      `${PINATA_URL}${document.ipfsHash}`,
      `https://ipfs.io/ipfs/${document.ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${document.ipfsHash}`,
      `https://dweb.link/ipfs/${document.ipfsHash}`,
    ];

    const link = document.createElement("a");
    link.href = gateways[0]; // Start with first gateway
    link.download = document.filename;

    // If first gateway fails, try others
    link.onerror = () => {
      for (let i = 1; i < gateways.length; i++) {
        const fallbackLink = document.createElement("a");
        fallbackLink.href = gateways[i];
        fallbackLink.download = document.filename;
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
        break;
      }
    };

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download started!");
  };

  const openInNewTab = (document) => {
    // Try multiple gateways
    const gateways = [
      `${PINATA_URL}${document.ipfsHash}`,
      `https://ipfs.io/ipfs/${document.ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${document.ipfsHash}`,
      `https://dweb.link/ipfs/${document.ipfsHash}`,
    ];

    // Open first available gateway
    window.open(gateways[0], "_blank");
  };

  const getDocumentUrl = (document) => {
    // Return the first available gateway URL
    const gateways = [
      `${PINATA_URL}${document.ipfsHash}`,
      `https://ipfs.io/ipfs/${document.ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${document.ipfsHash}`,
      `https://dweb.link/ipfs/${document.ipfsHash}`,
    ];
    return gateways[0];
  };

  if (!isOpen || !documents?.length) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-hidden"
      >
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative inline-block w-full text-left align-middle transition-all transform rounded-2xl backdrop-blur-xl border shadow-2xl overflow-hidden ${
              isFullscreen
                ? "max-w-none h-screen m-0 rounded-none"
                : "max-w-6xl max-h-[90vh] my-8"
            }`}
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.95) 0%, rgba(26, 22, 37, 0.95) 50%, rgba(15, 11, 19, 0.95) 100%)",
              borderColor: "rgba(59, 130, 246, 0.3)",
              boxShadow: "0 25px 50px rgba(59, 130, 246, 0.2)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-blue-500/20">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-600/20 border border-blue-500/30">
                  <FiEye className="h-6 w-6 text-blue-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-400 bg-clip-text text-transparent">
                    Document Viewer
                  </h3>
                  <p className="text-sm text-gray-400">
                    User: {userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 rounded-xl bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30 text-gray-300 hover:text-white transition-colors"
                >
                  {isFullscreen ? (
                    <FiMinimize2 className="w-5 h-5" />
                  ) : (
                    <FiMaximize2 className="w-5 h-5" />
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-xl bg-gradient-to-r from-gray-600/20 to-gray-500/20 border border-gray-500/30 text-gray-300 hover:text-white transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </motion.button>
              </div>
            </div>

            <div className="flex h-full">
              {/* Document List Sidebar */}
              <div className="w-80 border-r border-blue-500/20 p-4 space-y-3 overflow-y-auto">
                <h4 className="text-sm font-bold text-blue-300 mb-4">
                  Documents ({documents.length})
                </h4>
                {documents.map((doc, index) => {
                  const IconComponent = getDocumentTypeIcon(doc.type);
                  return (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedDocumentIndex(index)}
                      className={`w-full p-4 rounded-xl text-left transition-all duration-300 ${
                        selectedDocumentIndex === index
                          ? "bg-gradient-to-r from-blue-600/20 to-blue-600/20 border border-blue-500/50"
                          : "bg-gradient-to-r from-gray-600/10 to-gray-500/10 border border-gray-500/20 hover:border-blue-500/30"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-2 rounded-lg bg-gradient-to-r ${getDocumentTypeColor(
                            doc.type
                          )}`}
                        >
                          <IconComponent className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">
                            {getDocumentTypeLabel(doc.type)}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {doc.filename}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Document Viewer */}
              <div className="flex-1 flex flex-col">
                {selectedDocument && (
                  <>
                    {/* Document Header */}
                    <div className="p-4 border-b border-blue-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-lg font-bold text-white">
                            {getDocumentTypeLabel(selectedDocument.type)}
                          </h5>
                          <p className="text-sm text-gray-400">
                            {selectedDocument.filename}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => downloadDocument(selectedDocument)}
                            className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors text-sm font-medium"
                          >
                            <FiDownload className="h-4 w-4 mr-2" />
                            Download
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openInNewTab(selectedDocument)}
                            className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-colors text-sm font-medium"
                          >
                            <FiExternalLink className="h-4 w-4 mr-2" />
                            Open
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    {/* Document Content */}
                    <div className="flex-1 p-4 overflow-auto">
                      <div className="h-full rounded-xl bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-gray-700/50 overflow-hidden">
                        {isImageFile(selectedDocument.filename) ? (
                          <div className="h-full flex items-center justify-center p-4">
                            <img
                              src={getDocumentUrl(selectedDocument)}
                              alt={selectedDocument.filename}
                              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                              onError={(e) => {
                                // Try fallback gateways on error
                                const gateways = [
                                  `https://ipfs.io/ipfs/${selectedDocument.ipfsHash}`,
                                  `https://cloudflare-ipfs.com/ipfs/${selectedDocument.ipfsHash}`,
                                  `https://dweb.link/ipfs/${selectedDocument.ipfsHash}`,
                                ];

                                const currentSrc = e.target.src;
                                const currentIndex = gateways.findIndex(
                                  (gateway) =>
                                    currentSrc.includes(
                                      gateway.split("/ipfs/")[1]
                                    )
                                );

                                if (currentIndex < gateways.length - 1) {
                                  e.target.src = gateways[currentIndex + 1];
                                } else {
                                  e.target.style.display = "none";
                                  e.target.nextElementSibling.style.display =
                                    "flex";
                                }
                              }}
                            />
                            <div className="hidden items-center justify-center h-full text-gray-400">
                              <div className="text-center">
                                <FiFileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <p>Unable to load image</p>
                                <p className="text-sm mt-2">
                                  Try downloading or opening in new tab
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : isPdfFile(selectedDocument.filename) ? (
                          <iframe
                            src={getDocumentUrl(selectedDocument)}
                            className="w-full h-full border-none"
                            title={selectedDocument.filename}
                            onError={() => {
                              toast.error(
                                "PDF preview unavailable. Please download or open in new tab."
                              );
                            }}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-400">
                            <div className="text-center">
                              <FiFileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                              <p className="text-lg font-semibold mb-2">
                                Preview not available
                              </p>
                              <p className="text-sm mb-4">
                                This file type cannot be previewed in the
                                browser
                              </p>
                              <div className="space-x-3">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    downloadDocument(selectedDocument)
                                  }
                                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium"
                                >
                                  <FiDownload className="h-4 w-4 mr-2" />
                                  Download File
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => openInNewTab(selectedDocument)}
                                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-600 text-white font-medium"
                                >
                                  <FiExternalLink className="h-4 w-4 mr-2" />
                                  Open in New Tab
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const KYCManagement = () => {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const isSupportedNetwork = [LOCALHOST_CHAIN_ID, POLYGON_CHAIN_ID].includes(
    Number(chainId)
  );

  const [kycData, setKycData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [allKycUsers, setAllKycUsers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [switchingToLocalhost, setSwitchingToLocalhost] = useState(false);

  // Document modal states
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState(null);
  const [selectedUserAddress, setSelectedUserAddress] = useState("");
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  const loadKYCData = useCallback(async () => {
    if (!isSupportedNetwork) return;

    try {
      setLoading(true);
      // Use the wallet's connected provider so we read from the same network the user is on
      let contract;
      if (typeof window !== "undefined" && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();
        const addresses = getContractAddresses(network.chainId);
        contract = new ethers.Contract(
          addresses.PAYMENT_GATEWAY,
          CONTRACT_ABI,
          provider
        );
      } else {
        contract = contractService.getReadOnlyContract(CONTRACT_ABI);
      }

      // Load current user's KYC data
      const result = await contractService.getKYCData(contract, address);
      if (result.success) {
        setKycData(result.data);
      }

      // Check if user is owner/reviewer
      try {
        let isUserAdmin = isAdminAddress(address);
        try {
          const owner = await contract.owner();
          if (owner && owner.toLowerCase() === address.toLowerCase()) {
            isUserAdmin = true;
          }
        } catch (e) {
          console.warn("Could not query contract owner:", e);
        }
        setIsOwner(isUserAdmin);

        if (isUserAdmin) {
          // Load all KYC users for review
          try {
            const kycUsers = await contract.getKYCUsers();
            const allUsers = [];

            for (const userAddr of kycUsers) {
              const userData = await contractService.getKYCData(
                contract,
                userAddr
              );
              if (userData.success) {
                // Fetch Aadhaar proof hash for this user
                try {
                  const aadhaarHash = await contract.aadhaarProofHash(userAddr);
                  userData.data.aadhaarProofHash = aadhaarHash;
                } catch (err) {
                  userData.data.aadhaarProofHash = ethers.constants.HashZero;
                }
                allUsers.push(userData.data);
              }
            }

            setAllKycUsers(allUsers);
          } catch (err) {
            console.warn("Could not load KYC users list:", err);
          }
        }
      } catch (error) {
        console.error("Error checking owner status:", error);
        if (isAdminAddress(address)) {
          setIsOwner(true);
        }
      }
    } catch (error) {
      console.error("Error loading KYC data:", error);
      toast.error("Failed to load KYC data");
    } finally {
      setLoading(false);
    }
  }, [address, isSupportedNetwork]);

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    if (!isSupportedNetwork) {
      setKycData(null);
      setAllKycUsers([]);
      setIsOwner(false);
      setLoading(false);
      return;
    }

    loadKYCData();
  }, [isConnected, address, isSupportedNetwork, loadKYCData]);

  const switchToLocalhost = async () => {
    if (!window.ethereum) {
      toast.error("MetaMask was not found");
      return;
    }

    setSwitchingToLocalhost(true);
    try {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: LOCALHOST_CHAIN_HEX }],
        });
      } catch (switchError) {
        if (switchError.code !== 4902) throw switchError;
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: LOCALHOST_CHAIN_HEX,
            chainName: "Localhost 8545",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["http://127.0.0.1:8545"],
          }],
        });
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: LOCALHOST_CHAIN_HEX }],
        });
      }
    } catch (error) {
      if (error.code !== 4001) {
        toast.error("Could not switch to Localhost 8545. Make sure the local blockchain is running.");
      }
    } finally {
      setSwitchingToLocalhost(false);
    }
  };

  // Handle viewing documents for any KYC submission
  const handleViewDocuments = async (kycData) => {
    if (!kycData.ipfsHash) {
      toast.error("No IPFS hash found for this submission");
      return;
    }

    setIsLoadingDocuments(true);
    try {
      // Try multiple IPFS gateways to avoid CORS and rate limiting issues
      const gateways = [
        `${PINATA_URL}${kycData.ipfsHash}`,
        `https://ipfs.io/ipfs/${kycData.ipfsHash}`,
        `https://cloudflare-ipfs.com/ipfs/${kycData.ipfsHash}`,
        `https://dweb.link/ipfs/${kycData.ipfsHash}`,
      ];

      let kycMetadata = null;
      let lastError = null;

      // Try each gateway until one works
      for (const gateway of gateways) {
        try {
          console.log(`Trying gateway: ${gateway}`);

          const response = await fetch(gateway, {
            method: "GET",
            headers: {
              Accept: "application/json,text/plain,*/*",
            },
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          if (response.ok) {
            const text = await response.text();
            kycMetadata = JSON.parse(text);
            console.log(`Successfully fetched from: ${gateway}`);
            break;
          } else {
            console.warn(
              `Gateway ${gateway} returned status: ${response.status}`
            );
            lastError = new Error(
              `HTTP ${response.status}: ${response.statusText}`
            );
          }
        } catch (error) {
          console.warn(`Gateway ${gateway} failed:`, error.message);
          lastError = error;
          continue;
        }
      }

      if (!kycMetadata) {
        throw lastError || new Error("All IPFS gateways failed");
      }

      if (kycMetadata.documents && kycMetadata.documents.length > 0) {
        setSelectedDocuments(kycMetadata.documents);
        setSelectedUserAddress(kycMetadata.userAddress || kycData.user);
        setShowDocumentModal(true);
      } else {
        toast.error("No documents found in this submission");
      }
    } catch (error) {
      console.error("Error fetching KYC data:", error);

      // Provide more specific error messages
      if (error.name === "TimeoutError") {
        toast.error("Request timed out. Please try again.");
      } else if (error.message.includes("CORS")) {
        toast.error(
          "Network access blocked. Please try again or contact support."
        );
      } else if (error.message.includes("429")) {
        toast.error("Too many requests. Please wait a moment and try again.");
      } else if (error.message.includes("Failed to fetch")) {
        toast.error(
          "Network error. Please check your connection and try again."
        );
      } else {
        toast.error("Failed to load documents. Please try again.");
      }
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleSubmitKYC = async (documents, aadhaarNumber, panNumber, fullName, dob, onProgress) => {
    try {
      if (!isSupportedNetwork) {
        toast.error("Switch MetaMask to Polygon PoS or Localhost 8545 to submit KYC");
        return false;
      }

      if (!walletClient) {
        toast.error("Please connect your wallet");
        return false;
      }

      const authToken = localStorage.getItem("cropcoin_token");
      if (!authToken) {
        toast.error("Authenticate your wallet before uploading KYC documents");
        return false;
      }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

      // ── 1. Validate Aadhaar ────────────────────────────────
      if (!aadhaarNumber) {
        toast.error("Please enter your Aadhaar number");
        return false;
      }
      const aadhaarValidation = isValidAadhaar(aadhaarNumber);
      if (!aadhaarValidation.valid) {
        toast.error(`Invalid Aadhaar: ${aadhaarValidation.error}`);
        return false;
      }

      const cleanedAadhaar = aadhaarNumber.replace(/[\s-]/g, "");
      const proofHash = generateAadhaarProofHash(cleanedAadhaar);
      console.log("🔒 Aadhaar proof hash generated:", proofHash);

      // ── 2. Upload documents to IPFS ────────────────────────
      onProgress?.(`Uploading ${documents.length} documents to IPFS...`);
      toast.loading(`Uploading ${documents.length} documents to IPFS in parallel...`, { id: "kyc-upload" });
      console.log("📤 Uploading documents to IPFS...");

      const documentData = {
        documents: [],
        submittedAt: new Date().toISOString(),
        userAddress: address,
        aadhaarProofHash: proofHash,
      };

      let completedUploads = 0;
      const uploadResults = [];
      for (const doc of documents) {
        onProgress?.(`Uploading ${completedUploads + 1} of ${documents.length}: ${doc.file.name}`);
        toast.loading(
          `Uploading ${completedUploads + 1} of ${documents.length}: ${doc.file.name}`,
          { id: "kyc-upload" }
        );
        const formData = new FormData();
        formData.append("file", doc.file);
        formData.append("documentType", doc.type);
        const response = await fetch(`${backendUrl}/kyc/documents`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: formData,
        });
        const body = await response.json().catch(() => ({}));
        completedUploads += 1;
        onProgress?.(`Uploaded ${completedUploads} of ${documents.length} documents...`);
        const result = response.ok && body.ipfsHash
          ? { success: true, ipfsHash: body.ipfsHash }
          : { success: false, error: body.error || "Document upload failed" };
        uploadResults.push({ doc, result });
        if (!result.success) {
          toast.dismiss("kyc-upload");
          toast.error(result.error || `Failed to upload ${doc.type}`);
          return false;
        }
      }

      documentData.documents = uploadResults.map(({ doc, result }) => ({
        type: doc.type,
        ipfsHash: result.ipfsHash,
        filename: `KYC-${doc.type}.${doc.file.name.split(".").pop()?.toLowerCase() || "file"}`,
      }));

      // Upload metadata
      onProgress?.("Saving KYC metadata to IPFS...");
      const metadataResponse = await fetch(`${backendUrl}/kyc/metadata`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(documentData),
      });
      const metadataBody = await metadataResponse.json().catch(() => ({}));
      const metadataResult = metadataResponse.ok && metadataBody.ipfsHash
        ? { success: true, ipfsHash: metadataBody.ipfsHash }
        : { success: false, error: metadataBody.error || "KYC metadata upload failed" };

      toast.dismiss("kyc-upload");

      if (!metadataResult.success) {
        toast.error("Failed to upload KYC metadata");
        return false;
      }
      console.log("✅ Metadata uploaded:", metadataResult.ipfsHash);

      // ── 3. Get the signer-connected contract ───────────────
      const contract = await contractService.getContractWithWagmi(walletClient, CONTRACT_ABI);

      // ── 4. Submit KYC on-chain (MetaMask opens here) ───────
      onProgress?.("Confirm KYC submission in MetaMask (transaction 1 of 2)...");
      toast.loading("Waiting for MetaMask — Transaction 1 of 2: Submit KYC...", { id: "kyc-tx1" });

      const kycResult = await contractService.submitKYC(contract, metadataResult.ipfsHash);

      toast.dismiss("kyc-tx1");

      if (!kycResult.success) {
        const msg = kycResult.error || "KYC submission failed";
        if (msg.includes("already pending")) {
          toast.error("KYC is already pending review");
        } else if (msg.includes("already approved")) {
          toast.error("KYC is already approved");
        } else if (msg.includes("user rejected")) {
          toast.error("Transaction was rejected in MetaMask");
        } else {
          toast.error("KYC submission failed: " + msg);
        }
        console.error("❌ KYC submission failed:", kycResult.error);
        return false;
      }

      console.log("✅ KYC tx sent:", kycResult.hash);
      onProgress?.("Waiting for the KYC transaction to confirm on-chain...");
      toast.loading("Confirming KYC transaction...", { id: "kyc-confirm1" });
      await kycResult.tx.wait();
      toast.dismiss("kyc-confirm1");
      toast.success("KYC submitted on-chain! ✅");

      // ── 5. Submit Aadhaar proof (MetaMask opens again) ─────
      onProgress?.("Confirm Aadhaar proof in MetaMask (transaction 2 of 2)...");
      toast.loading("Waiting for MetaMask — Transaction 2 of 2: Aadhaar proof...", { id: "kyc-tx2" });

      const aadhaarResult = await contractService.submitAadhaarProof(contract, proofHash);

      toast.dismiss("kyc-tx2");

      if (!aadhaarResult.success) {
        const msg = aadhaarResult.error || "";
        if (msg.includes("Aadhaar already used")) {
          // Not a hard error — proof already on chain
          toast("Aadhaar proof was already submitted.", { icon: "ℹ️" });
        } else if (msg.includes("user rejected")) {
          toast.error("Aadhaar proof transaction rejected — KYC is still pending");
        } else {
          toast.error("Aadhaar proof failed: " + msg);
          console.warn("⚠️ Aadhaar proof result:", aadhaarResult.error);
          return false;
        }
      } else {
        console.log("✅ Aadhaar proof tx sent:", aadhaarResult.hash);
        onProgress?.("Waiting for the Aadhaar proof transaction to confirm...");
        toast.loading("Confirming Aadhaar proof...", { id: "kyc-confirm2" });
        await aadhaarResult.tx.wait();
        toast.dismiss("kyc-confirm2");
        toast.success("Aadhaar proof recorded on-chain! ✅");
      }

      // ── 6. Close modal and reload on-chain KYC status ─────
      onProgress?.("Refreshing KYC status...");
      setShowSubmitModal(false);
      await loadKYCData();
      return true;

    } catch (error) {
      toast.dismiss();
      console.error("💥 Unexpected error in handleSubmitKYC:", error);
      toast.error("An unexpected error occurred: " + error.message);
      return false;
    }
  };


  const handleReviewKYC = async (
    userAddress,
    approved,
    rejectionReason = ""
  ) => {
    try {
      if (!isSupportedNetwork) {
        toast.error("Switch MetaMask to Polygon PoS or Localhost 8545 to review KYC");
        return;
      }

      if (!walletClient) {
        toast.error("Please connect your wallet");
        return;
      }

      const contract = await contractService.getContractWithWagmi(
        walletClient,
        CONTRACT_ABI
      );
      const result = await contractService.reviewKYC(
        contract,
        userAddress,
        approved,
        rejectionReason
      );

      if (result.success) {
        toast.success(
          `KYC ${approved ? "approved" : "rejected"} successfully!`
        );
        setShowReviewModal(false);
        await loadKYCData();
      } else {
        toast.error(result.error || "Failed to review KYC");
      }
    } catch (error) {
      console.error("Error reviewing KYC:", error);
      toast.error("Failed to review KYC");
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      [KYC_STATUS.Approved]: {
        icon: FiCheckCircle,
        color: "from-blue-500 to-indigo-500",
        bg: "from-blue-600/20 to-indigo-600/20",
        border: "border-blue-500/30",
        text: "text-blue-300",
      },
      [KYC_STATUS.Rejected]: {
        icon: FiXCircle,
        color: "from-red-500 to-indigo-500",
        bg: "from-red-600/20 to-indigo-600/20",
        border: "border-red-500/30",
        text: "text-red-300",
      },
      [KYC_STATUS.Pending]: {
        icon: FiClock,
        color: "from-yellow-500 to-orange-500",
        bg: "from-yellow-600/20 to-orange-600/20",
        border: "border-yellow-500/30",
        text: "text-yellow-300",
      },
      [KYC_STATUS.Cancelled]: {
        icon: FiX,
        color: "from-gray-500 to-gray-600",
        bg: "from-gray-600/20 to-gray-500/20",
        border: "border-gray-500/30",
        text: "text-gray-300",
      },
    };
    return (
      configs[status] || {
        icon: FiFileText,
        color: "from-gray-500 to-gray-600",
        bg: "from-gray-600/20 to-gray-500/20",
        border: "border-gray-500/30",
        text: "text-gray-300",
      }
    );
  };

  if (isConnected && !isSupportedNetwork) {
    return (
      <Layout title="KYC Management">
        <section className="mx-auto max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-6">
          <div className="flex items-start gap-4">
            <FiAlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-300" />
            <div>
              <h2 className="text-xl font-bold text-white">KYC is unavailable on this network</h2>
              <p className="mt-2 text-sm text-gray-300">
                Your wallet is on chain {chainId}. Switch to Polygon PoS (chain ID 137) or Localhost 8545 (chain ID 1337) to view or submit KYC.
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Start the local blockchain and deploy the payment gateway before continuing. KYC documents are still stored through the configured IPFS provider.
              </p>
              <button
                type="button"
                onClick={switchToLocalhost}
                disabled={switchingToLocalhost}
                className="mt-5 rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-300 disabled:opacity-50"
              >
                {switchingToLocalhost ? "Switching network..." : "Switch to Localhost 8545"}
              </button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  console.log(kycData);

  return (
    <Layout title="KYC Management">
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-4"
        >
          <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
            <FiShield className="h-8 w-8 text-blue-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              KYC Management
            </h1>
            <p className="text-gray-400 mt-1">
              Secure identity verification for blockchain commerce
            </p>
          </div>
        </motion.div>

        {/* User's KYC Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-600/10 to-transparent rounded-full blur-2xl"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                  <FiUserCheck className="h-6 w-6 text-blue-300" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Your KYC Status
                </h2>
              </div>
              {(!kycData ||
                kycData.status === KYC_STATUS.NotSubmitted ||
                kycData.status === KYC_STATUS.Rejected) && (
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSubmitModal(true)}
                  className="group relative overflow-hidden rounded-xl px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                >
                  {/* Button glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>

                  {/* Button shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                  <div className="relative flex items-center space-x-2">
                    <FiUpload className="h-5 w-5" />
                    <span>Submit KYC</span>
                  </div>
                </motion.button>
              )}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="h-6 rounded-lg animate-pulse"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                    }}
                  />
                ))}
              </div>
            ) : kycData && kycData.status !== KYC_STATUS.NotSubmitted ? (
              <div className="space-y-6">
                {/* Status Display */}
                <div className="flex items-center space-x-4">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-r ${
                      getStatusConfig(kycData.status).bg
                    } border ${getStatusConfig(kycData.status).border}`}
                  >
                    {createElement(getStatusConfig(kycData.status).icon, {
                      className: `h-6 w-6 ${
                        getStatusConfig(kycData.status).text
                      }`,
                    })}
                  </div>
                  <div>
                    <span
                      className={`px-4 py-2 rounded-xl text-sm font-bold backdrop-blur-sm border ${
                        getStatusConfig(kycData.status).border
                      } ${getStatusConfig(kycData.status).text}`}
                      style={{
                        background: `linear-gradient(135deg, ${
                          getStatusConfig(kycData.status).bg
                        })`,
                      }}
                    >
                      {KYC_STATUS_NAMES[kycData.status]}
                    </span>
                  </div>
                </div>

                {/* KYC Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20">
                    <div className="flex items-center space-x-2 mb-2">
                      <FiCalendar className="h-4 w-4 text-blue-300" />
                      <span className="text-sm font-medium text-blue-300">
                        Submitted
                      </span>
                    </div>
                    <span className="text-white font-bold">
                      {new Date(
                        parseInt(kycData.submittedAt) * 1000
                      ).toLocaleDateString()}
                    </span>
                  </div>

                  {kycData.reviewedAt !== "0" && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
                      <div className="flex items-center space-x-2 mb-2">
                        <FiCheck className="h-4 w-4 text-blue-300" />
                        <span className="text-sm font-medium text-blue-300">
                          Reviewed
                        </span>
                      </div>
                      <span className="text-white font-bold">
                        {new Date(
                          parseInt(kycData.reviewedAt) * 1000
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {kycData.reviewedBy !==
                    "0x0000000000000000000000000000000000000000" && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20">
                      <div className="flex items-center space-x-2 mb-2">
                        <FiUser className="h-4 w-4 text-purple-300" />
                        <span className="text-sm font-medium text-purple-300">
                          Reviewed by
                        </span>
                      </div>
                      <span className="text-white font-mono text-sm font-bold">
                        {kycData.reviewedBy.slice(0, 6)}...
                        {kycData.reviewedBy.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Rejection Reason */}
                {kycData.rejectionReason && (
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)",
                      borderColor: "rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <FiAlertTriangle className="h-4 w-4 text-red-300" />
                      <span className="text-sm font-bold text-red-300">
                        Rejection Reason
                      </span>
                    </div>
                    <p className="text-red-200">{kycData.rejectionReason}</p>
                  </div>
                )}

                {/* View Documents */}
                {kycData.ipfsHash && (
                  <div className="pt-4 border-t border-purple-500/20">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewDocuments(kycData)}
                      disabled={isLoadingDocuments}
                      className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300 disabled:opacity-50"
                    >
                      {isLoadingDocuments ? (
                        <>
                          <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <FiFileText className="h-4 w-4 mr-2" />
                          View Documents
                        </>
                      )}
                    </motion.button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="relative inline-block">
                  <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full blur-xl"></div>
                  <div className="relative p-6 rounded-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30">
                    <FiShield className="h-16 w-16 text-blue-300 mx-auto" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mt-6 mb-2">
                  KYC Not Submitted
                </h3>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                  Submit your KYC documents to start selling products on the
                  platform and unlock all merchant features
                </p>
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                >
                  <FiUpload className="h-5 w-5 mr-2" />
                  Submit KYC
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>

        {/* KYC Review Section (for owners/reviewers) */}
        {isOwner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-2xl backdrop-blur-xl border p-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
              borderColor: "rgba(139, 92, 246, 0.2)",
            }}
          >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-indigo-600/10 to-transparent rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                  <FiLock className="h-6 w-6 text-blue-300" />
                </div>
                <h2 className="text-2xl font-bold text-white">KYC Reviews</h2>
                <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 text-sm font-bold">
                  Admin Only
                </span>
              </div>

              {allKycUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-full">
                    {/* Table Header */}
                    <div className="grid grid-cols-5 gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20 mb-4">
                      <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                        User
                      </div>
                      <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                        Status
                      </div>
                      <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                        Aadhaar Proof
                      </div>
                      <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                        Submitted
                      </div>
                      <div className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                        Actions
                      </div>
                    </div>

                    {/* Table Rows */}
                    <div className="space-y-3">
                      {allKycUsers.map((user, index) => (
                        <motion.div
                          key={user.user}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="grid grid-cols-5 gap-4 p-4 rounded-xl backdrop-blur-sm border transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-600/5 hover:to-indigo-600/5"
                          style={{ borderColor: "rgba(139, 92, 246, 0.2)" }}
                        >
                          {/* User */}
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                              <FiUser className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-sm font-mono text-white">
                              {user.user.slice(0, 6)}...{user.user.slice(-4)}
                            </span>
                          </div>

                          {/* Status */}
                          <div className="flex items-center space-x-2">
                            <div
                              className={`p-1 rounded-lg bg-gradient-to-r ${
                                getStatusConfig(user.status).bg
                              } border ${getStatusConfig(user.status).border}`}
                            >
                              {createElement(
                                getStatusConfig(user.status).icon,
                                {
                                  className: `h-4 w-4 ${
                                    getStatusConfig(user.status).text
                                  }`,
                                }
                              )}
                            </div>
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-bold backdrop-blur-sm border ${
                                getStatusConfig(user.status).border
                              } ${getStatusConfig(user.status).text}`}
                              style={{
                                background: `linear-gradient(135deg, ${
                                  getStatusConfig(user.status).bg
                                })`,
                              }}
                            >
                              {KYC_STATUS_NAMES[user.status]}
                            </span>
                          </div>

                          {/* Aadhaar Proof */}
                          <div className="flex items-center space-x-2">
                            {user.aadhaarProofHash && user.aadhaarProofHash !== ethers.constants.HashZero ? (
                              <>
                                <div className="p-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                                  <FiHash className="h-3 w-3 text-blue-300" />
                                </div>
                                <span className="text-xs font-mono text-blue-300" title={user.aadhaarProofHash}>
                                  {user.aadhaarProofHash.slice(0, 6)}...{user.aadhaarProofHash.slice(-4)}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-500 italic">Not Verified</span>
                            )}
                          </div>

                          {/* Submitted Date */}
                          <div className="flex items-center text-sm text-gray-300">
                            {new Date(
                              parseInt(user.submittedAt) * 1000
                            ).toLocaleDateString()}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2">
                            {user.ipfsHash && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleViewDocuments(user)}
                                disabled={isLoadingDocuments}
                                className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300 text-sm font-medium disabled:opacity-50"
                              >
                                {isLoadingDocuments ? (
                                  <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <FiEye className="h-4 w-4" />
                                )}
                              </motion.button>
                            )}
                            {user.status === KYC_STATUS.Pending && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    handleReviewKYC(user.user, true)
                                  }
                                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-blue-300 hover:text-white transition-all duration-300 text-sm font-medium"
                                >
                                  <FiCheck className="h-4 w-4" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    const reason = prompt(
                                      "Enter rejection reason:"
                                    );
                                    if (reason) {
                                      handleReviewKYC(user.user, false, reason);
                                    }
                                  }}
                                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-all duration-300 text-sm font-medium"
                                >
                                  <FiX className="h-4 w-4" />
                                </motion.button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="relative inline-block">
                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-full blur-xl"></div>
                    <div className="relative p-6 rounded-full bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/30">
                      <FiUser className="h-16 w-16 text-blue-300 mx-auto" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mt-6 mb-2">
                    No KYC Submissions
                  </h3>
                  <p className="text-gray-400">
                    No users have submitted KYC documents yet
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Document Viewer Modal */}
        <DocumentViewerModal
          isOpen={showDocumentModal}
          onClose={() => setShowDocumentModal(false)}
          documents={selectedDocuments}
          userAddress={selectedUserAddress}
        />

        {/* KYC Submit Modal */}
        <KYCSubmitModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onSubmit={handleSubmitKYC}
        />
      </div>
    </Layout>
  );
};

// Enhanced KYC Submit Modal Component
const KYCSubmitModal = ({ isOpen, onClose, onSubmit }) => {
  const [documents, setDocuments] = useState([]);
  const [showDocScanner, setShowDocScanner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarValidation, setAadhaarValidation] = useState({ valid: false, error: null });
  const [panNumber, setPanNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");

  const documentTypes = [
    {
      id: "identity",
      label: "Identity Document",
      required: true,
      icon: FiUser,
    },
    { id: "address", label: "Address Proof", required: true, icon: FiFileText },
    {
      id: "business",
      label: "Business Registration",
      required: false,
      icon: FiShield,
    },
    { id: "bank", label: "Bank Statement", required: false, icon: FiLock },
  ];

  const handleFileChange = (docType, file) => {
    setDocuments((prev) => {
      const filtered = prev.filter((doc) => doc.type !== docType);
      if (file) {
        return [...filtered, { type: docType, file }];
      }
      return filtered;
    });
  };

  const handleOcrConfirmed = ({ docType, fields }) => {
    if (fields.name) setFullName(fields.name);
    if (docType === "pan" && fields.idNumber) setPanNumber(fields.idNumber.toUpperCase());
    if (docType === "aadhaar" && fields.idNumber) {
      setAadhaarNumber(formatAadhaar(fields.idNumber));
      setAadhaarValidation(isValidAadhaar(fields.idNumber));
    }

    if (fields.dob) {
      const yearFirst = fields.dob.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
      const dayFirst = fields.dob.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
      if (yearFirst) {
        setDob(`${yearFirst[1]}-${yearFirst[2].padStart(2, "0")}-${yearFirst[3].padStart(2, "0")}`);
      } else if (dayFirst) {
        setDob(`${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`);
      }
    }

    setShowDocScanner(false);
    toast("OCR filled matching fields. Review them and upload documents separately.", { icon: "ℹ️" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const requiredDocs = documentTypes.filter((doc) => doc.required);
    const submittedRequiredDocs = documents.filter((doc) =>
      requiredDocs.some((required) => required.id === doc.type)
    );

    if (submittedRequiredDocs.length < requiredDocs.length) {
      toast.error("Please upload all required documents");
      return;
    }

    if (!aadhaarValidation.valid) {
      toast.error(aadhaarValidation.error || "Please enter a valid Aadhaar number");
      return;
    }

    if (!panNumber || !fullName || !dob) {
      toast.error("Please fill in all PAN verification details");
      return;
    }

    setUploading(true);
    setProgressMessage("Preparing your KYC submission...");
    const submitted = await onSubmit(
      documents,
      aadhaarNumber,
      panNumber,
      fullName,
      dob,
      setProgressMessage
    );
    setUploading(false);
    if (!submitted) {
      setProgressMessage("");
      return;
    }

    // Reset form
    setDocuments([]);
    setAadhaarNumber("");
    setAadhaarValidation({ valid: false, error: null });
    setPanNumber("");
    setFullName("");
    setDob("");
    setProgressMessage("");
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
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-600/10 to-transparent rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                    <FiShield className="h-6 w-6 text-blue-300" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Submit KYC Documents
                  </h3>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-xl bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30 text-red-300 hover:text-white transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </motion.button>
              </div>

              <div className="mb-5">
                {showDocScanner ? (
                  <DocScanner
                    onDataConfirmed={handleOcrConfirmed}
                    onClose={() => setShowDocScanner(false)}
                  />
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDocScanner(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-400/25 bg-blue-400/10 px-3 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-400/15"
                    >
                      <FiFileText className="h-4 w-4" /> Scan ID with local OCR
                    </button>
                    <p className="mt-2 text-xs text-gray-400">
                      OCR runs in this browser and only fills editable fields. It does not verify authenticity; review every value. Submitting KYC documents uses the existing IPFS upload flow.
                    </p>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  {documentTypes.map((docType, index) => {
                    const uploadedDoc = documents.find(
                      (doc) => doc.type === docType.id
                    );

                    return (
                      <motion.div
                        key={docType.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative"
                      >
                        <label className="block text-sm font-bold text-white mb-3 flex items-center space-x-2">
                          <docType.icon className="h-4 w-4 text-purple-300" />
                          <span>{docType.label}</span>
                          {docType.required && (
                            <span className="text-red-400 ml-1">*</span>
                          )}
                        </label>

                        <div className="relative">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.jpe"
                            onChange={(e) =>
                              handleFileChange(docType.id, e.target.files[0])
                            }
                            className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-blue-600/20 file:to-purple-600/20 file:text-blue-300 hover:file:from-blue-600/30 hover:file:to-purple-600/30 file:transition-all file:duration-300"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                              borderColor: "rgba(139, 92, 246, 0.2)",
                            }}
                          />
                        </div>

                        {uploadedDoc && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-2 p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30"
                          >
                            <div className="flex items-center space-x-2">
                              <FiCheck className="h-4 w-4 text-blue-300" />
                              <span className="text-sm text-blue-200 font-medium">
                                {uploadedDoc.file.name}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Full Name Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative"
                >
                  <label className="block text-sm font-bold text-white mb-3 flex items-center space-x-2">
                    <FiUser className="h-4 w-4 text-purple-300" />
                    <span>Full Name (as per PAN)</span>
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent font-medium"
                    style={{
                      background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.2)"
                    }}
                  />
                </motion.div>

                {/* DOB Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="relative"
                >
                  <label className="block text-sm font-bold text-white mb-3 flex items-center space-x-2">
                    <FiCalendar className="h-4 w-4 text-purple-300" />
                    <span>Date of Birth</span>
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent font-medium"
                    style={{
                      background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                      borderColor: "rgba(139, 92, 246, 0.2)"
                    }}
                  />
                </motion.div>

                {/* PAN Number Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="relative"
                >
                  <label className="block text-sm font-bold text-white mb-3 flex items-center space-x-2">
                    <FiHash className="h-4 w-4 text-purple-300" />
                    <span>PAN Number</span>
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. ABCDE1234F"
                    className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent font-mono uppercase tracking-wider text-lg"
                    style={{
                      background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                      borderColor: panNumber.length === 10 ? "rgba(34, 197, 94, 0.5)" : "rgba(139, 92, 246, 0.2)"
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Required for PAN verification level.
                  </p>
                </motion.div>

                {/* Aadhaar Number Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="relative"
                >
                  <label className="block text-sm font-bold text-white mb-3 flex items-center space-x-2">
                    <FiHash className="h-4 w-4 text-purple-300" />
                    <span>Aadhaar Number</span>
                    <span className="text-red-400 ml-1">*</span>
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="e.g. 2345 6789 0123"
                      value={aadhaarNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAadhaarNumber(val);
                        if (val.replace(/[\s-]/g, "").length > 0) {
                          setAadhaarValidation(isValidAadhaar(val));
                        } else {
                          setAadhaarValidation({ valid: false, error: null });
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent font-mono text-lg tracking-wider"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)",
                        borderColor: aadhaarNumber.replace(/[\s-]/g, "").length > 0
                          ? aadhaarValidation.valid
                            ? "rgba(34, 197, 94, 0.5)"
                            : "rgba(239, 68, 68, 0.5)"
                          : "rgba(139, 92, 246, 0.2)",
                      }}
                    />
                    {/* Validation icon */}
                    {aadhaarNumber.replace(/[\s-]/g, "").length > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {aadhaarValidation.valid ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="p-1 rounded-full bg-blue-500/20"
                          >
                            <FiCheckCircle className="h-5 w-5 text-blue-400" />
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="p-1 rounded-full bg-red-500/20"
                          >
                            <FiXCircle className="h-5 w-5 text-red-400" />
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Validation message */}
                  {aadhaarNumber.replace(/[\s-]/g, "").length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-2 p-2 rounded-lg ${
                        aadhaarValidation.valid
                          ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30"
                          : "bg-gradient-to-r from-red-600/20 to-indigo-600/20 border border-red-500/30"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {aadhaarValidation.valid ? (
                          <>
                            <FiCheck className="h-4 w-4 text-blue-300" />
                            <span className="text-sm text-blue-200 font-medium">
                              Valid Aadhaar number ✓
                            </span>
                          </>
                        ) : (
                          <>
                            <FiAlertTriangle className="h-4 w-4 text-red-300" />
                            <span className="text-sm text-red-200 font-medium">
                              {aadhaarValidation.error}
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <p className="mt-1 text-xs text-gray-500">
                    Your Aadhaar number is never stored — only a cryptographic proof hash is saved on-chain.
                  </p>
                </motion.div>

                {/* Security Notice */}
                <div
                  className="p-4 rounded-xl backdrop-blur-sm border"
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
                      <h4 className="font-bold text-yellow-300 mb-1">
                        Security & Privacy
                      </h4>
                      <p className="text-yellow-200">
                        Your documents will be securely encrypted and stored on
                        IPFS. Only authorized personnel can review your
                        submission. Ensure all documents are clear, valid, and
                        up-to-date.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
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
                    disabled={uploading || documents.length === 0}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        />
                        <span>Uploading...</span>
                      </div>
                    ) : (
                      "Submit KYC"
                    )}
                  </motion.button>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <FiUpload className="h-4 w-4 text-blue-300" />
                      <span className="text-sm font-medium text-blue-300">
                        {progressMessage}
                      </span>
                    </div>
                    <div className="w-full bg-gray-600/20 rounded-full h-2">
                      <motion.div
                        className="h-2 w-1/3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        animate={{ x: [0, 160, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </motion.div>
                )}
              </form>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default KYCManagement;
