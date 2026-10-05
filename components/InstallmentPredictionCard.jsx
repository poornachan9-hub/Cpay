import { motion } from "framer-motion";
import { FiAlertCircle, FiCheckCircle, FiClock } from "react-icons/fi";

export default function InstallmentPredictionCard({ assessment }) {
  const probability = Number(assessment?.default_probability);
  const hasPrediction = Number.isFinite(probability);
  const isDefault = assessment?.predicted_outcome === "default";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.035] p-5"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {isDefault ? (
          <FiClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        ) : (
          <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">Credit-card default risk</h3>
          {assessment?.loading ? (
            <p className="mt-2 text-sm text-gray-400">Evaluating credit history...</p>
          ) : !hasPrediction ? (
            <div className="mt-2 flex gap-2 text-sm text-gray-400">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>{assessment?.error || "Train the UCI credit-default model before requesting a prediction."}</span>
            </div>
          ) : (
            <>
              <p className={`mt-2 text-lg font-bold ${isDefault ? "text-amber-200" : "text-emerald-200"}`}>
                {isDefault ? "Default risk" : "No default predicted"}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Default probability: {(probability * 100).toFixed(1)}%
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {assessment.model_version} · {assessment.dataset}
              </p>
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
}