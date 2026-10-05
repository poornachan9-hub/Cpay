import React from "react";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiActivity, FiShield } from "react-icons/fi";

export default function TransactionRiskPanel({ prediction, loading, onRecheck }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 backdrop-blur-md animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
          <span className="text-sm font-medium text-purple-200">
            Evaluating pre-transaction execution risk via domain models...
          </span>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return null;
  }

  const {
    domain,
    failure_probability,
    risk_level,
    model_used,
    warning,
    disclaimer,
    requires_onchain_state,
  } = prediction;

  // Visual styles for 3-tier risk level
  const riskStyles = {
    LOW: {
      badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
      accent: "text-emerald-400",
      bg: "from-emerald-950/20 via-zinc-900/40 to-emerald-950/10",
      border: "border-emerald-500/30",
      icon: FiCheckCircle,
      label: "LOW RISK",
    },
    MEDIUM: {
      badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
      accent: "text-amber-400",
      bg: "from-amber-950/25 via-zinc-900/40 to-amber-950/10",
      border: "border-amber-500/30",
      icon: FiInfo,
      label: requires_onchain_state ? "ATTENTION" : "MEDIUM RISK",
    },
    HIGH: {
      badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
      accent: "text-rose-400",
      bg: "from-rose-950/30 via-zinc-900/40 to-rose-950/15",
      border: "border-rose-500/40",
      icon: FiAlertTriangle,
      label: "HIGH RISK",
    },
  };

  const style = riskStyles[risk_level] || riskStyles.LOW;
  const RiskIcon = style.icon;

  return (
    <div
      className={`rounded-2xl border ${style.border} bg-gradient-to-br ${style.bg} p-5 backdrop-blur-xl shadow-lg transition-all duration-300`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2">
          <FiShield className="h-5 w-5 text-indigo-400" />
          <span className="text-sm font-semibold tracking-wide text-gray-200">
            PRE-TRANSACTION RISK RADAR
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-gray-400">Domain:</span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-indigo-200">
            {domain || "Standard"}
          </span>
          <span
            className={`rounded-md border px-2.5 py-0.5 text-xs font-bold tracking-wider ${style.badge}`}
          >
            {style.label}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Metric 1: Failure Probability */}
        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <p className="text-xs font-medium text-gray-400">Estimated Failure Probability</p>
          <div className="mt-1 flex items-baseline space-x-2">
            {requires_onchain_state ? (
              <span className="text-lg font-bold text-amber-300">Requires State Check</span>
            ) : (
              <>
                <span className={`text-2xl font-black ${style.accent}`}>
                  {failure_probability !== null && failure_probability !== undefined
                    ? `${(failure_probability * 100).toFixed(1)}%`
                    : "—"}
                </span>
                <span className="text-xs text-gray-400">
                  {prediction.threshold ? `(Threshold: ${prediction.threshold})` : ""}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Metric 2: Model Used */}
        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <p className="text-xs font-medium text-gray-400">Evaluated Model Pipeline</p>
          <p className="mt-1 text-sm font-medium text-gray-200 truncate" title={model_used}>
            {model_used || "Domain Fallback Classifier"}
          </p>
          <p className="text-[11px] text-gray-500">Validated 50k multi-domain model</p>
        </div>
      </div>

      {/* Warning & Explanation */}
      <div className="mt-3 flex items-start space-x-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-gray-300">
        <RiskIcon className={`h-4 w-4 shrink-0 mt-0.5 ${style.accent}`} />
        <div className="space-y-1">
          <p>{warning}</p>
        </div>
      </div>

      {/* Advisory Disclaimer */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-gray-400">
        <span>⚠️ {disclaimer || "Prediction is advisory — does not prevent transaction submission."}</span>
        {onRecheck && (
          <button
            type="button"
            onClick={onRecheck}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 ml-2"
          >
            Re-evaluate
          </button>
        )}
      </div>
    </div>
  );
}
