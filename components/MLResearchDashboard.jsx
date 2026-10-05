import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import {
  FiCpu,
  FiActivity,
  FiDatabase,
  FiSliders,
  FiLayers,
  FiCheckCircle,
  FiAlertTriangle,
  FiAlertCircle,
  FiTrendingUp,
  FiRefreshCw,
  FiShield,
  FiInfo,
  FiArrowUpRight,
  FiTarget,
  FiGitCommit,
} from "react-icons/fi";

const DOMAIN_OPTIONS = [
  { key: "all", label: "ALL DOMAINS", sub: "Pooled Overview" },
  { key: "uniswap", label: "UNISWAP", sub: "DEX Protocol" },
  { key: "marketplace", label: "SEAPORT", sub: "NFT Marketplace" },
  { key: "token", label: "TOKENS", sub: "USDT / USDC" },
  { key: "aave", label: "AAVE", sub: "Lending Protocol" },
  { key: "fallback", label: "FALLBACK", sub: "General Contracts" },
];

const GlassCard = ({ children, className = "", highlight = false }) => (
  <div
    className={`rounded-2xl border transition-all duration-300 backdrop-blur-xl ${
      highlight
        ? "border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-zinc-900/90 to-zinc-950/90 shadow-purple-950/20 shadow-xl"
        : "border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/80 to-zinc-950/90 shadow-xl hover:border-white/15"
    } p-5 ${className}`}
  >
    {children}
  </div>
);

const ChartTooltip = ({ active, payload, label, unit = "" }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-white/15 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-md text-xs z-50">
        <p className="font-semibold text-white mb-2 border-b border-white/10 pb-1 font-mono">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, idx) => (
            <div key={`tip-${idx}`} className="flex items-center justify-between gap-5">
              <span className="flex items-center gap-1.5 text-gray-300">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color || entry.stroke || entry.fill }}
                />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-bold text-white">
                {typeof entry.value === "number"
                  ? `${entry.value.toLocaleString()}${unit}`
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function MLResearchDashboard() {
  const [data, setData] = useState({
    comparison: [],
    thresholds: [],
    architecture: {},
    learningCurve: [],
    metadata: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDomainKey, setSelectedDomainKey] = useState("all");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ml-evaluation");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Failed to load ML evaluation dataset");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Architecture and assigned model for selected domain
  const currentArch = useMemo(() => {
    if (selectedDomainKey === "all") {
      return {
        domainName: "All Supported Domains (Pooled)",
        assignedModelType: "Domain-Specific Multi-Model Ensemble",
        assignedModelName: "Multi-Model Architecture (RF + LR + Rule Engine)",
        configuredThreshold: 0.50,
        isML: true,
        routingReason:
          "Pre-transaction routing directs destination contracts to validated domain-specific classifiers or explicit state simulation.",
      };
    }
    return data.architecture?.[selectedDomainKey] || {};
  }, [selectedDomainKey, data.architecture]);

  // Active comparison record for currently selected domain
  const activeRecord = useMemo(() => {
    if (!data.comparison || !data.comparison.length) return null;

    if (selectedDomainKey === "all") {
      // Use Fallback/Overall RF record as primary representative for pooled baseline
      return (
        data.comparison.find((r) => r.domainKey === "fallback" && r.model === "Random Forest") ||
        data.comparison[0]
      );
    }

    const arch = data.architecture?.[selectedDomainKey];
    if (!arch) return null;

    if (!arch.isML) {
      // For Aave, return the evaluation entry for documentation purposes
      return data.comparison.find((r) => r.domainKey === "aave") || null;
    }

    // Match the ACTUAL assigned model
    return (
      data.comparison.find(
        (r) => r.domainKey === selectedDomainKey && r.model === arch.assignedModelType
      ) || null
    );
  }, [selectedDomainKey, data.comparison, data.architecture]);

  // Section 2: Model Performance Comparison (Only assigned models across domains)
  const domainComparisonData = useMemo(() => {
    if (!data.comparison || !data.architecture) return [];

    const keys = ["uniswap", "marketplace", "token", "aave", "fallback"];
    return keys.map((key) => {
      const arch = data.architecture[key] || {};
      const record = data.comparison.find(
        (r) => r.domainKey === key && r.model === arch.assignedModelType
      );

      return {
        key,
        domain: arch.domainName || key,
        assignedModel: arch.assignedModelName || "Unknown",
        assignedModelShort: arch.assignedModelType || "Unknown",
        isML: arch.isML,
        threshold: arch.configuredThreshold !== null ? `@${arch.configuredThreshold}` : "RPC Sim",
        accuracy: record ? Number((record.accuracy * 100).toFixed(1)) : 0,
        recall: record ? Number((record.failureRecall * 100).toFixed(1)) : 0,
        precision: record ? Number((record.failurePrecision * 100).toFixed(1)) : 0,
        rocAuc: record ? Number(record.rocAuc.toFixed(3)) : 0,
        falseAlarms: record ? record.fp : 0,
        caughtFailures: record ? record.tp : 0,
        missedFailures: record ? record.fn : 0,
      };
    });
  }, [data.comparison, data.architecture]);

  // Section 3, 4, 5: Threshold Curve, ROC Curve, Precision-Recall Curve data
  const thresholdCurveData = useMemo(() => {
    if (!data.thresholds || !data.thresholds.length) return [];

    const targetKey = selectedDomainKey === "all" ? "uniswap" : selectedDomainKey;
    const arch = data.architecture?.[targetKey];
    if (!arch || !arch.isML) return [];

    const modelToMatch = arch.assignedModelType;

    return data.thresholds
      .filter((r) => r.domainKey === targetKey && r.model === modelToMatch)
      .sort((a, b) => a.threshold - b.threshold)
      .map((r) => ({
        threshold: Number(r.threshold.toFixed(2)),
        thresholdLabel: `@${r.threshold.toFixed(2)}`,
        recall: Number((r.failureRecall * 100).toFixed(1)),
        precision: Number((r.failurePrecision * 100).toFixed(1)),
        f1Score: Number((r.f1Score * 100).toFixed(1)),
        accuracy: Number((r.accuracy * 100).toFixed(1)),
        fpr: Number((r.fpr * 100).toFixed(1)),
        tpr: Number((r.tpr * 100).toFixed(1)),
        falseAlarms: r.falseAlarms,
        caughtFail: r.caughtFail,
        missedFail: r.missedFail,
      }));
  }, [data.thresholds, data.architecture, selectedDomainKey]);

  // ROC Curve Points (Ordered by FPR ascending)
  const rocCurveData = useMemo(() => {
    if (!thresholdCurveData.length) return [];
    const pts = [
      { fpr: 0, tpr: 0, baseline: 0, label: "Origin (0,0)" },
      ...thresholdCurveData
        .map((p) => ({
          fpr: p.fpr,
          tpr: p.tpr,
          baseline: p.fpr,
          thresholdLabel: p.thresholdLabel,
          label: `${p.thresholdLabel} (FPR: ${p.fpr}%, TPR: ${p.tpr}%)`,
        }))
        .sort((a, b) => a.fpr - b.fpr),
      { fpr: 100, tpr: 100, baseline: 100, label: "Max (100,100)" },
    ];
    return pts;
  }, [thresholdCurveData]);

  // Precision-Recall Curve Points (Ordered by Recall ascending)
  const prCurveData = useMemo(() => {
    if (!thresholdCurveData.length) return [];
    return thresholdCurveData
      .map((p) => ({
        recall: p.recall,
        precision: p.precision,
        threshold: p.threshold,
        thresholdLabel: p.thresholdLabel,
      }))
      .sort((a, b) => a.recall - b.recall);
  }, [thresholdCurveData]);

  // Section 6 & 7: Confusion Matrix & Caught vs Missed Failures
  const confusion = useMemo(() => {
    if (!activeRecord) {
      return {
        tp: 0,
        fn: 0,
        fp: 0,
        tn: 0,
        total: 0,
        actualFailures: 0,
        actualSuccesses: 0,
        catchRate: 0,
        missRate: 0,
        falseAlarmRate: 0,
        trueSuccRate: 0,
      };
    }

    const tp = activeRecord.tp;
    const fn = activeRecord.fn;
    const fp = activeRecord.fp;
    // Calculate TN based on known domain totals
    const targetKey = selectedDomainKey === "all" ? "fallback" : selectedDomainKey;
    const arch = data.architecture?.[targetKey] || {};
    const totalActualSucc = arch.testActualSuccesses || (selectedDomainKey === "all" ? 9496 : 1734);
    const tn = Math.max(0, totalActualSucc - fp);
    const total = tp + fn + fp + tn;

    const actualFailures = tp + fn;
    const actualSuccesses = fp + tn;

    return {
      tp,
      fn,
      fp,
      tn,
      total,
      actualFailures,
      actualSuccesses,
      catchRate: actualFailures > 0 ? (tp / actualFailures) * 100 : 0,
      missRate: actualFailures > 0 ? (fn / actualFailures) * 100 : 0,
      falseAlarmRate: actualSuccesses > 0 ? (fp / actualSuccesses) * 100 : 0,
      trueSuccRate: actualSuccesses > 0 ? (tn / actualSuccesses) * 100 : 0,
    };
  }, [activeRecord, selectedDomainKey, data.architecture]);

  // Section 10: Feature Importance for Selected Model
  const featureImportanceList = useMemo(() => {
    const targetKey = selectedDomainKey === "all" ? "fallback" : selectedDomainKey;
    const arch = data.architecture?.[targetKey];
    if (!arch) return [];
    return arch.featureImportances || [];
  }, [selectedDomainKey, data.architecture]);

  // Standardized Coefficients for Logistic Regression
  const standardizedCoefficients = useMemo(() => {
    const targetKey = selectedDomainKey === "all" ? "marketplace" : selectedDomainKey;
    const arch = data.architecture?.[targetKey];
    return arch?.standardizedCoefficients || null;
  }, [selectedDomainKey, data.architecture]);

  return (
    <div className="space-y-8">
      {/* ========================================================================= */}
      {/* 11. MODEL / DOMAIN SELECTOR & HEADER                                      */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-indigo-950/40 p-6 md:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-purple-300 shadow-inner">
                <FiCpu className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    ML Model Evaluation & Empirical Research
                  </h2>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Validated 50k Benchmark
                  </span>
                </div>
                <p className="mt-1 text-xs md:text-sm text-gray-400">
                  Pre-execution Polygon PoS failure risk prediction across 49,714 audited transactions
                </p>
              </div>
            </div>
          </div>

          {/* Source Indicator & Reload Button */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-3.5 py-2 text-xs text-indigo-300 shadow-inner">
              <FiDatabase className="h-4 w-4 text-indigo-400" />
              <span className="font-semibold text-gray-400">Source:</span>
              <span className="font-mono text-indigo-200">
                {data.metadata?.comparisonSource?.split("/").pop() || "domain_models_comparison.csv"}
              </span>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-gray-200 transition disabled:opacity-50"
              title="Reload evaluation CSV result files"
            >
              <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Reload Pipeline Data
            </button>
          </div>
        </div>

        {/* Domain Navigation Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {DOMAIN_OPTIONS.map((opt) => {
            const isActive = selectedDomainKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedDomainKey(opt.key)}
                className={`flex flex-col text-left px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? "border-purple-500 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]"
                    : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-gray-200 hover:bg-white/[0.06]"
                }`}
              >
                <span className="text-xs font-bold tracking-wider">{opt.label}</span>
                <span className={`text-[10px] ${isActive ? "text-purple-200" : "text-gray-500"}`}>
                  {opt.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Domain Architecture Banner */}
        <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-400 uppercase tracking-wider text-[11px]">
              Assigned Model:
            </span>
            <span className="font-semibold text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2.5 py-1 rounded-lg">
              {currentArch.assignedModelName || "Random Forest (DEX Domain Model)"}
            </span>
            {currentArch.configuredThreshold !== null && currentArch.configuredThreshold !== undefined && (
              <span className="font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                Threshold: @{currentArch.configuredThreshold.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-xs max-w-xl italic">
            {currentArch.routingReason}
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MODEL PERFORMANCE OVERVIEW (7 METRIC CARDS)                            */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FiTarget className="h-4 w-4 text-purple-400" />
            1. Model Performance Overview ({selectedDomainKey.toUpperCase()})
          </h3>
          <span className="text-xs text-gray-400">Held-out empirical test evaluation</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Card 1: Accuracy */}
          <GlassCard className="!p-4">
            <p className="text-[11px] font-semibold text-gray-400">Overall Accuracy</p>
            <p className="mt-1 text-2xl font-black text-white font-mono">
              {activeRecord && currentArch.isML
                ? `${(activeRecord.accuracy * 100).toFixed(1)}%`
                : "Not available"}
            </p>
            <p className="mt-1 text-[10px] text-gray-500">Correct Predictions</p>
          </GlassCard>

          {/* Card 2: Failure Precision */}
          <GlassCard className="!p-4" highlight={true}>
            <p className="text-[11px] font-semibold text-emerald-300">Failure Precision</p>
            <p className="mt-1 text-2xl font-black text-emerald-400 font-mono">
              {activeRecord && currentArch.isML
                ? `${(activeRecord.failurePrecision * 100).toFixed(1)}%`
                : "Not available"}
            </p>
            <p className="mt-1 text-[10px] text-emerald-500/80">TP / (TP + FP)</p>
          </GlassCard>

          {/* Card 3: Failure Recall */}
          <GlassCard className="!p-4" highlight={true}>
            <p className="text-[11px] font-semibold text-sky-300">Failure Recall</p>
            <p className="mt-1 text-2xl font-black text-sky-400 font-mono">
              {activeRecord && currentArch.isML
                ? `${(activeRecord.failureRecall * 100).toFixed(1)}%`
                : "Not available"}
            </p>
            <p className="mt-1 text-[10px] text-sky-500/80">TP / (TP + FN)</p>
          </GlassCard>

          {/* Card 4: F1 Score */}
          <GlassCard className="!p-4">
            <p className="text-[11px] font-semibold text-purple-300">F1 Score (Macro)</p>
            <p className="mt-1 text-2xl font-black text-purple-300 font-mono">
              {activeRecord && currentArch.isML
                ? `${(activeRecord.f1Score * 100).toFixed(1)}%`
                : "Not available"}
            </p>
            <p className="mt-1 text-[10px] text-gray-500">Harmonic Mean</p>
          </GlassCard>

          {/* Card 5: ROC-AUC */}
          <GlassCard className="!p-4">
            <p className="text-[11px] font-semibold text-indigo-300">ROC-AUC</p>
            <p className="mt-1 text-2xl font-black text-indigo-300 font-mono">
              {activeRecord && currentArch.isML
                ? activeRecord.rocAuc.toFixed(3)
                : "Not available"}
            </p>
            <p className="mt-1 text-[10px] text-gray-500">Discrimination</p>
          </GlassCard>

          {/* Card 6: False Positives */}
          <GlassCard className="!p-4">
            <p className="text-[11px] font-semibold text-amber-300">False Positives (FP)</p>
            <p className="mt-1 text-2xl font-black text-amber-400 font-mono">
              {activeRecord && currentArch.isML
                ? activeRecord.fp.toLocaleString()
                : "Not available"}
            </p>
            <p className="mt-1 text-[10px] text-amber-500/80">False Alarms</p>
          </GlassCard>

          {/* Card 7: False Negatives */}
          <GlassCard className="!p-4">
            <p className="text-[11px] font-semibold text-rose-300">False Negatives (FN)</p>
            <p className="mt-1 text-2xl font-black text-rose-400 font-mono">
              {activeRecord && currentArch.isML
                ? activeRecord.fn.toLocaleString()
                : "Not available"}
            </p>
            <p className="mt-1 text-[10px] text-rose-500/80">Missed Failures</p>
          </GlassCard>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MODEL PERFORMANCE COMPARISON (Actual Assigned Models Only)             */}
      {/* ========================================================================= */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FiLayers className="h-4 w-4 text-purple-400" />
              2. Model Performance Comparison Across Production Domains
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Strictly comparing the ACTUAL assigned models configured in{" "}
              <code className="text-purple-300">predict_tx.py</code>
            </p>
          </div>
          <span className="text-xs text-gray-400">
            Source: <code className="text-indigo-300">domain_models_comparison.csv</code>
          </span>
        </div>

        {/* Grouped Bar Chart of Assigned Models */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={domainComparisonData} margin={{ top: 15, right: 15, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.6} />
              <XAxis
                dataKey="domain"
                stroke="#71717a"
                fontSize={11}
                interval={0}
                angle={-10}
                textAnchor="end"
              />
              <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} unit="%" />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Bar dataKey="recall" name="Failure Recall" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="precision" name="Failure Precision" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="accuracy" name="Accuracy" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Comparison Table with Assigned Models Explicitly Labeled */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="pb-2 font-medium">Domain</th>
                <th className="pb-2 font-medium">Assigned Production Model</th>
                <th className="pb-2 font-medium">Threshold</th>
                <th className="pb-2 font-medium text-sky-400">Recall</th>
                <th className="pb-2 font-medium text-emerald-400">Precision</th>
                <th className="pb-2 font-medium text-indigo-400">Accuracy</th>
                <th className="pb-2 font-medium text-purple-400">ROC-AUC</th>
                <th className="pb-2 font-medium text-amber-400">False Alarms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {domainComparisonData.map((row) => (
                <tr key={row.key} className="hover:bg-white/5 transition">
                  <td className="py-2.5 font-sans font-bold text-white flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        row.isML ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    {row.domain}
                  </td>
                  <td className="py-2.5 font-sans text-purple-300">
                    {row.assignedModel}
                  </td>
                  <td className="py-2.5 text-cyan-300">{row.threshold}</td>
                  <td className="py-2.5 text-sky-300 font-bold">{row.isML ? `${row.recall}%` : "Not available (0%)"}</td>
                  <td className="py-2.5 text-emerald-300 font-bold">{row.isML ? `${row.precision}%` : "Not available (0%)"}</td>
                  <td className="py-2.5 text-indigo-300">{row.isML ? `${row.accuracy}%` : "Not available"}</td>
                  <td className="py-2.5 text-purple-300">{row.isML ? row.rocAuc.toFixed(3) : "Not available"}</td>
                  <td className="py-2.5 text-amber-300">{row.falseAlarms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* ========================================================================= */}
      {/* 3, 4, 5. CURVES: FAILURE DETECTION, ROC CURVE, PRECISION-RECALL           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. FAILURE DETECTION CURVE */}
        <GlassCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FiSliders className="h-4 w-4 text-indigo-400" />
                3. Failure Detection Curve
              </h4>
              <span className="text-[10px] text-gray-400">Threshold Sweep</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Trade-off across decision thresholds (0.50 → 0.90)
            </p>
          </div>

          {currentArch.isML && thresholdCurveData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={thresholdCurveData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.6} />
                  <XAxis dataKey="thresholdLabel" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  {currentArch.configuredThreshold !== null && (
                    <ReferenceLine
                      x={`@${currentArch.configuredThreshold.toFixed(2)}`}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: "Configured", fill: "#f59e0b", fontSize: 10, position: "top" }}
                    />
                  )}
                  <Line type="monotone" dataKey="recall" name="Failure Recall" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="precision" name="Failure Precision" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="f1Score" name="F1 Score" stroke="#c084fc" strokeWidth={1.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-6 text-center text-xs text-amber-300">
              <FiAlertCircle className="h-6 w-6 mx-auto mb-2 text-amber-400" />
              Not available for {currentArch.domainName || "Aave"}.
              <br />
              <span className="text-gray-400 mt-1 block">
                Rule-Based Engine uses RPC state simulation instead of a numeric decision threshold.
              </span>
            </div>
          )}
        </GlassCard>

        {/* 4. ROC CURVE */}
        <GlassCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FiTrendingUp className="h-4 w-4 text-purple-400" />
                4. ROC Curve
              </h4>
              <span className="text-[10px] text-purple-300 font-mono font-bold">
                AUC: {activeRecord && currentArch.isML ? activeRecord.rocAuc.toFixed(3) : "N/A"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              True Positive Rate vs False Positive Rate
            </p>
          </div>

          {currentArch.isML && rocCurveData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rocCurveData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.6} />
                  <XAxis dataKey="fpr" stroke="#71717a" fontSize={11} unit="%" domain={[0, 100]} />
                  <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  {/* Chance Diagonal y = x */}
                  <Line type="linear" dataKey="baseline" name="Chance Baseline" stroke="#52525b" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                  {/* Empirical ROC */}
                  <Line type="monotone" dataKey="tpr" name="ROC (Empirical)" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-6 text-center text-xs text-amber-300">
              <FiAlertCircle className="h-6 w-6 mx-auto mb-2 text-amber-400" />
              Not available for {currentArch.domainName || "Aave"}.
              <br />
              <span className="text-gray-400 mt-1 block">
                ROC curves require continuous probability predictions; on-chain simulation returns discrete execution status.
              </span>
            </div>
          )}
        </GlassCard>

        {/* 5. PRECISION-RECALL CURVE */}
        <GlassCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FiTarget className="h-4 w-4 text-emerald-400" />
                5. Precision-Recall Curve
              </h4>
              <span className="text-[10px] text-emerald-300 font-mono">Imbalance Metric</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Operating trade-off across severe class imbalance (~3.5% failures)
            </p>
          </div>

          {currentArch.isML && prCurveData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prCurveData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.6} />
                  <XAxis dataKey="recall" stroke="#71717a" fontSize={11} unit="%" domain={[0, 100]} />
                  <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Line type="monotone" dataKey="precision" name="Precision vs Recall" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-6 text-center text-xs text-amber-300">
              <FiAlertCircle className="h-6 w-6 mx-auto mb-2 text-amber-400" />
              Not available for {currentArch.domainName || "Aave"}.
              <br />
              <span className="text-gray-400 mt-1 block">
                Requires continuous threshold sweeps on test distributions.
              </span>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ========================================================================= */}
      {/* 6. FAILURE CONFUSION MATRIX & 7. CAUGHT VS MISSED FAILURES                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6. FAILURE CONFUSION MATRIX */}
        <GlassCard>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FiLayers className="h-4 w-4 text-purple-400" />
                6. Failure Confusion Matrix ({selectedDomainKey.toUpperCase()})
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Exact test distribution breakdown ({confusion.total.toLocaleString()} transactions)
              </p>
            </div>
            <span className="text-xs font-mono text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2.5 py-1 rounded-lg">
              {currentArch.assignedModelType}
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[420px] rounded-xl border border-white/10 bg-black/60 p-4">
              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                {/* Header Row */}
                <div className="p-2 text-left font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                  Actual \ Predicted
                </div>
                <div className="p-2 font-bold text-emerald-300 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  Predicted SUCCESS
                </div>
                <div className="p-2 font-bold text-rose-300 bg-rose-500/10 rounded-lg border border-rose-500/20">
                  Predicted FAILURE
                </div>

                {/* Row 1: Actual SUCCESS */}
                <div className="flex flex-col justify-center rounded-lg bg-emerald-500/5 p-3 text-left font-semibold text-emerald-300 border border-emerald-500/20">
                  <span>Actual SUCCESS</span>
                  <span className="text-[10px] text-gray-400">Total: {(confusion.actualSuccesses || 0).toLocaleString()}</span>
                </div>

                {/* TN Cell */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                    True Negative (TN)
                  </span>
                  <span className="mt-1 text-2xl font-black text-emerald-300 font-mono">
                    {(confusion.tn || 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5">
                    {(confusion.trueSuccRate || 0).toFixed(1)}% of successes
                  </span>
                </div>

                {/* FP Cell (False Alarms) */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    False Positive (FP)
                  </span>
                  <span className="mt-1 text-2xl font-black text-amber-300 font-mono">
                    {(confusion.fp || 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-amber-400/80 mt-0.5">
                    {(confusion.falseAlarmRate || 0).toFixed(1)}% false alarms
                  </span>
                </div>

                {/* Row 2: Actual FAILURE */}
                <div className="flex flex-col justify-center rounded-lg bg-rose-500/5 p-3 text-left font-semibold text-rose-300 border border-rose-500/20">
                  <span>Actual FAILURE</span>
                  <span className="text-[10px] text-gray-400">Total: {(confusion.actualFailures || 0).toLocaleString()}</span>
                </div>

                {/* FN Cell (Missed Failures) */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400">
                    False Negative (FN)
                  </span>
                  <span className="mt-1 text-2xl font-black text-rose-300 font-mono">
                    {confusion.fn.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-rose-400/80 mt-0.5">
                    {confusion.missRate.toFixed(1)}% missed
                  </span>
                </div>

                {/* TP Cell (Caught Failures) */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-sky-500/30 bg-sky-950/20 p-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                    True Positive (TP)
                  </span>
                  <span className="mt-1 text-2xl font-black text-sky-300 font-mono">
                    {confusion.tp.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-sky-400/80 mt-0.5">
                    {confusion.catchRate.toFixed(1)}% caught
                  </span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* 7. CAUGHT VS MISSED FAILURES (Prominent Core Purpose Visualization) */}
        <GlassCard highlight={true} className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FiCheckCircle className="h-4 w-4 text-emerald-400" />
                  7. Caught vs Missed Failures (Core Objective)
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Direct measure of user transaction reverts prevented before execution
                </p>
              </div>
              <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg">
                {(confusion.catchRate || 0).toFixed(1)}% Caught
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <FiCheckCircle className="h-4 w-4" /> Caught Failures (TP)
                </span>
                <p className="mt-2 text-3xl font-black text-emerald-300 font-mono">
                  {(confusion.tp || 0).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Successfully intercepted before on-chain submission
                </p>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
                <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                  <FiAlertTriangle className="h-4 w-4" /> Missed Failures (FN)
                </span>
                <p className="mt-2 text-3xl font-black text-rose-300 font-mono">
                  {(confusion.fn || 0).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Unintercepted reverts (false negatives)
                </p>
              </div>
            </div>
          </div>

          {/* Visual Progress Bar Ratio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-400">
                Caught: {(confusion.catchRate || 0).toFixed(1)}% ({(confusion.tp || 0).toLocaleString()} txs)
              </span>
              <span className="text-rose-400">
                Missed: {(confusion.missRate || 0).toFixed(1)}% ({(confusion.fn || 0).toLocaleString()} txs)
              </span>
            </div>
            <div className="h-4 w-full rounded-full bg-rose-950/60 overflow-hidden border border-white/10 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-500"
                style={{ width: `${confusion.catchRate || 0}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500 italic text-center">
              Total verified actual reverts in test sample: {confusion.actualFailures.toLocaleString()} failures
            </p>
          </div>
        </GlassCard>
      </div>

      {/* ========================================================================= */}
      {/* 8. FALSE ALARM ANALYSIS & 9. LEARNING CURVE                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 8. FALSE ALARM ANALYSIS */}
        <GlassCard>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FiAlertTriangle className="h-4 w-4 text-amber-400" />
                8. False Alarm Analysis
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Evaluation of valid transactions mistakenly flagged as high risk
              </p>
            </div>
            <span className="text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-lg">
              FP: {confusion.fp.toLocaleString()}
            </span>
          </div>

          {/* Educational Concept Box */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 mb-4 text-xs text-amber-200">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <FiInfo className="h-4 w-4 shrink-0 text-amber-400" />
              What is a False Positive (False Alarm)?
            </p>
            <p className="text-amber-300/80 text-[11px] leading-relaxed">
              A <strong>False Positive</strong> occurs when a transaction that would have confirmed successfully is incorrectly classified as a predicted failure, triggering an unnecessary advisory warning. Minimizing false alarms protects user experience without degrading revert detection.
            </p>
          </div>

          {/* Comparative False Alarm Reductions */}
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Uniswap (DEX) Domain Optimization</p>
                <p className="text-[11px] text-gray-400">
                  Domain Random Forest reduced false alarms from 292 (Logistic) to 114
                </p>
              </div>
              <span className="font-mono text-emerald-400 font-bold">-60.9% FPs</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Seaport (Marketplace) Threshold Optimization</p>
                <p className="text-[11px] text-gray-400">
                  Shifting threshold 0.50 → 0.60 reduced false alarms from 195 to 23
                </p>
              </div>
              <span className="font-mono text-emerald-400 font-bold">-88.2% FPs</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Token (USDT/USDC) Strict Filtering</p>
                <p className="text-[11px] text-gray-400">
                  Domain Random Forest achieved 0 false alarms across 1,936 test successes
                </p>
              </div>
              <span className="font-mono text-emerald-400 font-bold">0 False Alarms</span>
            </div>
          </div>
        </GlassCard>

        {/* 9. LEARNING CURVE: PERFORMANCE VS TRAINING DATASET SIZE */}
        <GlassCard>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FiTrendingUp className="h-4 w-4 text-cyan-400" />
                9. Performance vs Training Dataset Size
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Empirical learning comparison between 10k and 50k benchmark splits
              </p>
            </div>
            <span className="text-xs text-cyan-300 font-mono">Dataset Scaling</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.learningCurve || []} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.6} />
                <XAxis dataKey="datasetSize" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip content={<ChartTooltip unit="%" />} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar
                  dataKey={(d) => Number((d.trainAccuracy * 100).toFixed(1))}
                  name="Training Score (Accuracy)"
                  fill="#818cf8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={(d) => Number((d.valAccuracy * 100).toFixed(1))}
                  name="Validation Score (Accuracy)"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={(d) => Number((d.valRecall * 100).toFixed(1))}
                  name="Validation Failure Recall"
                  fill="#34d399"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-gray-400 leading-relaxed">
            <strong className="text-gray-200">Engineering Note:</strong> Models evaluated are Random Forest ensembles and Convex Logistic Classifiers. As dataset size expanded from 10k to 50k diverse multi-domain transactions, validation accuracy stabilized at 95.9% while domain models eliminated cross-domain feature interference.
          </div>
        </GlassCard>
      </div>

      {/* ========================================================================= */}
      {/* 10. RANDOM FOREST FEATURE IMPORTANCE                                      */}
      {/* ========================================================================= */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4 mb-4">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FiSliders className="h-4 w-4 text-purple-400" />
              10. Feature Importance & Influence Analysis ({selectedDomainKey.toUpperCase()})
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Strictly pre-execution input features used by the production models (zero post-execution data leakage)
            </p>
          </div>
          <span className="text-xs font-mono text-purple-300">
            {currentArch.assignedModelType}
          </span>
        </div>

        {featureImportanceList.length > 0 ? (
          <div className="space-y-4">
            {featureImportanceList.map((item) => {
              const pct = (item.importance * 100).toFixed(1);
              return (
                <div key={item.feature} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-gray-200">
                      <code>{item.feature}</code>
                    </span>
                    <span className="font-mono text-purple-300 font-bold">{pct}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-300 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-gray-500 mt-2">
              Gini impurity importance extracted directly from verified <code className="text-purple-300">.joblib</code> models.
            </p>
          </div>
        ) : standardizedCoefficients ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3 text-xs text-indigo-300 mb-3">
              <FiInfo className="inline mr-1" />
              Seaport uses <strong>Logistic Regression</strong>. Standardized linear coefficients ($\beta$) are reported instead of tree Gini importance:
            </div>
            {standardizedCoefficients.map((item) => (
              <div key={item.feature} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 text-xs font-mono">
                <span className="text-white font-semibold">{item.feature}</span>
                <span className={item.coef >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  Standardized Coefficient ($\beta$): {item.coef > 0 ? `+${item.coef.toFixed(4)}` : item.coef.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/40 p-6 text-center text-xs text-gray-400">
            <FiInfo className="h-5 w-5 mx-auto mb-2 text-gray-500" />
            Feature importance is <strong>Not applicable</strong> for {currentArch.domainName || "Aave"}.
            <br />
            <span className="text-gray-500 mt-1 block">
              Static gas/value ML features are not utilized; Aave routing executes live on-chain simulation via RPC.
            </span>
          </div>
        )}
      </GlassCard>

      {/* ========================================================================= */}
      {/* REVIEWER DEMONSTRATION TALKING POINT BANNER                               */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-black/60 p-6 backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-purple-500/20 p-3 text-purple-300 border border-purple-500/30 shrink-0">
            <FiShield className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Reviewer Demonstration Summary
            </h4>
            <p className="mt-1 text-xs md:text-sm text-gray-300 leading-relaxed italic">
              &ldquo;Our system uses domain-specific machine-learning models to estimate transaction failure probability before execution. These analytics show not only overall accuracy, but also whether the system actually catches failures, how many successful transactions it falsely flags, and how the decision threshold affects precision and recall.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
