// ─────────────────────────────────────────────────────────────
// Environment config — loads .env and exports typed values
// ─────────────────────────────────────────────────────────────
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.warn(`⚠️  Missing env var: ${key} — using placeholder`);
    return "";
  }
  return val;
}

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  JWT_SECRET: required("JWT_SECRET"),

  // Database
  DATABASE_URL: required("DATABASE_URL"),

  // Blockchain
  RPC_URL: process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545",
  SERVER_PRIVATE_KEY: required("SERVER_PRIVATE_KEY"),
  CONTRACT_ADDRESS: required("CONTRACT_ADDRESS"),

  // Pinata
  PINATA_API_KEY: required("PINATA_API_KEY"),
  PINATA_SECRET_KEY: required("PINATA_SECRET_KEY"),
  PINATA_JWT: required("PINATA_JWT"),

  // Sandbox.co.in — Aadhaar OTP + PAN real verification
  SANDBOX_BASE_URL: process.env.SANDBOX_BASE_URL || "https://api.sandbox.co.in",
  SANDBOX_API_KEY: process.env.SANDBOX_API_KEY || "",
  SANDBOX_API_SECRET: process.env.SANDBOX_API_SECRET || "",

  // PAN Aggregator
  PAN_AGGREGATOR_BASE_URL: process.env.PAN_AGGREGATOR_BASE_URL || "",
  PAN_AGGREGATOR_ENDPOINT: process.env.PAN_AGGREGATOR_ENDPOINT || "/v1/pan/verify",
  PAN_AGGREGATOR_API_KEY: process.env.PAN_AGGREGATOR_API_KEY || "",

  // CORS
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
};
