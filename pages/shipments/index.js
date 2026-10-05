import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import Layout from "../../components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiPackage,
  FiTruck,
  FiMapPin,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiPlus,
  FiSearch,
  FiExternalLink,
  FiRefreshCw,
  FiDollarSign,
  FiCalendar,
  FiShield,
  FiActivity,
  FiArrowRight,
  FiEye,
} from "react-icons/fi";
import { supplyChainService, SHIPMENT_STATUS } from "../../services/supplyChainService";
import { SUPPLY_CHAIN_ADDRESS } from "../../lib/supplyChainABI";

const POLYGON_CHAIN_ID = 137;

function StatusBadge({ status }) {
  const map = {
    PENDING: { label: "PENDING", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
    IN_TRANSIT: { label: "IN TRANSIT", cls: "text-blue-300 bg-blue-500/10 border-blue-500/30" },
    DELIVERED: { label: "DELIVERED", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
    CANCELLED: { label: "CANCELLED", cls: "text-rose-300 bg-rose-500/10 border-rose-500/30" },
  };
  const s = map[status] || { label: status || "UNKNOWN", cls: "text-gray-300 bg-gray-500/10 border-gray-500/30" };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ShipmentsDashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all"); // 'all', 'sender', 'receiver', 'carrier'

  const isPolygon = chainId === POLYGON_CHAIN_ID;

  const loadShipments = useCallback(async () => {
    if (!address) {
      setShipments([]);
      return;
    }
    setLoading(true);
    try {
      const data = await supplyChainService.getUserShipments(address);
      setShipments(data);
    } catch (err) {
      console.error("Failed to load shipments:", err);
      toast.error("Failed to load on-chain shipments");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  // Filtering logic
  const filteredShipments = shipments.filter((s) => {
    // Status filter
    if (filterStatus !== "all" && s.status !== filterStatus) return false;

    // Role filter
    if (roleFilter === "sender" && s.sender?.toLowerCase() !== address?.toLowerCase()) return false;
    if (roleFilter === "receiver" && s.receiver?.toLowerCase() !== address?.toLowerCase()) return false;
    if (roleFilter === "carrier" && s.carrier?.toLowerCase() !== address?.toLowerCase()) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = s.id?.toString().includes(q);
      const matchTitle = s.title?.toLowerCase().includes(q);
      const matchSender = s.sender?.toLowerCase().includes(q);
      const matchReceiver = s.receiver?.toLowerCase().includes(q);
      const matchCarrier = s.carrier?.toLowerCase().includes(q);
      return matchId || matchTitle || matchSender || matchReceiver || matchCarrier;
    }
    return true;
  });

  const stats = {
    total: shipments.length,
    pending: shipments.filter((s) => s.status === "PENDING").length,
    inTransit: shipments.filter((s) => s.status === "IN_TRANSIT").length,
    delivered: shipments.filter((s) => s.status === "DELIVERED").length,
  };

  return (
    <>
      <Head>
        <title>Supply Chain & Shipments | CryptoPay</title>
        <meta name="description" content="Decentralized supply chain logistics management on Polygon" />
      </Head>

      <Layout>
        <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">

          {/* ── Page Header ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <FiTruck className="h-6 w-6" />
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Supply Chain Logistics
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-400 flex items-center gap-2">
                <span>Polygon Mainnet</span>
                <span>•</span>
                <span className="font-mono text-xs text-gray-400">
                  Contract: {shortAddr(SUPPLY_CHAIN_ADDRESS)}
                </span>
                <a
                  href={`https://polygonscan.com/address/${SUPPLY_CHAIN_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:text-teal-300"
                  title="View on PolygonScan"
                >
                  <FiExternalLink className="h-3.5 w-3.5 inline" />
                </a>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadShipments}
                disabled={loading || !address}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium flex items-center gap-2 transition"
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>

              <Link
                href="/shipments/tracking"
                className="px-4 py-2.5 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-sm font-medium flex items-center gap-2 transition"
              >
                <FiSearch className="h-4 w-4" />
                <span>Track ID</span>
              </Link>

              <Link
                href="/shipments/create"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold text-sm shadow-lg shadow-teal-500/20 flex items-center gap-2 transition"
              >
                <FiPlus className="h-4 w-4" />
                <span>Create Shipment</span>
              </Link>
            </div>
          </div>

          {/* ── Summary Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl">
              <p className="text-xs text-gray-400">Total Shipments</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl">
              <p className="text-xs text-amber-300/80">Pending Dispatched</p>
              <p className="text-2xl font-bold text-amber-300 mt-1">{stats.pending}</p>
            </div>
            <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-xl">
              <p className="text-xs text-blue-300/80">In Transit</p>
              <p className="text-2xl font-bold text-blue-300 mt-1">{stats.inTransit}</p>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl">
              <p className="text-xs text-emerald-300/80">Delivered</p>
              <p className="text-2xl font-bold text-emerald-300 mt-1">{stats.delivered}</p>
            </div>
          </div>

          {/* ── Search & Filter Controls ── */}
          <div className="p-4 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, address, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {["all", "PENDING", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                    filterStatus === st
                      ? "bg-teal-500 text-white shadow-md shadow-teal-500/20"
                      : "text-gray-400 hover:text-white bg-white/5"
                  }`}
                >
                  {st === "all" ? "All" : st.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1 border-t md:border-t-0 md:border-l border-white/10 pt-2 md:pt-0 md:pl-3">
              {[
                { key: "all", label: "All Roles" },
                { key: "sender", label: "Sender" },
                { key: "receiver", label: "Receiver" },
                { key: "carrier", label: "Carrier" },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRoleFilter(r.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    roleFilter === r.key
                      ? "bg-white/20 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Content Grid ── */}
          {!isConnected ? (
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-black/20">
              <FiPackage className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">Connect Your Wallet</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Connect your MetaMask wallet on Polygon Mainnet to view your on-chain shipments and track package lifecycles.
              </p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-2xl border border-white/10 bg-white/5 animate-pulse p-6" />
              ))}
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-black/20">
              <FiPackage className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">No Shipments Found</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
                {searchQuery || filterStatus !== "all" || roleFilter !== "all"
                  ? "No shipments match your search filters."
                  : "You haven't created or received any shipments on Polygon yet."}
              </p>
              <Link
                href="/shipments/create"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm transition"
              >
                <FiPlus className="h-4 w-4" />
                <span>Create Your First Shipment</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredShipments.map((s) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-5 flex flex-col justify-between hover:border-teal-500/30 transition group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-teal-400 font-bold bg-teal-500/10 px-2.5 py-0.5 rounded-md">
                        #{s.id}
                      </span>
                      <StatusBadge status={s.status} />
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition">
                        {s.title}
                      </h3>
                      {s.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{s.description}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Receiver:</span>
                        <span className="font-mono text-gray-300">{shortAddr(s.receiver)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Carrier:</span>
                        <span className="font-mono text-gray-300">{shortAddr(s.carrier)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Declared Value:</span>
                        <span className="font-bold text-teal-300">{s.declaredValue} POL</span>
                      </div>
                      {s.pickupTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Pickup:</span>
                          <span className="text-gray-400">{s.pickupTime.toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 capitalize">
                      {s.category.toLowerCase()} • {s.shipmentType.toLowerCase()}
                    </span>

                    <Link
                      href={`/shipments/${s.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition"
                    >
                      <span>Track Details</span>
                      <FiArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

        </div>
      </Layout>
    </>
  );
}
