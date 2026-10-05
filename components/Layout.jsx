import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWalletClient } from "wagmi";
import { FiMenu, FiBell, FiSearch } from "react-icons/fi";
import { motion } from "framer-motion";
import Sidebar from "./Sidebar";
import toast, { Toaster } from "react-hot-toast";

const Layout = ({ children, title = "CryptoPay Gateway" }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = () => setSidebarOpen(desktopQuery.matches);
    syncSidebar();
    desktopQuery.addEventListener("change", syncSidebar);
    return () => desktopQuery.removeEventListener("change", syncSidebar);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const handleWalletAuth = async () => {
      if (isConnected && address && walletClient) {
        const existing = localStorage.getItem("cropcoin_token");
        if (existing) return;
        try {
          const candidateBases = [
            "/api/auth",
            process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth` : null,
            "http://127.0.0.1:4000/auth",
            "http://localhost:4000/auth",
          ].filter(Boolean);

          let nonce = null;
          let activeBase = null;

          for (const base of candidateBases) {
            try {
              const nonceRes = await fetch(`${base}/nonce?address=${address}`);
              if (nonceRes.ok) {
                const data = await nonceRes.json();
                if (data.nonce) {
                  nonce = data.nonce;
                  activeBase = base;
                  break;
                }
              }
            } catch (_) {}
          }

          if (!nonce || !activeBase) {
            throw new Error("Authentication service unreachable");
          }

          if (isCancelled) return;

          const sig = await walletClient.signMessage({
            message: `Sign this message to log in to CryptoPay.\n\nNonce: ${nonce}`,
          });

          if (isCancelled) return;

          const verifyRes = await fetch(`${activeBase}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, signature: sig }),
          });

          if (!verifyRes.ok) throw new Error("Signature verification failed");
          const { token } = await verifyRes.json();
          if (token && !isCancelled) {
            localStorage.setItem("cropcoin_token", token);
            toast.success("Wallet authenticated!");
          }
        } catch (err) {
          if (!isCancelled) {
            console.error("Wallet auth error:", err);
            if (err?.code === 4001 || err?.message?.toLowerCase().includes("user rejected") || err?.message?.toLowerCase().includes("rejected")) {
              toast.error("Signature request was cancelled.");
            } else {
              toast.error("Failed to authenticate wallet. Please try again.");
            }
          }
        }
      } else if (!isConnected) {
        localStorage.removeItem("cropcoin_token");
      }
    };
    handleWalletAuth();
    return () => {
      isCancelled = true;
    };
  }, [isConnected, address, walletClient]);

  const pageVariants = { initial: { opacity: 0, y: 20 }, in: { opacity: 1, y: 0 }, out: { opacity: 0, y: -20 } };
  const pageTransition = { type: "tween", ease: "anticipate", duration: 0.4 };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#02040b" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: "rgba(96,165,250,0.2)" }} />
            <div className="absolute inset-0 border-4 border-transparent rounded-full animate-spin" style={{ borderTopColor: "#60a5fa" }} />
          </div>
          <span className="text-base font-semibold" style={{
            fontFamily: "'Space Grotesk', sans-serif",
            background: "linear-gradient(135deg, #60a5fa, #2563eb)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Loading CryptoPay...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: "#02040b" }}>

      {/* ── CryptoPay glow blobs ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute rounded-full" style={{
          width: 520, height: 520, top: 20, left: 110,
          background: "rgba(37,99,235,0.10)",
          filter: "blur(110px)", opacity: 0.30, mixBlendMode: "screen",
        }} />
        <div className="absolute rounded-full" style={{
          width: 440, height: 440, bottom: -40, right: 80,
          background: "rgba(30,64,175,0.08)",
          filter: "blur(110px)", opacity: 0.25, mixBlendMode: "screen",
        }} />
        <div className="absolute rounded-full" style={{
          width: 340, height: 340, top: 160, right: 320,
          background: "rgba(14,165,233,0.06)",
          filter: "blur(110px)", opacity: 0.22, mixBlendMode: "screen",
        }} />
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
            color: "#e2e8f0",
            border: "1px solid rgba(96,165,250,0.25)",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(37,99,235,0.2)",
          },
        }}
      />

      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0 relative" style={{ zIndex: 1 }}>

        {/* ── Header ── */}
        <header
          className="sticky top-0 z-30 overflow-hidden"
          style={{
            height: 72,
            background: "linear-gradient(180deg, rgba(14,14,28,0.55), rgba(8,8,20,0.30))",
            backdropFilter: "blur(24px) saturate(155%)",
            WebkitBackdropFilter: "blur(24px) saturate(155%)",
            borderBottom: "1px solid rgba(139,92,246,0.15)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between h-full px-7">
            {/* Left */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2.5 rounded-xl border border-white/8 transition-all"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <FiMenu className="h-5 w-5 text-[#94a3b8]" />
              </button>

              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold leading-tight"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: "linear-gradient(135deg, #60a5fa, #2563eb)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {title}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-[6px] h-[6px] rounded-full ${isConnected ? "bg-blue-400" : "bg-red-400"} animate-pulse`} />
                  {isConnected ? (
                    <span className="text-xs" style={{ color: "#94a3b8" }}>
                      Connected:{" "}
                      <span
                        className="font-mono px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(96,165,250,0.1)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.2)" }}
                      >
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </span>
                    </span>
                  ) : (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
                    >
                      <span
                        className="inline-block w-[5px] h-[5px] rounded-full mr-1.5 align-middle"
                        style={{ background: "#f87171", boxShadow: "0 0 6px #f87171" }}
                      />
                      Wallet not connected
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div
                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl min-w-[220px] transition-all duration-200 focus-within:ring-1"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(16px)",
                  "--tw-ring-color": "rgba(139,92,246,0.4)",
                }}
              >
                <FiSearch className="h-[14px] w-[14px] flex-shrink-0" style={{ color: "#475569" }} />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  className="bg-transparent border-none outline-none text-sm w-full"
                  style={{ color: "#e2e8f0" }}
                />
              </div>

              {/* Bell */}
              <button
                className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#94a3b8",
                }}
              >
                <FiBell className="h-4 w-4 text-white" />
                <span
                  className="absolute -top-1 -right-1 w-[8px] h-[8px] rounded-full border-2"
                  style={{ background: "#f59e0b", boxShadow: "0 0 8px #f59e0b", borderColor: "#02040b" }}
                />
              </button>

              {/* Connect Wallet */}
              <div className="connect-wallet-container">
                <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
              </div>
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 p-7">
          <motion.div
            initial="initial" animate="in" exit="out"
            variants={pageVariants} transition={pageTransition}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* ── Global styles ── */}
      <style jsx global>{`
        /* Connect Wallet button — CryptoPay blue/purple gradient */
        .connect-wallet-container button {
          background: linear-gradient(135deg, #60a5fa, #2563eb) !important;
          border: none !important;
          border-radius: 10px !important;
          padding: 9px 20px !important;
          font-weight: 600 !important;
          color: #fff !important;
          font-family: 'Space Grotesk', sans-serif !important;
          font-size: 13px !important;
          box-shadow: 0 0 20px rgba(96,165,250,0.35) !important;
          transition: all 0.2s ease !important;
        }
        .connect-wallet-container button:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 28px rgba(96,165,250,0.5) !important;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #02040b; }
        ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.5); }

        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
};

export default Layout;
