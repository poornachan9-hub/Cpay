import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAccount, useChainId } from "wagmi";
import Layout from "../../components/Layout";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiPackage,
  FiTruck,
  FiMapPin,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiDollarSign,
  FiCalendar,
  FiShield,
  FiExternalLink,
  FiRefreshCw,
  FiUser,
  FiFileText,
  FiCheck,
  FiAlertTriangle,
} from "react-icons/fi";
import { supplyChainService, SHIPMENT_STATUS } from "../../services/supplyChainService";
import { SUPPLY_CHAIN_ADDRESS } from "../../lib/supplyChainABI";

const POLYGON_CHAIN_ID = 137;

function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ShipmentDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Status update modal state
  const [locationInput, setLocationInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [actionType, setActionType] = useState(null); // 'start', 'complete', 'cancel'

  const loadShipment = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await supplyChainService.getShipment(id);
      setShipment(data);
    } catch (err) {
      console.error("Failed to load shipment details:", err);
      toast.error("Could not find shipment on Polygon");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadShipment();
  }, [loadShipment]);

  // Handle Carrier / Sender On-Chain Actions
  const handleAction = async () => {
    if (!isConnected || !address) {
      toast.error("Connect your MetaMask wallet");
      return;
    }

    setActionLoading(true);
    const toastId = toast.loading("Confirming action in MetaMask...");
    try {
      let res;
      if (actionType === "start") {
        res = await supplyChainService.startShipment(id, locationInput || "In Transit", notesInput || "Dispatched by carrier");
      } else if (actionType === "complete") {
        res = await supplyChainService.completeShipment(id, locationInput || "Delivered", notesInput || "Package delivered to destination");
      } else if (actionType === "cancel") {
        res = await supplyChainService.cancelShipment(id, notesInput || "Cancelled by sender");
      }

      if (res?.success) {
        toast.success(`Shipment updated! Hash: ${res.txHash.slice(0, 8)}...`, { id: toastId });
        setActionType(null);
        setLocationInput("");
        setNotesInput("");
        await loadShipment();
      } else {
        throw new Error("Transaction reverted on Polygon");
      }
    } catch (err) {
      console.error("Action error:", err);
      const isReject = err?.message?.includes("rejected") || err?.code === 4001;
      toast.error(isReject ? "Signature rejected in wallet" : err?.reason || err?.message || "Failed to update shipment", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const isCarrier = shipment && address && shipment.carrier?.toLowerCase() === address.toLowerCase();
  const isSender = shipment && address && shipment.sender?.toLowerCase() === address.toLowerCase();

  return (
    <>
      <Head>
        <title>{shipment ? `${shipment.title} | Shipment #${id}` : "Shipment Details"} | CryptoPay</title>
        <meta name="description" content="View on-chain shipment tracking details and history" />
      </Head>

      <Layout>
        <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">

          {/* ── Top Bar ── */}
          <div className="flex items-center justify-between">
            <Link
              href="/shipments"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
            >
              <FiArrowLeft className="h-4 w-4" />
              <span>Back to Shipments</span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={loadShipment}
                disabled={loading}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white transition"
                title="Refresh from Polygon"
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <span className="text-xs font-mono text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
                Shipment #{id}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-white/5 animate-pulse">
              <FiPackage className="h-10 w-10 text-gray-500 mx-auto mb-2 animate-bounce" />
              <p className="text-sm text-gray-400">Loading on-chain shipment data from Polygon Mainnet...</p>
            </div>
          ) : !shipment ? (
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-black/20">
              <FiXCircle className="h-12 w-12 text-rose-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-white">Shipment Not Found</h2>
              <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
                Shipment #{id} does not exist on contract {shortAddr(SUPPLY_CHAIN_ADDRESS)}.
              </p>
              <Link
                href="/shipments"
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-xs transition"
              >
                Return to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-6">

              {/* ── Main Status Hero ── */}
              <div className="p-6 rounded-3xl border border-white/10 bg-black/20 backdrop-blur-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-mono uppercase tracking-wider text-teal-400">
                      {shipment.category} • {shipment.shipmentType}
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      {shipment.title}
                    </h1>
                    {shipment.description && (
                      <p className="text-sm text-gray-400 max-w-2xl">{shipment.description}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border tracking-wider ${
                      shipment.status === "DELIVERED"
                        ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                        : shipment.status === "IN_TRANSIT"
                        ? "text-blue-300 bg-blue-500/10 border-blue-500/30"
                        : shipment.status === "CANCELLED"
                        ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
                        : "text-amber-300 bg-amber-500/10 border-amber-500/30"
                    }`}>
                      {shipment.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1.5 font-mono">
                      Declared: <span className="font-bold text-teal-300">{shipment.declaredValue} POL</span>
                    </p>
                  </div>
                </div>

                {/* Milestone Progress Bar */}
                <div className="mt-8 pt-6 border-t border-white/5">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className={`space-y-1 ${shipment.statusCode >= 0 ? "text-teal-400 font-bold" : "text-gray-500"}`}>
                      <div className={`h-1.5 rounded-full ${shipment.statusCode >= 0 ? "bg-teal-500" : "bg-white/10"}`} />
                      <p>1. Registered & Escrowed</p>
                    </div>
                    <div className={`space-y-1 ${shipment.statusCode >= 1 ? "text-blue-400 font-bold" : "text-gray-500"}`}>
                      <div className={`h-1.5 rounded-full ${shipment.statusCode >= 1 ? "bg-blue-500" : "bg-white/10"}`} />
                      <p>2. In Transit</p>
                    </div>
                    <div className={`space-y-1 ${shipment.statusCode >= 2 ? "text-emerald-400 font-bold" : "text-gray-500"}`}>
                      <div className={`h-1.5 rounded-full ${shipment.statusCode >= 2 ? "bg-emerald-500" : "bg-white/10"}`} />
                      <p>3. Delivered & Settled</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Action Bar for Carrier / Sender ── */}
              {(isCarrier || isSender) && shipment.status !== "DELIVERED" && shipment.status !== "CANCELLED" && (
                <div className="p-4 rounded-2xl border border-teal-500/30 bg-teal-500/5 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FiShield className="h-5 w-5 text-teal-400" />
                    <span className="text-xs font-semibold text-white">
                      {isCarrier ? "Carrier Controls Available" : "Sender Controls Available"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCarrier && shipment.status === "PENDING" && (
                      <button
                        onClick={() => setActionType("start")}
                        className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-xs transition"
                      >
                        Start Shipment (In Transit)
                      </button>
                    )}

                    {isCarrier && shipment.status === "IN_TRANSIT" && (
                      <button
                        onClick={() => setActionType("complete")}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-xs transition"
                      >
                        Complete Delivery
                      </button>
                    )}

                    {isSender && shipment.status === "PENDING" && (
                      <button
                        onClick={() => setActionType("cancel")}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs transition"
                      >
                        Cancel Shipment
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Modal / Form */}
              {actionType && (
                <div className="p-5 rounded-2xl border border-teal-500/40 bg-black/40 space-y-3">
                  <h4 className="text-sm font-bold text-white capitalize">
                    Confirm {actionType === "start" ? "Shipment Dispatch" : actionType === "complete" ? "Delivery Completion" : "Shipment Cancellation"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Current Location (e.g., Warehouse Hub 3B)"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-teal-500/50"
                    />
                    <input
                      type="text"
                      placeholder="Status notes / remarks"
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-teal-500/50"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setActionType(null)}
                      className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={handleAction}
                      disabled={actionLoading}
                      className="px-5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-semibold text-xs transition disabled:opacity-50"
                    >
                      {actionLoading ? "Signing Transaction..." : "Broadcast Update to Polygon"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Logistics Information Grid ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Addresses */}
                <div className="p-5 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                    <FiMapPin className="h-4 w-4 text-teal-400" />
                    Participant Addresses
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-gray-500">Sender:</p>
                      <p className="font-mono text-gray-200 mt-0.5">{shipment.sender}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Receiver:</p>
                      <p className="font-mono text-gray-200 mt-0.5">{shipment.receiver}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Carrier:</p>
                      <p className="font-mono text-gray-200 mt-0.5">{shipment.carrier}</p>
                    </div>
                  </div>
                </div>

                {/* Timestamps & Cargo */}
                <div className="p-5 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                    <FiClock className="h-4 w-4 text-teal-400" />
                    Schedule & Specifications
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500">Pickup Date:</p>
                      <p className="text-gray-200 font-medium mt-0.5">
                        {shipment.pickupTime ? shipment.pickupTime.toLocaleString() : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Estimated Delivery:</p>
                      <p className="text-gray-200 font-medium mt-0.5">
                        {shipment.estimatedDelivery ? shipment.estimatedDelivery.toLocaleString() : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Weight:</p>
                      <p className="text-gray-200 font-medium mt-0.5">{shipment.weight} kg</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Dimensions:</p>
                      <p className="text-gray-200 font-medium mt-0.5">{shipment.dimensions || "Standard"}</p>
                    </div>
                    {shipment.documentHash && (
                      <div className="col-span-2 pt-1 border-t border-white/5">
                        <p className="text-gray-500">IPFS Document Proof:</p>
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${shipment.documentHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:text-teal-300 font-mono flex items-center gap-1 mt-0.5"
                        >
                          {shipment.documentHash.slice(0, 16)}...
                          <FiExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* ── Tracking History Timeline ── */}
              <div className="p-6 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                  <FiClock className="h-4 w-4 text-teal-400" />
                  On-Chain Milestone History
                </h3>

                {(!shipment.trackingHistory || shipment.trackingHistory.length === 0) ? (
                  <p className="text-xs text-gray-500 italic">No milestone updates recorded yet.</p>
                ) : (
                  <div className="space-y-4 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                    {shipment.trackingHistory.map((t, idx) => (
                      <div key={idx} className="relative space-y-1">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-teal-400 shadow-sm shadow-teal-400/50" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{t.location || "Checkpoint"}</span>
                          <span className="text-[11px] text-gray-500">{t.timestamp.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-300">{t.notes}</p>
                        <p className="text-[10px] font-mono text-gray-500">Updated by: {shortAddr(t.updater)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </Layout>
    </>
  );
}
