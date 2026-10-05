import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import {
  FiArrowLeft,
  FiSearch,
  FiPackage,
  FiArrowRight,
  FiExternalLink,
} from "react-icons/fi";
import { SUPPLY_CHAIN_ADDRESS } from "../../lib/supplyChainABI";

function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function TrackingSearchPage() {
  const router = useRouter();
  const [searchId, setSearchId] = useState("");

  useEffect(() => {
    if (router.query.id) {
      setSearchId(router.query.id);
      router.push(`/shipments/${router.query.id}`);
    }
  }, [router]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    router.push(`/shipments/${searchId.trim()}`);
  };

  return (
    <>
      <Head>
        <title>Track Shipment | CryptoPay Supply Chain</title>
        <meta name="description" content="Track on-chain Polygon shipment by ID" />
      </Head>

      <Layout>
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-8">

          {/* Top Back */}
          <Link
            href="/shipments"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            <FiArrowLeft className="h-4 w-4" />
            <span>Back to Shipments</span>
          </Link>

          {/* Hero */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto shadow-xl shadow-teal-500/10">
              <FiPackage className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Live Shipment Tracking
            </h1>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Enter any on-chain Shipment ID to inspect real-time milestones and participants on Polygon Mainnet.
            </p>
          </div>

          {/* Search Card */}
          <form onSubmit={handleSearch} className="p-6 rounded-3xl border border-white/10 bg-black/20 backdrop-blur-xl space-y-4">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="number"
                min="0"
                required
                placeholder="Enter Shipment ID (e.g. 0, 1, 2...)"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-sm shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 transition"
            >
              <span>Inspect Tracking Milestones</span>
              <FiArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Info Box */}
          <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-xs text-gray-500 flex items-center justify-between">
            <span>Verified Smart Contract: <strong className="font-mono text-gray-400">{shortAddr(SUPPLY_CHAIN_ADDRESS)}</strong></span>
            <a
              href={`https://polygonscan.com/address/${SUPPLY_CHAIN_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 hover:text-teal-300 flex items-center gap-1"
            >
              PolygonScan
              <FiExternalLink className="h-3 w-3" />
            </a>
          </div>

        </div>
      </Layout>
    </>
  );
}
