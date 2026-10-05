import { spawn } from "child_process";
import { createInterface } from "readline";
import path from "path";

export interface CreditDefaultFeatures {
  credit_limit: number;
  age: number;
  latest_payment_status: number;
  average_prior_payment_status: number;
  average_bill_amount: number;
  average_payment_amount: number;
}

export interface CustomLoanFeatures {
  amount_usdc: number;
  collateral_kg: number;
  collateral_ratio: number;
  term_days: number;
  repayment_history_score: number;
  days_to_deadline: number;
  late_payment_count: number;
  previous_repayments: number;
  liquidity_buffer: number;
}

export type LoanRiskFeatures = CreditDefaultFeatures | CustomLoanFeatures | Record<string, number>;

interface WorkerResponse {
  ready?: boolean;
  error?: string;
  default_probability?: number;
  predicted_outcome?: "no_default" | "default";
  model_version?: string;
  decision_threshold?: number;
}

type WorkerStatus = "starting" | "ready" | "failed";

const scriptDirectory = path.resolve(__dirname, "../../scripts");
const pythonExecutable = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3");
const worker = spawn(pythonExecutable, [path.join(scriptDirectory, "loan-risk-worker.py")], {
  stdio: ["pipe", "pipe", "pipe"],
});

let workerStatus: WorkerStatus = "starting";
let workerError = "AI model worker is unavailable";
let modelVersion = "uci-credit-default-xgboost-v1";
const startupWaiters: Array<() => void> = [];
const pendingRequests: Array<{
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
}> = [];

function settleStartup(): void {
  startupWaiters.splice(0).forEach((resolve) => resolve());
}

function failWorker(message: string): void {
  workerStatus = "failed";
  workerError = message;
  settleStartup();
  pendingRequests.splice(0).forEach(({ reject }) => reject(new Error(message)));
}

const output = createInterface({ input: worker.stdout });
output.on("line", (line) => {
  let response: WorkerResponse;
  try {
    response = JSON.parse(line) as WorkerResponse;
  } catch {
    failWorker("AI model worker returned invalid output");
    return;
  }

  if (typeof response.ready === "boolean") {
    if (response.ready) {
      workerStatus = "ready";
      modelVersion = response.model_version || modelVersion;
      settleStartup();
    } else {
      failWorker(response.error || "AI model failed to load");
    }
    return;
  }

  const pending = pendingRequests.shift();
  if (!pending) return;
  if (response.error) pending.reject(new Error(response.error));
  else pending.resolve(response);
});

worker.stderr.on("data", (chunk: Buffer) => {
  console.error("AI model worker:", chunk.toString().trim());
});
worker.on("error", (error) => failWorker(error.message));
worker.on("exit", (code) => {
  if (workerStatus !== "failed") {
    failWorker(`AI model worker exited with code ${String(code)}`);
  }
});

function waitForWorker(): Promise<void> {
  if (workerStatus !== "starting") return Promise.resolve();
  return new Promise((resolve) => startupWaiters.push(resolve));
}

export async function predictLoanRisk(features: LoanRiskFeatures) {
  await waitForWorker();
  if (workerStatus !== "ready") {
    throw new Error(`${workerError}. Train a supported loan-risk model first.`);
  }

  const response = await new Promise<WorkerResponse>((resolve, reject) => {
    pendingRequests.push({ resolve, reject });
    worker.stdin.write(`${JSON.stringify(features)}\n`, (error) => {
      if (error) {
        const pending = pendingRequests.pop();
        pending?.reject(error);
      }
    });
  });
  if (typeof response.default_probability !== "number" || !response.predicted_outcome) {
    throw new Error("AI model worker returned no loan-risk prediction");
  }

  const isCustomLoan = Object.prototype.hasOwnProperty.call(features, "amount_usdc");
  return {
    default_probability: response.default_probability,
    predicted_outcome: response.predicted_outcome,
    model_version: response.model_version || modelVersion,
    decision_threshold: response.decision_threshold ?? 0.5,
    dataset: isCustomLoan ? "Synthetic custom loan risk model" : "UCI Default of Credit Card Clients",
    research_demo: true,
  };
}

export async function predictCreditDefaultRisk(features: CreditDefaultFeatures) {
  return predictLoanRisk(features as LoanRiskFeatures);
}