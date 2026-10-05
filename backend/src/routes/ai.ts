import { Router, Request, Response } from "express";
import { readFile } from "fs/promises";
import path from "path";
import {
  CreditDefaultFeatures,
  CustomLoanFeatures,
  predictCreditDefaultRisk,
  predictLoanRisk,
} from "../services/aiLoanScorer";

const router = Router();
const scriptDirectory = path.resolve(__dirname, "../../scripts");
const artifactDirectory = path.join(scriptDirectory, "model-artifacts");
const featureNames: Array<keyof CreditDefaultFeatures> = [
  "credit_limit",
  "age",
  "latest_payment_status",
  "average_prior_payment_status",
  "average_bill_amount",
  "average_payment_amount",
];
const customLoanFeatureNames: Array<keyof CustomLoanFeatures> = [
  "amount_usdc",
  "collateral_kg",
  "collateral_ratio",
  "term_days",
  "repayment_history_score",
  "days_to_deadline",
  "late_payment_count",
  "previous_repayments",
  "liquidity_buffer",
];

router.post("/custom-loan-risk", async (req: Request, res: Response) => {
  const features = req.body as Partial<CustomLoanFeatures>;
  const hasInvalidFeature = customLoanFeatureNames.some(
    (name) => typeof features[name] !== "number" || !Number.isFinite(features[name])
  );
  if (hasInvalidFeature) {
    return res.status(400).json({ error: "All custom-loan risk features must be finite numbers" });
  }

  try {
    return res.json(await predictLoanRisk(features as CustomLoanFeatures));
  } catch (error) {
    console.error("Custom loan risk prediction failed:", error);
    return res.status(503).json({ error: "Custom loan-risk model is unavailable. Train the synthetic custom-loan model first." });
  }
});

router.get("/custom-loan-metrics", async (_req: Request, res: Response) => {
  try {
    const pathToMetrics = path.join(artifactDirectory, "synthetic_custom_loan_risk", "synthetic_custom_loan_metrics.json");
    const metrics = JSON.parse(await readFile(pathToMetrics, "utf-8"));
    return res.json({ metrics });
  } catch (error) {
    console.error("Custom loan risk metrics are unavailable:", error);
    return res.status(503).json({ error: "Synthetic custom-loan metrics are unavailable; train the model first." });
  }
});

router.post("/credit-default-risk", async (req: Request, res: Response) => {
  const features = req.body as Partial<CreditDefaultFeatures>;
  const hasInvalidFeature = featureNames.some(
    (name) => typeof features[name] !== "number" || !Number.isFinite(features[name])
  );
  if (hasInvalidFeature) {
    return res.status(400).json({ error: "All credit-default features must be finite numbers" });
  }
  if (
    (features.credit_limit as number) < 10000 ||
    (features.credit_limit as number) > 1000000 ||
    (features.age as number) < 21 ||
    (features.age as number) > 79 ||
    !Number.isInteger(features.age) ||
    (features.latest_payment_status as number) < -2 ||
    (features.latest_payment_status as number) > 8 ||
    !Number.isInteger(features.latest_payment_status) ||
    (features.average_prior_payment_status as number) < -2 ||
    (features.average_prior_payment_status as number) > 8 ||
    (features.average_bill_amount as number) < -200000 ||
    (features.average_bill_amount as number) > 2000000 ||
    (features.average_payment_amount as number) < 0 ||
    (features.average_payment_amount as number) > 2000000
  ) {
    return res.status(400).json({ error: "Credit-default features are outside supported ranges" });
  }

  try {
    return res.json(await predictCreditDefaultRisk(features as CreditDefaultFeatures));
  } catch (error) {
    console.error("AI credit-default prediction failed:", error);
    return res.status(503).json({ error: "Credit-default model is unavailable. Train it from the UCI dataset first." });
  }
});

router.get("/credit-default-metrics", async (_req: Request, res: Response) => {
  try {
    const [metrics, confusionMatrix, featureImportance] = await Promise.all(
      ["credit_default_metrics.json", "credit_default_confusion_matrix.json", "credit_default_feature_importance.json"].map(
        async (file) => JSON.parse(await readFile(path.join(artifactDirectory, file), "utf-8"))
      )
    );
    return res.json({ metrics, confusion_matrix: confusionMatrix, feature_importance: featureImportance });
  } catch (error) {
    console.error("Credit-default model metrics are unavailable:", error);
    return res.status(503).json({ error: "Credit-default metrics are unavailable; train the UCI model first" });
  }
});

router.get("/ocr-metrics", async (_req: Request, res: Response) => {
  try {
    const metrics = JSON.parse(
      await readFile(path.join(scriptDirectory, "ocr_metrics.json"), "utf-8")
    );
    return res.json({ metrics });
  } catch (error) {
    console.error("OCR evaluation metrics are unavailable:", error);
    return res.status(503).json({ error: "OCR benchmark metrics are unavailable; run the MIDV-500 evaluator first" });
  }
});

export default router;