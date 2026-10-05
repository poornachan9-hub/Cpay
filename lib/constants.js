import localLoanDeployment from "../web3/deployment-croploan-localhost.json";
import polygonDeployment from "../web3/deployment-polygon.json";

// lib/constants.js
// ─────────────────────────────────────────────────────────────────────────────
// Multi-network contract addresses
//
// After deploying to Sepolia, add these env vars to your .env.local:
//   NEXT_PUBLIC_SEPOLIA_PAYMENT_GATEWAY_ADDRESS=0x...
//   NEXT_PUBLIC_SEPOLIA_USDT_ADDRESS=0x...
//   NEXT_PUBLIC_SEPOLIA_USDC_ADDRESS=0x...
// ─────────────────────────────────────────────────────────────────────────────

// ✅ Per-network address map
export const NETWORK_ADDRESSES = {
  // Local Hardhat node (chainId 1337)
  localhost: {
    PAYMENT_GATEWAY:
      process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_ADDRESS ||
      "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    USDT:
      process.env.NEXT_PUBLIC_USDT_ADDRESS ||
      "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    USDC:
      process.env.NEXT_PUBLIC_USDC_ADDRESS ||
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    CROP_LOAN:
      localLoanDeployment.contracts?.CropLoan ||
      process.env.NEXT_PUBLIC_CROP_LOAN_ADDRESS ||
      "",
  },

  // Sepolia Testnet (chainId 11155111) — kept for reference
  sepolia: {
    PAYMENT_GATEWAY:
      process.env.NEXT_PUBLIC_SEPOLIA_PAYMENT_GATEWAY_ADDRESS || "",
    USDT: process.env.NEXT_PUBLIC_SEPOLIA_USDT_ADDRESS || "",
    USDC: process.env.NEXT_PUBLIC_SEPOLIA_USDC_ADDRESS || "",
      CROP_LOAN: process.env.NEXT_PUBLIC_SEPOLIA_CROP_LOAN_ADDRESS || "",
  },

  // ✅ Polygon Mainnet (chainId 137) — PRODUCTION
  polygon: {
    PAYMENT_GATEWAY:
      process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON ||
      polygonDeployment.contracts?.CryptoPaymentGateway ||
      "",
    USDT:
      process.env.NEXT_PUBLIC_USDT_POLYGON ||
      "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    USDC:
      process.env.NEXT_PUBLIC_USDC_POLYGON ||
      "0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359",
    CROP_LOAN: process.env.NEXT_PUBLIC_CROP_LOAN_POLYGON_ADDRESS || "",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve addresses by chainId at runtime
// chainId 1337     → localhost (Hardhat)
// chainId 11155111 → sepolia
// chainId 137      → polygon (PRODUCTION)
// ─────────────────────────────────────────────────────────────────────────────
export function getContractAddresses(chainId) {
  const id = Number(chainId);
  if (id === 137)      return NETWORK_ADDRESSES.polygon;
  if (id === 11155111) return NETWORK_ADDRESSES.sepolia;
  // Default to localhost for Hardhat
  return NETWORK_ADDRESSES.localhost;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible flat export used throughout the existing codebase.
// Reads NEXT_PUBLIC_NETWORK from .env.local ("localhost" | "sepolia" | "polygon").
// ─────────────────────────────────────────────────────────────────────────────
const activeNetwork = process.env.NEXT_PUBLIC_NETWORK || "localhost";
export const CONTRACT_ADDRESSES = NETWORK_ADDRESSES[activeNetwork] || NETWORK_ADDRESSES.localhost;

// Helper function to get token address based on network
export const getTokenAddress = (tokenSymbol) => {
  const networkName = process.env.NEXT_PUBLIC_NETWORK || "localhost";
  return (NETWORK_ADDRESSES[networkName] || NETWORK_ADDRESSES.localhost)[tokenSymbol];
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const ADMIN_ADDRESSES = [
  "0x75c4883bdb6e6a5d2c10d86e8e00d1a89af69b0e",
  "0x9f7a82bae2cb215e887bbba1d73501c57163e210",
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  ...(process.env.NEXT_PUBLIC_ADMIN_ADDRESS
    ? [process.env.NEXT_PUBLIC_ADMIN_ADDRESS.toLowerCase()]
    : []),
];

export const isAdminAddress = (address) => {
  if (!address || typeof address !== "string") return false;
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment Tokens
// ─────────────────────────────────────────────────────────────────────────────
export const PAYMENT_TOKENS = {
  ETH: 0,
  USDT: 1,
  USDC: 2,
};

export const TOKEN_NAMES = {
  0: "POL",
  1: "USDT",
  2: "USDC",
};

// Token configurations
export const TOKEN_CONFIG = {
  ETH: {
    symbol: "POL",
    name: "Polygon",
    decimals: 18,
    color: "#7B3FE4",
    icon: "⚛️",
    address: null, // Native token
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    color: "#26A17B",
    icon: "💵",
    getAddress: () => getTokenAddress("USDT"),
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    color: "#2775CA",
    icon: "💰",
    getAddress: () => getTokenAddress("USDC"),
  },
};

// KYC Status
export const KYC_STATUS = {
  NotSubmitted: 0,
  Pending: 1,
  Approved: 2,
  Rejected: 3,
  Cancelled: 4,
};

export const KYC_STATUS_NAMES = {
  0: "Not Submitted",
  1: "Pending",
  2: "Approved",
  3: "Rejected",
  4: "Cancelled",
};

// Product Status
export const PRODUCT_STATUS = {
  Active: 0,
  Deactivated: 1,
  Paused: 2,
};

export const PRODUCT_STATUS_NAMES = {
  0: "Active",
  1: "Deactivated",
  2: "Paused",
};

// Pinata Configuration
export const PINATA_CONFIG = {
  API_KEY: process.env.NEXT_PUBLIC_PINATA_API_KEY,
  SECRET_KEY: process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY,
  JWT: process.env.NEXT_PUBLIC_PINATA_JWT,
  GATEWAY: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
};

// Fee Constants
export const MAX_FEE_RATE = 1000; // 10%
export const PAYOUT_INTERVAL = 7 * 24 * 60 * 60; // 7 days in seconds

// Validation function to check if all required addresses are set
export const validateContractAddresses = () => {
  const addresses = getContractAddresses(
    typeof window !== "undefined"
      ? window.__chainId || 1337
      : Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1337
  );
  const issues = [];

  if (!addresses.PAYMENT_GATEWAY)
    issues.push("PAYMENT_GATEWAY address is missing");
  if (!addresses.USDT)
    issues.push("USDT address is missing");
  if (!addresses.USDC)
    issues.push("USDC address is missing");

  if (issues.length > 0) {
    console.warn("⚠️ Contract address issues:", issues);
    console.warn("Please check your .env.local file");
  }

  return issues.length === 0;
};

// Debug function to log current configuration
export const debugConfiguration = () => {
  console.log("🔧 Contract Configuration:");
  console.log("  Network:", process.env.NEXT_PUBLIC_NETWORK || "localhost");
  console.log("  Payment Gateway:", CONTRACT_ADDRESSES.PAYMENT_GATEWAY);
  console.log("  USDT Address:", getTokenAddress("USDT"));
  console.log("  USDC Address:", getTokenAddress("USDC"));
  console.log("  CropLoan Address:", CONTRACT_ADDRESSES.CROP_LOAN);

  validateContractAddresses();
};

// ─────────────────────────────────────────────────────────────────────────────
// Micro-Loan Constants
// ─────────────────────────────────────────────────────────────────────────────
export const LOAN_STATUS = {
  Active: 0,
  Repaid: 1,
  Liquidated: 2,
};

export const LOAN_STATUS_NAMES = {
  0: "Active",
  1: "Repaid",
  2: "Liquidated",
};

export const LOAN_STATUS_COLORS = {
  0: "text-green-400 border-green-500/30 bg-green-600/10",
  1: "text-emerald-400 border-emerald-500/30 bg-emerald-600/10",
  2: "text-red-400 border-red-500/30 bg-red-600/10",
};

/// Collateral ratio: 4 units of crypto collateral per 1 USDC
export const LOAN_COLLATERAL_RATIO = 4;
export const LOAN_FEE_BPS = 200; // 2%
export const LOAN_MAX_TERM_DAYS = 30;
