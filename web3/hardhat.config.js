// hardhat.config.js — Polygon Mainnet Production
require("@nomicfoundation/hardhat-toolbox");
// Load web3/.env and FORCE override any matching system env vars
require("dotenv").config({ override: true });

// ── Safe env-var fallbacks (config never crashes on missing keys) ──
const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  "0x" + "0".repeat(64);

// ✅ Public Polygon Mainnet RPC — hardcoded to avoid stale env-var issues.
// polygon-rpc.com was returning 504; using 1rpc.io/matic (confirmed working).
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // ── Local development (unchanged) ──────────────────────────────
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },

    // ── ✅ PRODUCTION: Polygon Mainnet ──────────────────────────────
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 137,
    },
  },

  // ── Polygonscan contract verification ──────────────────────────────
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com",
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    token: "MATIC",
  },
};

