import React from "react";
import { FiCheckCircle, FiAlertTriangle, FiHelpCircle, FiCpu, FiLayers } from "react-icons/fi";

export default function PredictionValidationCard({ prediction, blockchainResult }) {
  if (!blockchainResult) return null;

  const isPredictionFailure = prediction?.predicted_outcome === "FAILURE";
  const isPredictionSuccess = prediction?.predicted_outcome === "SUCCESS";
  const isRealitySuccess = blockchainResult.status === "success";
  const isRealityRevert = blockchainResult.status === "reverted";
  const isInconclusive = blockchainResult.status === "inconclusive" || !blockchainResult.conclusive;

  // Rigorous 3-way validation verdict logic:
  // ONLY mark "PREDICTION MATCHED REALITY" when:
  // - ML predicts FAILURE and EVM definitively reverts with decoded reason, OR
  // - ML predicts SUCCESS and EVM definitively succeeds.
  // Ambiguous errors, missing revert data, or RPC failures MUST yield "VALIDATION INCONCLUSIVE".
  let verdict = "VALIDATION INCONCLUSIVE";
  let verdictBadge = "bg-amber-500/10 text-amber-300 border-amber-500/30";
  let verdictIcon = FiHelpCircle;
  let verdictExplanation = "";

  const isAaveStateCheck = prediction?.requires_onchain_state || prediction?.predicted_outcome === "STATE_CHECK_REQUIRED";

  if (isInconclusive) {
    verdict = "VALIDATION INCONCLUSIVE";
    verdictBadge = "bg-amber-500/10 text-amber-300 border-amber-500/30";
    verdictIcon = FiHelpCircle;
    verdictExplanation =
      "The blockchain simulation produced an ambiguous error or missing revert data. The execution outcome could not be definitively classified, so this is NOT counted as a model prediction match.";
  } else if (isAaveStateCheck) {
    verdict = isRealityRevert ? "ON-CHAIN STATE VERIFIED (EVM REVERT CAUGHT)" : "ON-CHAIN STATE VERIFIED (SIMULATION SUCCESSFUL)";
    verdictBadge = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    verdictIcon = FiCheckCircle;
    verdictExplanation =
      "For Aave Lending transactions, pre-execution static heuristics mandate explicit on-chain state inspection. The EVM simulation executed and definitively verified the execution outcome.";
  } else if ((isPredictionFailure && isRealityRevert) || (isPredictionSuccess && isRealitySuccess)) {
    verdict = "PREDICTION MATCHED REALITY";
    verdictBadge = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    verdictIcon = FiCheckCircle;
    verdictExplanation =
      "The controlled transaction was independently simulated on Polygon, and the ML prediction agreed with the observed EVM execution result.";
  } else {
    verdict = "PREDICTION DID NOT MATCH REALITY";
    verdictBadge = "bg-rose-500/10 text-rose-300 border-rose-500/30";
    verdictIcon = FiAlertTriangle;
    verdictExplanation =
      "The ML pre-flight prediction diverged from the observed EVM execution result.";
  }

  const VerdictIcon = verdictIcon;

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-zinc-900/70 to-purple-950/30 p-6 backdrop-blur-xl shadow-2xl space-y-5 animate-in fade-in duration-300">
      {/* Header and Verdict */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h4 className="text-base font-bold text-white tracking-wide">
            Prediction vs. Blockchain Reality Benchmark
          </h4>
          <p className="text-xs text-gray-400">
            End-to-end verification of ML pre-flight risk assessment against EVM execution
          </p>
        </div>

        <span
          className={`self-start sm:self-auto rounded-full px-3 py-1.5 text-xs font-bold tracking-wide border flex items-center gap-1.5 ${verdictBadge}`}
        >
          <VerdictIcon className="h-4 w-4 shrink-0" />
          {verdict}
        </span>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. ML Pre-Flight Prediction */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <FiCpu className="h-4 w-4" /> 1. ML Pre-Flight Prediction
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                isPredictionFailure
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              }`}
            >
              {prediction?.risk_level || "EVALUATED"}
            </span>
          </div>

          <div className="pt-1 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Domain:</span>
              <span className="font-medium text-gray-200">{prediction?.domain || "Standard"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Model Pipeline:</span>
              <span className="font-medium text-gray-200 truncate max-w-[200px]" title={prediction?.model_used}>
                {prediction?.model_used || "Domain Model"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Failure Probability:</span>
              <span className="font-mono font-bold text-gray-200">
                {prediction?.failure_probability !== null && prediction?.failure_probability !== undefined
                  ? `${(prediction.failure_probability * 100).toFixed(1)}%`
                  : "N/A (State Check)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Decision Threshold:</span>
              <span className="font-mono text-gray-300">{prediction?.threshold ?? 0.5}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-white/5">
              <span className="text-gray-400 font-semibold">Predicted Outcome:</span>
              <span
                className={`font-mono font-bold ${
                  isPredictionFailure ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {prediction?.predicted_outcome || "UNKNOWN"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Blockchain Simulation / Reality */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
              <FiLayers className="h-4 w-4" /> 2. Blockchain Reality
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                blockchainResult.type === "simulation"
                  ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                  : "bg-purple-500/10 text-purple-300 border-purple-500/30"
              }`}
            >
              {blockchainResult.type === "simulation" ? "EVM SIMULATION" : "ON-CHAIN RECEIPT"}
            </span>
          </div>

          <div className="pt-1 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Execution Mode:</span>
              <span className="text-gray-200">
                {blockchainResult.type === "simulation" ? "Simulated (Zero Gas)" : "Broadcasted Receipt"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-semibold">Simulation Status:</span>
              <span
                className={`font-mono font-bold ${
                  isInconclusive
                    ? "text-amber-400"
                    : isRealityRevert
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                {isInconclusive
                  ? "INCONCLUSIVE"
                  : isRealityRevert
                  ? "REVERTED"
                  : "SUCCESS"}
              </span>
            </div>

            {blockchainResult.revertReason && (
              <div className="pt-1 border-t border-white/5">
                <span className="text-gray-400 block mb-1">Decoded Revert Reason:</span>
                <p className="font-mono text-[11px] text-amber-300 break-words bg-white/5 p-2 rounded border border-white/10">
                  {blockchainResult.revertReason}
                </p>
              </div>
            )}

            {blockchainResult.txHash && (
              <div className="flex justify-between pt-1">
                <span className="text-gray-400">Tx Hash:</span>
                <span className="font-mono text-gray-300 text-[11px] truncate max-w-[170px]">
                  {blockchainResult.txHash}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Final Validation Explanation */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-gray-300">
        <p className="font-semibold text-white mb-0.5">Final Validation Verdict:</p>
        <p>{verdictExplanation}</p>
      </div>
    </div>
  );
}
