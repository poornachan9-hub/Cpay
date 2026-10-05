// ─────────────────────────────────────────────────────────────
// Blockchain Service — on-chain interactions via ethers.js
// ─────────────────────────────────────────────────────────────
import { ethers } from "ethers";
import { getContract, getReadOnlyContract } from "../config/blockchain";

/**
 * Submit KYC proof IPFS hash to the smart contract.
 * Called during /kyc/finalize — the server wallet sends the transaction.
 */
export async function submitKycOnChain(
  walletAddress: string,
  ipfsHash: string
): Promise<{ success: boolean; txHash: string; error?: string }> {
  try {
    const contract = getContract();

    // Estimate gas with a 20% buffer — call submitKYCForUser instead of submitKYC
    const gasEstimate = await contract.estimateGas.submitKYCForUser(walletAddress, ipfsHash);
    const gasLimit = gasEstimate.mul(120).div(100);

    const tx = await contract.submitKYCForUser(walletAddress, ipfsHash, { gasLimit });
    console.log(`📝 submitKYC tx sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ submitKYC confirmed in block ${receipt.blockNumber}`);

    return { success: true, txHash: tx.hash };
  } catch (err: any) {
    console.error("❌ submitKYC failed:", err.message);
    return { success: false, txHash: "", error: err.message };
  }
}

/**
 * Submit Aadhaar proof hash on-chain.
 */
export async function submitAadhaarProofOnChain(
  proofHash: string
): Promise<{ success: boolean; txHash: string; error?: string }> {
  try {
    const contract = getContract();

    const gasEstimate = await contract.estimateGas.submitAadhaarProof(proofHash);
    const gasLimit = gasEstimate.mul(120).div(100);

    const tx = await contract.submitAadhaarProof(proofHash, { gasLimit });
    console.log(`🔒 submitAadhaarProof tx sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ submitAadhaarProof confirmed in block ${receipt.blockNumber}`);

    return { success: true, txHash: tx.hash };
  } catch (err: any) {
    console.error("❌ submitAadhaarProof failed:", err.message);
    return { success: false, txHash: "", error: err.message };
  }
}

/**
 * Read the on-chain KYC status for a wallet address.
 */
export async function getOnChainKycStatus(
  walletAddress: string
): Promise<{ status: number; ipfsHash: string } | null> {
  try {
    const contract = getReadOnlyContract();
    const data = await contract.kycData(walletAddress);
    return {
      status: data.status,
      ipfsHash: data.ipfsHash,
    };
  } catch (err: any) {
    console.error("❌ getOnChainKycStatus failed:", err.message);
    return null;
  }
}
