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
  Cell,
} from "recharts";
import {
  FiActivity,
  FiDatabase,
  FiTrendingUp,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiSliders,
  FiLayers,
} from "react-icons/fi";

const DOMAIN_ORDER = ["uniswap", "marketplace", "token", "aave", "fallback"];
const DOMAIN_LABELS = {
  uniswap: "Uniswap (DEX)",
  marketplace: "Seaport (Marketplace)",
  token: "Tokens (USDT/USDC)",
  aave: "Aave (Lending)",
  fallback: "Fallback (All Domains)",
};

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-md text-xs">
        <p className="font-semibold text-white mb-1.5 border-b border-white/10 pb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={`tip-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.stroke || entry.fill }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-medium text-gray-200">
                {formatter ? formatter(entry.value, entry.name) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function MLPerformanceEvaluation() {
  const [data, setData] = useState({ comparison: [], thresholds: [], metadata: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState("uniswap");
  const [selectedModel, setSelectedModel] = useState("Random Forest");

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

  // 1. Failure Recall by Domain
  const recallByDomainData = useMemo(() => {
    if (!data.comparison || !data.comparison.length) return [];
    const grouped = {};
    for (const key of DOMAIN_ORDER) {
      grouped[key] = { domainKey: key, domain: DOMAIN_LABELS[key] || key };
    }
    data.comparison.forEach((row) => {
      const key = row.domainKey || "fallback";
      if (!grouped[key]) grouped[key] = { domainKey: key, domain: row.domain };
      if (row.model === "Random Forest") {
        grouped[key]["Random Forest"] = Number((row.failureRecall * 100).toFixed(1));
      } else if (row.model === "Logistic Regression") {
        grouped[key]["Logistic Regression"] = Number((row.failureRecall * 100).toFixed(1));
      }
    });
    return Object.values(grouped);
  }, [data.comparison]);

  // 2. Precision vs Recall by Domain (Grouped per model or focused on production RF)
  const precisionVsRecallData = useMemo(() => {
    if (!data.comparison || !data.comparison.length) return [];
    return data.comparison
      .filter((row) => row.model === selectedModel)
      .map((row) => ({
        domain: row.domain,
        recall: Number((row.failureRecall * 100).toFixed(1)),
        precision: Number((row.failurePrecision * 100).toFixed(1)),
        accuracy: Number((row.accuracy * 100).toFixed(1)),
      }));
  }, [data.comparison, selectedModel]);

  // 3. False Alarms (FP) by Domain
  const falseAlarmsData = useMemo(() => {
    if (!data.comparison || !data.comparison.length) return [];
    const grouped = {};
    for (const key of DOMAIN_ORDER) {
      grouped[key] = { domainKey: key, domain: DOMAIN_LABELS[key] || key };
    }
    data.comparison.forEach((row) => {
      const key = row.domainKey || "fallback";
      if (!grouped[key]) grouped[key] = { domainKey: key, domain: row.domain };
      if (row.model === "Random Forest") {
        grouped[key]["Random Forest"] = row.fp;
      } else if (row.model === "Logistic Regression") {
        grouped[key]["Logistic Regression"] = row.fp;
      }
    });
    return Object.values(grouped);
  }, [data.comparison]);

  // 4. Caught vs Missed Failures (Stacked TP vs FN)
  const caughtVsMissedData = useMemo(() => {
    if (!data.comparison || !data.comparison.length) return [];
    return data.comparison
      .filter((row) => row.model === selectedModel)
      .map((row) => ({
        domain: row.domain,
        caught: row.tp,
        missed: row.fn,
        total: row.testFailures,
        catchRate: row.testFailures > 0 ? Number(((row.tp / row.testFailures) * 100).toFixed(1)) : 0,
      }));
  }, [data.comparison, selectedModel]);

  // 5. Threshold Trade-off (Dynamic series across thresholds 0.50 - 0.90)
  const thresholdTradeoffData = useMemo(() => {
    if (!data.thresholds || !data.thresholds.length) return [];
    return data.thresholds
      .filter((row) => row.domainKey === selectedDomain && row.model === selectedModel)
      .sort((a, b) => a.threshold - b.threshold)
      .map((row) => ({
        threshold: `@${row.threshold.toFixed(2)}`,
        recall: Number((row.failureRecall * 100).toFixed(1)),
        precision: Number((row.failurePrecision * 100).toFixed(1)),
        falseAlarms: row.falseAlarms,
        caughtFail: row.caughtFail,
        missedFail: row.missedFail,
        accuracy: Number((row.accuracy * 100).toFixed(1)),
      }));
  }, [data.thresholds, selectedDomain, selectedModel]);

  return (
    <div className="space-y-6">
      {/* Section Header with Data Source Indicator */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/80 to-purple-950/20 p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                <FiActivity className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">
                  ML Performance / Evaluation
                </h3>
                <p className="mt-0.5 text-xs text-gray-400">
                  Data-driven evaluation of domain-specific Polygon failure models from pipeline result files
                </p>
              </div>
            </div>
          </div>

          {/* Evaluation Data Indicator */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-1.5 text-xs text-emerald-300 shadow-inner">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold">Evaluation Data:</span>
              <span className="font-mono text-[11px] text-emerald-200">
                {data.metadata?.comparisonSource ? (
                  data.metadata.comparisonSource.split("/").pop()
                ) : (
                  "domain_models_comparison.csv"
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
              title="Reload evaluation CSV files from server"
            >
              <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Reload Files
            </button>
          </div>
        </div>

        {/* Evaluation Metadata Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <FiDatabase className="h-3.5 w-3.5 text-purple-400" />
            <span>
              Primary Source:{" "}
              <code className="text-purple-300 bg-white/5 px-1.5 py-0.5 rounded">
                {data.metadata?.comparisonSource || "polygon-ml-dataset/results_50000/domain_models"}
              </code>
            </span>
            {data.metadata?.thresholdSource && (
              <span className="hidden md:inline">
                · Thresholds:{" "}
                <code className="text-purple-300 bg-white/5 px-1.5 py-0.5 rounded">
                  {data.metadata.thresholdSource}
                </code>
              </span>
            )}
          </div>

          {/* Model Filter Selector */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Model filter:</span>
            <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5">
              {["Random Forest", "Logistic Regression"].map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                    selectedModel === m
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && !data.comparison.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-sm text-gray-400">
          <FiRefreshCw className="h-6 w-6 animate-spin mx-auto text-purple-400 mb-2" />
          Dynamically loading evaluation CSV result files...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-sm text-rose-300 flex items-center gap-3">
          <FiAlertTriangle className="h-5 w-5 shrink-0" />
          <span>Error loading evaluation files: {error}</span>
        </div>
      ) : (
        <>
          {/* Top Row: Chart 1 & Chart 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Failure Recall by Domain */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FiTrendingUp className="h-4 w-4 text-cyan-400" />
                    Failure Recall by Domain
                  </h4>
                  <span className="text-[11px] text-gray-400">Higher is better</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Fraction of real transaction reverts successfully caught by the model
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recallByDomainData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="domain"
                      stroke="#71717a"
                      fontSize={11}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} unit="%" />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(v) => `${Number(v).toFixed(1)}%`}
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="Random Forest" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Logistic Regression" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Precision vs Recall */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FiLayers className="h-4 w-4 text-purple-400" />
                    Precision vs Recall ({selectedModel})
                  </h4>
                  <span className="text-[11px] text-gray-400">Balance Metric</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Comparison between alert trustworthiness (Precision) and coverage (Recall)
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={precisionVsRecallData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="domain"
                      stroke="#71717a"
                      fontSize={11}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} unit="%" />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(v) => `${Number(v).toFixed(1)}%`}
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="precision" name="Failure Precision" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recall" name="Failure Recall" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Middle Row: Chart 3 & Chart 4 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: False Alarms by Domain */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FiAlertTriangle className="h-4 w-4 text-amber-400" />
                    False Alarms by Domain (FP)
                  </h4>
                  <span className="text-[11px] text-gray-400">Lower is better</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Number of successful transactions mistakenly flagged as high risk
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={falseAlarmsData} margin={{ top: 10, right: 10, left: -5, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="domain"
                      stroke="#71717a"
                      fontSize={11}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="Random Forest" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Logistic Regression" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Caught vs Missed Failures */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FiCheckCircle className="h-4 w-4 text-emerald-400" />
                    Caught vs Missed Failures ({selectedModel})
                  </h4>
                  <span className="text-[11px] text-gray-400">TP vs FN Count</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Test failure breakdown: True Positives (caught) vs False Negatives (missed)
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={caughtVsMissedData} margin={{ top: 10, right: 10, left: -5, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="domain"
                      stroke="#71717a"
                      fontSize={11}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(val, name) => `${val} txs`}
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="caught" name="Caught Failures (TP)" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="missed" name="Missed Failures (FN)" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bottom Section: Chart 5 - Threshold Trade-off */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 backdrop-blur-xl shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FiSliders className="h-5 w-5 text-indigo-400" />
                  <h4 className="text-base font-bold text-white">Threshold Trade-off Curve</h4>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Dynamic sensitivity analysis across thresholds (0.50 → 0.90) from{" "}
                  <code className="text-indigo-300">all_domains_threshold_analysis.csv</code>
                </p>
              </div>

              {/* Domain Selector for Threshold Curve */}
              <div className="flex flex-wrap items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 self-start md:self-auto">
                {DOMAIN_ORDER.map((key) => {
                  const isActive = selectedDomain === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDomain(key)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                          : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                      }`}
                    >
                      {DOMAIN_LABELS[key] || key}
                    </button>
                  );
                })}
              </div>
            </div>

            {thresholdTradeoffData.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No threshold records found for {DOMAIN_LABELS[selectedDomain]} with {selectedModel}.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                {/* Line Chart */}
                <div className="lg:col-span-2 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={thresholdTradeoffData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="threshold" stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} unit="%" />
                      <Tooltip
                        content={
                          <CustomTooltip
                            formatter={(v, n) => (n.includes("Count") || n.includes("Alarms") ? v : `${v}%`)}
                          />
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Line
                        type="monotone"
                        dataKey="recall"
                        name="Failure Recall"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="precision"
                        name="Failure Precision"
                        stroke="#34d399"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        name="Accuracy"
                        stroke="#a78bfa"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Threshold Summary Table for Selected Domain */}
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="pb-2 font-medium">Thresh</th>
                        <th className="pb-2 font-medium text-sky-400">Recall</th>
                        <th className="pb-2 font-medium text-emerald-400">Prec</th>
                        <th className="pb-2 font-medium text-amber-400">FP</th>
                        <th className="pb-2 font-medium text-emerald-300">TP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {thresholdTradeoffData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="py-2 text-white font-semibold">{row.threshold}</td>
                          <td className="py-2 text-sky-300">{row.recall}%</td>
                          <td className="py-2 text-emerald-300">{row.precision}%</td>
                          <td className="py-2 text-amber-300">{row.falseAlarms}</td>
                          <td className="py-2 text-emerald-400">{row.caughtFail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
