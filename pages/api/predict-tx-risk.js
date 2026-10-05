import { spawn } from "child_process";
import path from "path";
import fs from "fs";

function resolvePythonPath() {
  const root = process.cwd();
  const candidates = [
    path.join(root, "polygon-ml-dataset", ".venv", "Scripts", "python.exe"),
    path.join(root, ".venv", "Scripts", "python.exe"),
    path.join(root, "polygon-ml-dataset", ".venv", "bin", "python"),
    path.join(root, ".venv", "bin", "python"),
    "python",
    "python3",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return process.platform === "win32" ? "python" : "python3";
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ready",
      service: "Polygon Pre-Transaction Risk Prediction Service",
      domains: ["uniswap", "marketplace", "token", "aave", "fallback"],
      pipeline: [
        "Read destination 'to' address",
        "Identify supported domain",
        "Extract pre-execution gas_limit, gas_price_gwei, value_native",
        "Route to validated domain model (or explicit on-chain state path for Aave)",
        "Predict failure probability",
        "Apply domain-specific threshold",
        "Return advisory prediction"
      ]
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { to, gas_limit, gas_price_gwei, value_native, threshold } = req.body || {};

  const pythonExecutable = resolvePythonPath();
  const scriptPath = path.join(process.cwd(), "polygon-ml-dataset", "predict_tx.py");

  const payload = JSON.stringify({
    to: to || "",
    gas_limit: gas_limit !== undefined ? Number(gas_limit) : 210000,
    gas_price_gwei: gas_price_gwei !== undefined ? Number(gas_price_gwei) : 35.0,
    value_native: value_native !== undefined ? Number(value_native) : 0.0,
    threshold: threshold !== undefined ? Number(threshold) : undefined,
  });

  const b64Payload = Buffer.from(payload).toString("base64");

  try {
    const result = await new Promise((resolve, reject) => {
      const pyProcess = spawn(pythonExecutable, [scriptPath, "--b64", b64Payload], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
      });

      let stdoutData = "";
      let stderrData = "";

      pyProcess.stdout.on("data", (chunk) => {
        stdoutData += chunk.toString("utf-8");
      });

      pyProcess.stderr.on("data", (chunk) => {
        stderrData += chunk.toString("utf-8");
      });

      pyProcess.on("error", (err) => {
        reject(new Error(`Failed to start prediction process: ${err.message}`));
      });

      pyProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Prediction script exited with code ${code}: ${stderrData}`));
        } else {
          try {
            const parsed = JSON.parse(stdoutData.trim());
            resolve(parsed);
          } catch (parseErr) {
            reject(new Error(`Invalid JSON from prediction script: ${stdoutData}`));
          }
        }
      });

      // Timeout after 8 seconds
      const timer = setTimeout(() => {
        pyProcess.kill();
        reject(new Error("Prediction request timed out after 8s"));
      }, 8000);

      pyProcess.on("close", () => {
        clearTimeout(timer);
      });
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Risk prediction error:", error);
    return res.status(500).json({
      error: error.message || "Failed to compute transaction risk prediction",
      advisory: "Risk prediction is currently unavailable; transaction can still proceed."
    });
  }
}
