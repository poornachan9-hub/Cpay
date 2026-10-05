// grant-reviewer-polygon.js
// Grants KYC reviewer access only; ownership transfer and KYC approval are
// intentionally separate operations.
const hre = require("hardhat");
const { ethers } = hre;
const readline = require("node:readline/promises");
const deployment = require("../deployment-polygon.json");

const ABI = [
  "function owner() view returns (address)",
  "function authorizedReviewers(address) view returns (bool)",
  "function addReviewer(address reviewer) external",
];

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 137) throw new Error("Switch Hardhat to Polygon (chain ID 137)");

  const reviewerAddress = process.env.POLYGON_REVIEWER_ADDRESS;
  if (!reviewerAddress || !ethers.isAddress(reviewerAddress)) {
    throw new Error("Set POLYGON_REVIEWER_ADDRESS in web3/.env");
  }

  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(
    deployment.contracts.CryptoPaymentGateway,
    ABI,
    signer
  );
  const owner = await contract.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Configured signer is not the current contract owner");
  }

  if (await contract.authorizedReviewers(reviewerAddress)) {
    console.log("Reviewer is already authorized; no transaction sent.");
    return;
  }

  console.log(`Owner: ${signer.address}`);
  console.log(`Reviewer to add: ${ethers.getAddress(reviewerAddress)}`);
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = await prompt.question("Type ADD KYC REVIEWER to continue: ");
  prompt.close();
  if (confirmation !== "ADD KYC REVIEWER") {
    console.log("Cancelled; no transaction was sent.");
    return;
  }

  const tx = await contract.addReviewer(ethers.getAddress(reviewerAddress));
  console.log(`Transaction: ${tx.hash}`);
  await tx.wait();
  console.log("Reviewer permission granted.");
}

main().catch((error) => {
  console.error("Reviewer grant failed:", error.message);
  process.exitCode = 1;
});
