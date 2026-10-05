import React, { useState } from "react";
import { CONFUSION_MATRICES } from "../lib/mlMetricsData";
import { FiCheckCircle, FiAlertTriangle, FiLayers, FiInfo } from "react-icons/fi";

const TABS = [
  { id: "pooled_lr", label: "Pooled LR" },
  { id: "pooled_rf", label: "Pooled RF" },
  { id: "uniswap_rf", label: "Uniswap (DEX)" },
  { id: "marketplace_lr", label: "Marketplace (Seaport)" },
  { id: "token_rf", label: "Token (USDT/USDC)" },
  { id: "aave_limitation", label: "Aave (Limitation)" },
];

export default function ConfusionMatrixViewer() {
  const [activeTab, setActiveTab] = useState("uniswap_rf");
  const data = CONFUSION_MATRICES[activeTab] || CONFUSION_MATRICES.uniswap_rf;

  const { matrix, metrics, observations, title, subtitle, modelType, features, testRecords, status } = data;

  // Actual Fail:
  // Pred Fail = TP (Caught Failures)
  // Pred Succ = FN (Missed Failures)
  const tp = matrix.actualFail.predFail;
  const fn = matrix.actualFail.predSucc;
  const totalActualFail = matrix.actualFail.total;

  // Actual Succ:
  // Pred Fail = FP (False Alarms)
  // Pred Succ = TN (True Successes)
  const fp = matrix.actualSucc.predFail;
  const tn = matrix.actualSucc.predSucc;
  const totalActualSucc = matrix.actualSucc.total;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/80 to-purple-950/20 p-6 backdrop-blur-xl shadow-xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <FiLayers className="h-5 w-5 text-purple-400" />
            <h3 className="text-xl font-bold text-white tracking-wide">
              50k Multi-Domain Confusion Matrices
            </h3>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Validated empirical test evaluations across 49,714 Polygon PoS transactions
          </p>
        </div>
        <span className="self-start md:self-auto rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
          {status}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-3">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Title & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <h4 className="text-base font-bold text-white">{title}</h4>
          <p className="text-xs text-purple-300/80">{subtitle}</p>
        </div>
        <div className="text-xs text-gray-400">
          Held-out test set: <span className="font-semibold text-gray-200">{testRecords.toLocaleString()} txs</span>
        </div>
      </div>

      {/* Confusion Matrix Table Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[500px] rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {/* Header row */}
            <div className="p-2 text-left font-bold text-gray-400">Actual \ Predicted</div>
            <div className="p-2 font-bold text-rose-300 bg-rose-500/10 rounded-lg border border-rose-500/20">
              Predicted FAILED
            </div>
            <div className="p-2 font-bold text-emerald-300 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              Predicted SUCCESS
            </div>

            {/* Row 1: Actual Failed */}
            <div className="flex flex-col justify-center rounded-lg bg-rose-500/10 p-3 text-left font-semibold text-rose-300 border border-rose-500/20">
              <span>Actual FAILED</span>
              <span className="text-[10px] text-gray-400">Total: {totalActualFail.toLocaleString()}</span>
            </div>

            {/* Cell 1,1: TP (Caught Failures) */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                Caught Failures (TP)
              </span>
              <span className="mt-1 text-2xl font-black text-emerald-300">{tp.toLocaleString()}</span>
              <span className="mt-1 text-[11px] text-gray-400">
                {totalActualFail > 0 ? `${((tp / totalActualFail) * 100).toFixed(1)}% caught` : "0%"}
              </span>
            </div>

            {/* Cell 1,2: FN (Missed Failures) */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-rose-400">
                Missed Failures (FN)
              </span>
              <span className="mt-1 text-2xl font-black text-rose-300">{fn.toLocaleString()}</span>
              <span className="mt-1 text-[11px] text-gray-400">
                {totalActualFail > 0 ? `${((fn / totalActualFail) * 100).toFixed(1)}% missed` : "0%"}
              </span>
            </div>

            {/* Row 2: Actual Success */}
            <div className="flex flex-col justify-center rounded-lg bg-emerald-500/10 p-3 text-left font-semibold text-emerald-300 border border-emerald-500/20">
              <span>Actual SUCCESS</span>
              <span className="text-[10px] text-gray-400">Total: {totalActualSucc.toLocaleString()}</span>
            </div>

            {/* Cell 2,1: FP (False Alarms) */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400">
                False Alarms (FP)
              </span>
              <span className="mt-1 text-2xl font-black text-amber-300">{fp.toLocaleString()}</span>
              <span className="mt-1 text-[11px] text-gray-400">
                {totalActualSucc > 0 ? `${((fp / totalActualSucc) * 100).toFixed(2)}% false alert` : "0%"}
              </span>
            </div>

            {/* Cell 2,2: TN (True Successes) */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-blue-500/30 bg-blue-950/20 p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-blue-400">
                True Success (TN)
              </span>
              <span className="mt-1 text-2xl font-black text-blue-300">{tn.toLocaleString()}</span>
              <span className="mt-1 text-[11px] text-gray-400">
                {totalActualSucc > 0 ? `${((tn / totalActualSucc) * 100).toFixed(1)}% accurate` : "0%"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
          <p className="text-[11px] font-medium text-gray-400">Failure Recall</p>
          <p className="mt-1 text-xl font-bold text-emerald-300">
            {(metrics.failureRecall * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
          <p className="text-[11px] font-medium text-gray-400">Failure Precision</p>
          <p className="mt-1 text-xl font-bold text-indigo-300">
            {(metrics.failurePrecision * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
          <p className="text-[11px] font-medium text-gray-400">Total Accuracy</p>
          <p className="mt-1 text-xl font-bold text-blue-300">
            {(metrics.accuracy * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
          <p className="text-[11px] font-medium text-gray-400">ROC-AUC</p>
          <p className="mt-1 text-xl font-bold text-purple-300">
            {metrics.rocAuc ? metrics.rocAuc.toFixed(3) : "—"}
          </p>
        </div>
      </div>

      {/* Observations Box */}
      <div className="flex items-start space-x-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-xs text-indigo-200">
        <FiInfo className="h-5 w-5 shrink-0 text-indigo-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Empirical Finding & Rationale:</p>
          <p className="text-gray-300 leading-relaxed">{observations}</p>
        </div>
      </div>
    </div>
  );
}
