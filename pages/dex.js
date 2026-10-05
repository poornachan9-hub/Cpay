import { useEffect, useState } from "react";
import Head from "next/head";
import Layout from "../components/Layout";
import { motion } from "framer-motion";
import {
  FiActivity,
  FiExternalLink,
  FiArrowRight,
  FiZap,
  FiDollarSign,
  FiLayers,
  FiTrendingUp,
  FiDroplet,
  FiPackage,
} from "react-icons/fi";

// ── Change this to your actual NovaDEX URL ──
const DEX_URL = "http://localhost:3003";

export default function DEXPortal() {
  const [countdown, setCountdown] = useState(null);
  const [launching, setLaunching] = useState(false);

  const handleLaunch = () => {
    setLaunching(true);
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      window.open(DEX_URL, "_blank");
      setLaunching(false);
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const features = [
    {
      icon: FiZap,
      title: "Swap Tokens",
      desc: "Instantly swap between any token pair with best-rate routing via QuickSwap on Polygon.",
      color: "from-violet-500 to-purple-600",
    },
    {
      icon: FiDroplet,
      title: "Add Liquidity",
      desc: "Provide liquidity to any token pair and earn a share of all trading fees.",
      color: "from-pink-500 to-rose-600",
    },
    {
      icon: FiPackage,
      title: "Launch Tokens",
      desc: "Deploy your own ERC-20 token on Polygon in seconds — no coding required.",
      color: "from-fuchsia-500 to-pink-600",
    },
    {
      icon: FiTrendingUp,
      title: "Options Trading",
      desc: "Trade Put and Call options on your favourite assets with real-time PnL charts.",
      color: "from-indigo-500 to-violet-600",
    },
  ];

  const quickLinks = [
    { label: "Swap",          path: "/swap" },
    { label: "Add Liquidity", path: "/liquidity/add" },
    { label: "Launch Token",  path: "/launch" },
    { label: "Portfolio",     path: "/dashboard" },
    { label: "Trade",         path: "/trade" },
    { label: "Explore",       path: "/explore" },
  ];

  const stats = [
    { label: "Supported Networks", value: "2+",      sub: "Polygon · Localhost" },
    { label: "Token Standard",     value: "ERC-20",  sub: "18-decimal Solidity" },
    { label: "DEX Protocol",       value: "AMM",     sub: "QuickSwap-compatible" },
    { label: "Options Chain",      value: "Live",    sub: "Put & Call contracts" },
  ];

  return (
    <>
      <Head>
        <title>NovaDEX — Decentralized Exchange | CryptoPay</title>
        <meta name="description" content="Launch NovaDEX — a full-featured decentralised exchange with token swaps, liquidity pools, token launches, and options trading." />
      </Head>

      <Layout>
        <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10">

          {/* ── Hero Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl p-10 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(236,72,153,0.08) 50%, rgba(99,102,241,0.10) 100%)",
              border: "1px solid rgba(139,92,246,0.25)",
              boxShadow: "0 0 60px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Background glow */}
            <div
              className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)" }}
            />

            {/* Icon */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="relative z-10 mx-auto mb-6 w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                boxShadow: "0 0 40px rgba(139,92,246,0.5)",
              }}
            >
              <FiActivity className="h-10 w-10 text-white" />
            </motion.div>

            <h1
              className="relative z-10 text-4xl font-black mb-3 tracking-tight"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                background: "linear-gradient(135deg, #c084fc, #ec4899, #818cf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              NovaDEX
            </h1>
            <p className="relative z-10 text-[#94a3b8] text-lg mb-2 max-w-xl mx-auto leading-relaxed">
              A full-featured decentralized exchange on the Polygon blockchain.
            </p>
            <p className="relative z-10 text-[#64748b] text-sm mb-8">
              Swap tokens · Provide liquidity · Launch your own ERC-20 · Trade options
            </p>

            {/* Launch Button */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleLaunch}
              disabled={launching}
              className="relative z-10 inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-white font-bold text-lg shadow-xl transition-all duration-300"
              style={{
                background: launching
                  ? "linear-gradient(135deg, rgba(139,92,246,0.5), rgba(236,72,153,0.5))"
                  : "linear-gradient(135deg, #8b5cf6, #ec4899)",
                boxShadow: launching ? "none" : "0 0 32px rgba(139,92,246,0.5)",
                cursor: launching ? "not-allowed" : "pointer",
              }}
            >
              {launching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Launching in {countdown}…</span>
                </>
              ) : (
                <>
                  <FiExternalLink className="h-5 w-5" />
                  <span>Launch NovaDEX</span>
                  <FiArrowRight className="h-5 w-5" />
                </>
              )}
            </motion.button>

            <p className="relative z-10 mt-4 text-[#475569] text-sm">
              Opens at{" "}
              <a
                href={DEX_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-violet-400 underline transition-colors"
                style={{ color: "#a78bfa" }}
              >
                {DEX_URL}
              </a>
            </p>
          </motion.div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="rounded-2xl p-5 text-center"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(139,92,246,0.15)",
                }}
              >
                <div
                  className="text-2xl font-black mb-1"
                  style={{
                    background: "linear-gradient(135deg, #c084fc, #ec4899)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {s.value}
                </div>
                <div className="text-xs font-semibold text-white mb-0.5">{s.label}</div>
                <div className="text-[10px] text-[#64748b]">{s.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* ── Feature Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                className="group relative rounded-2xl p-6 overflow-hidden"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                  style={{ background: "rgba(139,92,246,0.05)" }}
                />
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${f.color}`}
                  style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
                >
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-[#94a3b8] text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* ── Quick Links ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-3 justify-center pb-4"
          >
            {quickLinks.map((link) => (
              <a
                key={link.label}
                href={`${DEX_URL}${link.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-[#94a3b8] hover:text-white transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(139,92,246,0.18)",
                }}
              >
                <FiActivity className="h-3.5 w-3.5" />
                {link.label}
                <FiExternalLink className="h-3 w-3 opacity-50" />
              </a>
            ))}
          </motion.div>

        </div>
      </Layout>
    </>
  );
}
