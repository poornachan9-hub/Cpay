import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/router";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiHome,
  FiShoppingBag,
  FiCreditCard,
  FiUsers,
  FiBarChart,
  FiMenu,
  FiX,
  FiShield,
  FiDollarSign,
  FiFileText,
  FiLock,
  FiBriefcase,
  FiTruck,
  FiExternalLink,
  FiSend,
  FiActivity,
  FiPieChart,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { contractService } from "../services/contract";
import { isAdminAddress } from "../lib/constants";
import ABI from "../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json";

const Sidebar = ({ isOpen, setIsOpen }) => {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [isAdmin, setIsAdmin] = useState(false);
  const CONTRACT_ABI = ABI.abi;

  const navigation = [
    { name: "Dashboard",      href: "/dashboard",    icon: FiHome },
    { name: "Products",       href: "/products",     icon: FiShoppingBag },
    { name: "Payments",       href: "/payments",     icon: FiCreditCard },
    { name: "KYC Management", href: "/kyc",          icon: FiShield },
    { name: "Loans",          href: "/loans",        icon: FiDollarSign },
    { name: "AI Model Metrics", href: "/ai-analytics", icon: FiTrendingUp },
    { name: "Analytics",      href: "/analytics",    icon: FiBarChart },
    { name: "Transactions",   href: "/transactions", icon: FiFileText },
    { name: "Transfer Funds", href: "/transfer",     icon: FiSend },
    { name: "Shipments",      href: "/shipments",    icon: FiTruck },
    { name: "DEX",            href: "/dex",          icon: FiActivity,  external: true },
    { name: "Admin",          href: "/admin",        icon: FiLock },
  ];

  const adminNavigation = [{ name: "Users", href: "/users", icon: FiUsers }];

  const sidebarVariants = {
    open:   { x: 0,       transition: { type: "spring", stiffness: 300, damping: 40 } },
    closed: { x: "-100%", transition: { type: "spring", stiffness: 300, damping: 40 } },
  };

  const itemVariants = {
    hidden:  { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1, x: 0,
      transition: { delay: i * 0.05, type: "spring", stiffness: 300, damping: 40 },
    }),
  };

  useEffect(() => {
    if (isConnected && address) checkAdminAccess();
  }, [isConnected, address]);

  const checkAdminAccess = async () => {
    if (address && isAdminAddress(address)) {
      setIsAdmin(true);
      return;
    }
    try {
      const contract = contractService.getReadOnlyContract(CONTRACT_ABI);
      const owner = await contract.owner();
      setIsAdmin(owner.toLowerCase() === address.toLowerCase() || isAdminAddress(address));
    } catch (e) {
      setIsAdmin(isAdminAddress(address));
      console.error("Error checking admin:", e);
    }
  };

  const NavItem = ({ item, index }) => {
    const isActive = router.pathname === item.href;

    // External link items open the /shipments portal page (which handles the redirect)
    if (item.external) {
      return (
        <motion.div key={item.name} variants={itemVariants} custom={index}>
          <Link
            href={item.href}
            onClick={() => setIsOpen(false)}
            className={`group relative flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 overflow-hidden ${
              isActive ? "text-white" : "text-[#94a3b8] hover:text-white"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-xl"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 40 }}
                style={{
                  background: "linear-gradient(135deg, rgba(20,184,166,0.22), rgba(16,185,129,0.16))",
                  border: "1px solid rgba(20,184,166,0.32)",
                  boxShadow: "0 0 16px rgba(20,184,166,0.14), inset 0 0 16px rgba(20,184,166,0.05)",
                }}
              />
            )}
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r"
                style={{ background: "linear-gradient(180deg, #34d399, #059669)" }}
              />
            )}
            {!isActive && (
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: "rgba(20,184,166,0.07)", border: "1px solid rgba(20,184,166,0.14)" }}
              />
            )}
            <div className="relative z-10 flex items-center space-x-3 w-full">
              <div
                className="p-1.5 rounded-lg transition-all duration-200 flex-shrink-0"
                style={{
                  background: isActive ? "rgba(20,184,166,0.22)" : "rgba(255,255,255,0.05)",
                  color: isActive ? "#34d399" : "#94a3b8",
                }}
              >
                <item.icon className="h-4 w-4" />
              </div>
              <span>{item.name}</span>
              <FiExternalLink className="ml-auto h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        </motion.div>
      );
    }

    return (
      <motion.div key={item.name} variants={itemVariants} custom={index}>
        <Link
          href={item.href}
          onClick={() => setIsOpen(false)}
          className={`group relative flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 overflow-hidden ${
            isActive ? "text-white" : "text-[#94a3b8] hover:text-white"
          }`}
        >
          {/* Active pill — exact CryptoPay style */}
          {isActive && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 rounded-xl"
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 40 }}
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.22), rgba(59,130,246,0.16))",
                border: "1px solid rgba(139,92,246,0.32)",
                boxShadow: "0 0 16px rgba(139,92,246,0.14), inset 0 0 16px rgba(139,92,246,0.05)",
              }}
            />
          )}

          {/* Active left accent bar */}
          {isActive && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r"
              style={{ background: "linear-gradient(180deg, #60a5fa, #2563eb)" }}
            />
          )}

          {/* Hover bg */}
          {!isActive && (
            <div
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.14)" }}
            />
          )}

          <div className="relative z-10 flex items-center space-x-3 w-full">
            <div
              className="p-1.5 rounded-lg transition-all duration-200 flex-shrink-0"
              style={{
                background: isActive ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.05)",
                color: isActive ? "#a78bfa" : "#94a3b8",
              }}
            >
              <item.icon className="h-4 w-4" />
            </div>
            <span>{item.name}</span>

            {/* Pulsing active dot */}
            {isActive && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-auto w-[7px] h-[7px] rounded-full"
                style={{ background: "#60a5fa", boxShadow: "0 0 8px #2563eb", animation: "pulse-dot 2s infinite" }}
              />
            )}
          </div>
        </Link>
      </motion.div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        variants={sidebarVariants}
        animate={isOpen ? "open" : "closed"}
        className="fixed inset-y-0 left-0 z-50 w-[230px] lg:relative lg:z-0 lg:translate-x-0 overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, rgba(10,10,22,0.72), rgba(7,7,18,0.55))",
          backdropFilter: "blur(22px) saturate(140%)",
          WebkitBackdropFilter: "blur(22px) saturate(140%)",
          borderRight: "1px solid rgba(139,92,246,0.15)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Ambient purple glow top-left */}
        <div
          className="absolute -top-16 -left-16 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)" }}
        />

        {/* ── Logo Area ── */}
        <div
          className="flex items-center justify-between px-5 py-[22px]"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.15)" }}
        >
          <div className="flex items-center gap-3">
            {/* Logo icon */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #60a5fa, #2563eb)",
                boxShadow: "0 0 18px rgba(96,165,250,0.45)",
              }}
            >
              <FiCreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2
                className="text-base font-bold leading-tight"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  background: "linear-gradient(135deg, #60a5fa, #2563eb)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                CryptoPay
              </h2>
              <span className="text-[11px]" style={{ color: "#94a3b8" }}>Gateway Pro</span>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 rounded-xl border border-white/8 transition-all"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <FiX className="h-4 w-4 text-[#94a3b8]" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {/* Nav label */}
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#475569" }}>
            Main Menu
          </p>

          <motion.div initial="hidden" animate="visible" className="space-y-0.5">
            {navigation.map((item, i) => (
              <NavItem key={item.name} item={item} index={i} />
            ))}
          </motion.div>

          {isAdmin && (
            <>
              <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#475569" }}>
                System
              </p>
              <motion.div initial="hidden" animate="visible" className="space-y-0.5">
                {adminNavigation.map((item, i) => (
                  <NavItem key={item.name} item={item} index={i + navigation.length} />
                ))}
              </motion.div>
            </>
          )}
        </nav>

        {/* ── Footer user chip ── */}
        <div className="px-5 pb-6 pt-4" style={{ borderTop: "1px solid rgba(139,92,246,0.15)" }}>
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(14px)",
            }}
          >
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #60a5fa, #2563eb)" }}
            >
              CP
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "#e2e8f0" }}>Admin User</p>
              <p className="text-[10px]" style={{ color: "#94a3b8" }}>Super Admin</p>
            </div>
            {/* Online dot */}
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: "#60a5fa", boxShadow: "0 0 6px #2563eb" }}
            />
          </div>
        </div>

        <style jsx>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.3; transform: scale(0.85); }
          }
          nav::-webkit-scrollbar { width: 4px; }
          nav::-webkit-scrollbar-track { background: transparent; }
          nav::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
          nav::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.5); }
        `}</style>
      </motion.aside>
    </>
  );
};

export default Sidebar;
