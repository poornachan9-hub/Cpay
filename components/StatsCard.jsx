import { memo } from "react";
import { motion } from "framer-motion";

// KPI card — exact CryptoPay 4-variant strip
const GRADIENTS = [
  "linear-gradient(135deg, #60a5fa, #2563eb)",           // blue (index 0)
  "linear-gradient(135deg, #60a5fa, #38bdf8)",           // blue-cyan (index 1)
  "linear-gradient(135deg, #0f172a, #1d4ed8, #38bdf8)", // dark-blue-cyan (index 2)
  "linear-gradient(135deg, #0f172a, #38bdf8)",           // dark-cyan (index 3)
];

const ICON_BG   = ["rgba(139,92,246,0.15)", "rgba(6,182,212,0.15)", "rgba(236,72,153,0.12)", "rgba(16,185,129,0.12)"];
const ICON_COLOR = ["#a78bfa",              "#38bdf8",               "#f472b6",               "#34d399"             ];

const StatsCard = memo(function StatsCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = "positive",
  loading = false,
  className = "",
  onClick = null,
  accentIndex = 0,
}) {
  const idx   = accentIndex % 4;
  const isPos = changeType === "positive";

  return (
    <motion.div
      whileHover={{ y: -2, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      className={`group relative overflow-hidden rounded-[14px] transition-all duration-200 ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{
        background: "linear-gradient(180deg, rgba(18,18,34,0.50), rgba(10,10,24,0.30))",
        backdropFilter: "blur(22px) saturate(150%)",
        WebkitBackdropFilter: "blur(22px) saturate(150%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 18px 40px rgba(4,6,20,0.22)",
      }}
      onClick={onClick}
    >
      {/* 2px gradient top stripe — the CryptoPay signature */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[14px]"
        style={{ background: GRADIENTS[idx] }}
      />

      <div className="relative z-10 p-[18px] pt-[22px]">
        {/* Label + icon row */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>
            {title}
          </span>
          {Icon && (
            <div
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[6px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
              style={{ background: ICON_BG[idx], color: ICON_COLOR[idx] }}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Value */}
        {loading ? (
          <div className="h-8 w-24 rounded-lg animate-pulse mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }} />
        ) : (
          <div
            className="text-[26px] font-bold leading-none mb-1.5"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#e2e8f0" }}
          >
            {value}
          </div>
        )}

        {/* Change chip */}
        {change && !loading && (
          <div
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: isPos ? "rgba(96,165,250,0.12)" : "rgba(239,68,68,0.12)",
              color:      isPos ? "#93c5fd"                : "#f87171",
              border:    `1px solid ${isPos ? "rgba(96,165,250,0.22)" : "rgba(239,68,68,0.22)"}`,
            }}
          >
            {isPos ? "↑" : "↓"} {change}
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default StatsCard;
