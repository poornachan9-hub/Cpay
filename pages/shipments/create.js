import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAccount, useChainId } from "wagmi";
import Layout from "../../components/Layout";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import {
  FiArrowLeft,
  FiPackage,
  FiTruck,
  FiCalendar,
  FiDollarSign,
  FiUpload,
  FiCheckCircle,
  FiExternalLink,
  FiInfo,
  FiShield,
  FiClock,
  FiFileText,
} from "react-icons/fi";
import { supplyChainService, SHIPMENT_CATEGORIES, SHIPMENT_TYPES } from "../../services/supplyChainService";
import { uploadFileToIPFS } from "../../lib/pinata";
import { SUPPLY_CHAIN_ADDRESS } from "../../lib/supplyChainABI";

const POLYGON_CHAIN_ID = 137;

export default function CreateShipmentPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [loading, setLoading] = useState(false);
  const [txState, setTxState] = useState(null); // 'waiting_confirm', 'pending', 'confirmed', 'error'
  const [txHash, setTxHash] = useState("");
  const [receiptDetails, setReceiptDetails] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [senderName, setSenderName] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [category, setCategory] = useState(0);
  const [shipmentType, setShipmentType] = useState(0);
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [receiver, setReceiver] = useState("");
  const [carrier, setCarrier] = useState("");
  const [requireInsurance, setRequireInsurance] = useState(false);
  const [requiresSignature, setRequiresSignature] = useState(false);

  // Dates
  const now = new Date();
  const defaultPickup = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
  const defaultDelivery = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [pickupTime, setPickupTime] = useState(defaultPickup);
  const [estimatedDelivery, setEstimatedDelivery] = useState(defaultDelivery);

  // File uploads
  const [uploadingFile, setUploadingFile] = useState(false);
  const [documentHash, setDocumentHash] = useState("");
  const [imageHashes, setImageHashes] = useState([]);

  const isPolygon = chainId === POLYGON_CHAIN_ID;

  const handleFileUpload = async (e, isDoc = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const toastId = toast.loading(`Uploading ${file.name} to IPFS...`);
    try {
      const res = await uploadFileToIPFS(file);
      if (res.success && res.hash) {
        if (isDoc) {
          setDocumentHash(res.hash);
        } else {
          setImageHashes((prev) => [...prev, res.hash]);
        }
        toast.success(`Uploaded to IPFS: ${res.hash.slice(0, 8)}...`, { id: toastId });
      } else {
        toast.error(`IPFS Upload failed: ${res.error || "Unknown error"}`, { id: toastId });
      }
    } catch (err) {
      toast.error(`Upload error: ${err.message}`, { id: toastId });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isConnected || !address) {
      toast.error("Connect your MetaMask wallet first");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a shipment title");
      return;
    }

    if (!receiver || !ethers.utils.isAddress(receiver)) {
      toast.error("Please enter a valid receiver Polygon address");
      return;
    }

    if (!carrier || !ethers.utils.isAddress(carrier)) {
      toast.error("Please enter a valid carrier Polygon address");
      return;
    }

    const pickupDate = new Date(pickupTime);
    const deliveryDate = new Date(estimatedDelivery);

    if (deliveryDate <= pickupDate) {
      toast.error("Estimated delivery time must be after pickup time");
      return;
    }

    setLoading(true);
    setTxState("waiting_confirm");
    const toastId = toast.loading("Confirm shipment creation in your MetaMask wallet...");

    try {
      const shipmentData = {
        title,
        description,
        senderName,
        receiverName,
        category: Number(category),
        shipmentType: Number(shipmentType),
        weight: weight ? Number(weight) : 0,
        dimensions,
        declaredValue: declaredValue ? Number(declaredValue) : 0,
        receiver,
        carrier,
        pickupTime: pickupDate.toISOString(),
        estimatedDelivery: deliveryDate.toISOString(),
        requireInsurance,
        requiresSignature,
        documentHash,
        imageHashes,
      };

      setTxState("pending");
      toast.loading("Broadcasting transaction to Polygon Mainnet...", { id: toastId });

      const res = await supplyChainService.createShipment(shipmentData);

      if (res.success) {
        setTxHash(res.txHash);
        setReceiptDetails(res);
        setTxState("confirmed");
        toast.success("Shipment successfully registered on Polygon!", { id: toastId });
      } else {
        throw new Error("Transaction reverted on-chain");
      }
    } catch (err) {
      console.error("Create shipment error:", err);
      const isReject = err?.message?.includes("rejected") || err?.code === 4001;
      setTxState("error");
      toast.error(isReject ? "Signature rejected in wallet" : err?.reason || err?.message || "Failed to create shipment", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Create Shipment | CryptoPay Supply Chain</title>
        <meta name="description" content="Register an immutable supply chain shipment on Polygon Mainnet" />
      </Head>

      <Layout>
        <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">

          {/* ── Top Bar ── */}
          <div className="flex items-center justify-between">
            <Link
              href="/shipments"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
            >
              <FiArrowLeft className="h-4 w-4" />
              <span>Back to Shipments</span>
            </Link>

            <span className="text-xs font-mono text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
              Polygon Mainnet (Chain 137)
            </span>
          </div>

          {/* ── Header ── */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                <FiPackage className="h-6 w-6" />
              </span>
              Create New Shipment
            </h1>
            <p className="text-sm text-gray-400">
              Immutably register a shipment on the Polygon blockchain with carrier routing and declared escrow.
            </p>
          </div>

          {/* ── Confirmation Result Card ── */}
          {txState === "confirmed" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <FiCheckCircle className="h-8 w-8 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-white">Shipment Registered On-Chain!</h3>
                  <p className="text-xs text-emerald-200/80">
                    The transaction has been confirmed on Polygon Mainnet.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction Hash:</span>
                  <a
                    href={`https://polygonscan.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 flex items-center gap-1"
                  >
                    {txHash.slice(0, 10)}...{txHash.slice(-8)}
                    <FiExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {receiptDetails?.blockNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Block Number:</span>
                    <span className="text-gray-300">{receiptDetails.blockNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Contract Address:</span>
                  <span className="text-gray-300">{SUPPLY_CHAIN_ADDRESS}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/shipments"
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-xs transition"
                >
                  View in My Shipments
                </Link>
                <button
                  onClick={() => {
                    setTxState(null);
                    setTxHash("");
                    setTitle("");
                    setReceiver("");
                    setCarrier("");
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 text-xs transition"
                >
                  Create Another
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Section 1: Cargo Details */}
            <div className="p-6 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <FiPackage className="h-4 w-4 text-teal-400" />
                1. Package & Cargo Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Shipment Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Electronics Batch #4092"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Detailed cargo contents, handling instructions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#13111C] border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  >
                    {SHIPMENT_CATEGORIES.map((cat, idx) => (
                      <option key={cat} value={idx}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Shipment Type</label>
                  <select
                    value={shipmentType}
                    onChange={(e) => setShipmentType(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#13111C] border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  >
                    {SHIPMENT_TYPES.map((t, idx) => (
                      <option key={t} value={idx}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 12.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Dimensions (LxWxH cm)</label>
                  <input
                    type="text"
                    placeholder="e.g., 40x30x20"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Addresses & Logistics */}
            <div className="p-6 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <FiTruck className="h-4 w-4 text-teal-400" />
                2. Blockchain Addresses & Schedule
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Sender Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Alpha Logistics Corp"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Receiver Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Apex Distributors"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Receiver Polygon Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="0x..."
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    className="w-full font-mono px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Carrier Polygon Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="0x..."
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full font-mono px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Pickup Date & Time</label>
                  <input
                    type="datetime-local"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Estimated Delivery Date & Time</label>
                  <input
                    type="datetime-local"
                    value={estimatedDelivery}
                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-300">
                    Declared Value (in POL)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                      value={declaredValue}
                      onChange={(e) => setDeclaredValue(e.target.value)}
                      className="w-full pl-3.5 pr-14 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500/50"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-teal-400">
                      POL
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    This amount is escrowed in the smart contract and released upon successful delivery confirmation.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: IPFS Documentation */}
            <div className="p-6 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <FiFileText className="h-4 w-4 text-teal-400" />
                3. IPFS Documentation & Verification Proofs
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                    Upload Bill of Lading / Invoices (Optional)
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer transition">
                    <FiUpload className="h-6 w-6 text-teal-400 mb-1" />
                    <span className="text-xs text-gray-300">Click to upload document to IPFS</span>
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e, true)}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>
                  {documentHash && (
                    <p className="mt-1.5 text-xs font-mono text-emerald-400 flex items-center gap-1">
                      <FiCheckCircle className="h-3.5 w-3.5" />
                      IPFS CID: {documentHash}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={requiresSignature}
                      onChange={(e) => setRequiresSignature(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-teal-500 focus:ring-0"
                    />
                    Require Receiver Signature on Delivery
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={requireInsurance}
                      onChange={(e) => setRequireInsurance(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-teal-500 focus:ring-0"
                    />
                    Enable Cargo Insurance Escrow
                  </label>
                </div>
              </div>
            </div>

            {/* ── Submit Button ── */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/shipments"
                className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:text-white text-sm font-medium transition"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading || !isConnected}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-sm shadow-xl shadow-teal-500/25 flex items-center gap-2 disabled:opacity-50 transition"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{txState === "waiting_confirm" ? "Waiting for Wallet..." : "Broadcasting to Polygon..."}</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="h-4 w-4" />
                    <span>Sign & Create Shipment</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </div>
      </Layout>
    </>
  );
}
