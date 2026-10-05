// ─────────────────────────────────────────────────────────────
// Blockchain config — ethers.js provider + contract instance
// ─────────────────────────────────────────────────────────────
import { ethers } from "ethers";
import { env } from "./env";
import path from "path";
import fs from "fs";

// Load ABI from the hardhat compilation artifacts
const artifactPath = path.resolve(
  __dirname,
  "../../../web3/artifacts/contracts/CryptoPaymentGateway.sol/CryptoPaymentGateway.json"
);

let CONTRACT_ABI: any[];
try {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  CONTRACT_ABI = artifact.abi;
  console.log("✅ Contract ABI loaded from artifacts");
} catch (err) {
  console.warn("⚠️  Could not load ABI from artifacts, using minimal ABI");
  // Minimal ABI with the functions we need
  CONTRACT_ABI = [
    "function submitKYC(string memory _ipfsHash) external",
    "function reviewKYC(address _user, bool _approved, string memory _rejectionReason) external",
    "function submitAadhaarProof(bytes32 _proofHash) external",
    "function kycData(address) view returns (uint256 id, address user, string ipfsHash, uint8 status, uint256 submittedAt, uint256 reviewedAt, string rejectionReason, address reviewedBy)",
    "function aadhaarProofHash(address) view returns (bytes32)",
    "function authorizedReviewers(address) view returns (bool)",
    "function owner() view returns (address)",
  ];
}

export { CONTRACT_ABI };

// Sepolia provider
export const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);

// Server wallet (used to send on-chain transactions)
export function getServerWallet(): ethers.Wallet {
  if (!env.SERVER_PRIVATE_KEY || env.SERVER_PRIVATE_KEY === "0xYOUR_PRIVATE_KEY_HERE") {
    throw new Error("SERVER_PRIVATE_KEY is not configured in .env");
  }
  return new ethers.Wallet(env.SERVER_PRIVATE_KEY, provider);
}

// Get a contract instance connected to the server wallet
export function getContract(): ethers.Contract {
  const wallet = getServerWallet();
  return new ethers.Contract(env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
}

// Get a read-only contract instance (no signer needed)
export function getReadOnlyContract(): ethers.Contract {
  return new ethers.Contract(env.CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}
