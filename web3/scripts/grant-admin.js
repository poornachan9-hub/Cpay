// scripts/grant-admin.js
// ─────────────────────────────────────────────────────────────────────────────
// Grants admin (owner) access to your MetaMask account on ANY network.
//
// NEW ADMIN WALLET    : 0x9f7A82baE2cb215E887bbBA1D73501c57163e210
// COMPROMISED (BLOCK) : 0x52b6af09417423ed709c9C11bbbbe967b1a4F561 — NEVER USE
//
// Works on localhost (Hardhat) and Polygon Mainnet.
//
// Usage:
//   POLYGON:
//     $env:ADMIN_ADDRESS="0x9f7A82baE2cb215E887bbBA1D73501c57163e210"
//     npx hardhat run scripts/grant-admin.js --network polygon
//
//   LOCALHOST:
//     $env:ADMIN_ADDRESS="0x9f7A82baE2cb215E887bbBA1D73501c57163e210"
//     npx hardhat run scripts/grant-admin.js --network localhost
//
// What it does:
//   1. Adds your account as an authorized KYC reviewer
//   2. Transfers contract ownership to your account
//   3. [Localhost only] Sends 100 ETH for gas
//   4. [Localhost only] Sends 10,000 USDT + USDC mock tokens
// ─────────────────────────────────────────────────────────────────────────────
const { ethers } = require("hardhat");
const fs = require("fs");

// ⚠️  PERMANENTLY BLOCKED: compromised account
const COMPROMISED_ADDRESS = "0x52b6af09417423ed709c9C11bbbbe967b1a4F561";

async function main() {
  const newAdmin = process.env.ADMIN_ADDRESS;
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";

  if (!newAdmin || !ethers.isAddress(newAdmin)) {
    console.error("\nERROR: Please provide a valid ADMIN_ADDRESS environment variable.");
    console.error("   Example:");
    console.error(`   $env:ADMIN_ADDRESS="0x9f7A82baE2cb215E887bbBA1D73501c57163e210"; npx hardhat run scripts/grant-admin.js --network ${networkName}\n`);
    process.exit(1);
  }

  // !! SECURITY: block the permanently-compromised account
  if (newAdmin.toLowerCase() === COMPROMISED_ADDRESS.toLowerCase()) {
    console.error("\nBLOCKED: This address is compromised and has been permanently removed.");
    console.error("  Blocked  : " + COMPROMISED_ADDRESS);
    console.error("  Use this : 0x9f7A82baE2cb215E887bbBA1D73501c57163e210\n");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🔑  Grant Admin Access to MetaMask Account");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Network:          ${networkName}`);
  console.log(`  Target address:   ${newAdmin}`);
  console.log("");

  // ── Load deployment info ──────────────────────────────────────────────────
  const deployFile = `deployment-${networkName}.json`;
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  } catch {
    console.error(`❌ ${deployFile} not found.`);
    console.error("   Deploy contracts first. See README for instructions.");
    process.exit(1);
  }

  const gatewayAddress = deploymentInfo.contracts.CryptoPaymentGateway;
  console.log(`  Gateway contract: ${gatewayAddress}`);

  // ── Get the current deployer (current owner) ────────────────────────────
  const [deployer] = await ethers.getSigners();
  console.log(`  Current owner:    ${deployer.address}`);
  console.log("");

  // ── Connect to the deployed contract ─────────────────────────────────────
  const gateway = await ethers.getContractAt(
    "CryptoPaymentGateway",
    gatewayAddress,
    deployer
  );

  // Verify current owner matches our signer
  const currentOwner = await gateway.owner();
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error(`❌ The configured private key (${deployer.address}) is NOT the current owner (${currentOwner}).`);
    console.error("   Only the current owner can transfer ownership.");
    process.exit(1);
  }

  // ── Step 1: [Localhost only] Fund with ETH for gas ───────────────────────
  if (isLocalhost) {
    console.log("1️⃣  Funding MetaMask account with 100 ETH...");
    const fundTx = await deployer.sendTransaction({
      to: newAdmin,
      value: ethers.parseEther("100"),
    });
    await fundTx.wait();
    const balance = await ethers.provider.getBalance(newAdmin);
    console.log(`   ✅ Balance: ${ethers.formatEther(balance)} ETH\n`);
  } else {
    console.log("1️⃣  Skipping ETH funding (not on localhost — use a faucet for Sepolia ETH)\n");
  }

  // ── Step 2: Add as authorized reviewer ───────────────────────────────────
  console.log("2️⃣  Adding as authorized KYC reviewer...");
  const reviewerTx = await gateway.addReviewer(newAdmin);
  await reviewerTx.wait();
  console.log("   ✅ Reviewer access granted\n");

  // ── Step 2b: Approve KYC for new admin if pending ─────────────────────────
  try {
    const kyc = await gateway.kycData(newAdmin);
    if (Number(kyc.status) === 1) {
      console.log("2️⃣b Approving KYC for new admin...");
      const kycTx = await gateway.reviewKYC(newAdmin, true, "");
      await kycTx.wait();
      console.log("   ✅ KYC approved for " + newAdmin + "\n");
    }
  } catch (e) {
    console.warn("   ⚠️ Could not auto-approve KYC:", e.message);
  }

  // ── Step 3: Transfer contract ownership ──────────────────────────────────
  console.log("3️⃣  Transferring contract ownership...");
  const ownerTx = await gateway.transferOwnership(newAdmin);
  await ownerTx.wait();
  const newOwner = await gateway.owner();
  console.log(`   ✅ New owner: ${newOwner}\n`);

  // ── Step 4: [Localhost only] Fund with mock tokens ───────────────────────
  if (isLocalhost) {
    try {
      const tokenFile = JSON.parse(
        fs.readFileSync("deployed-tokens-localhost.json", "utf8")
      );
      const usdtAddress = tokenFile.mockUSDT;
      const usdcAddress = tokenFile.mockUSDC;

      if (usdtAddress && usdcAddress) {
        console.log("4️⃣  Sending mock USDT & USDC tokens...");

        const usdt = await ethers.getContractAt("MockERC20", usdtAddress, deployer);
        const usdc = await ethers.getContractAt("MockERC20", usdcAddress, deployer);

        const amount = ethers.parseUnits("10000", 6); // 10,000 tokens

        const usdtTx = await usdt.transfer(newAdmin, amount);
        await usdtTx.wait();
        console.log("   ✅ Sent 10,000 USDT");

        const usdcTx = await usdc.transfer(newAdmin, amount);
        await usdcTx.wait();
        console.log("   ✅ Sent 10,000 USDC\n");
      }
    } catch {
      console.log("4️⃣  Skipping token transfer (no mock tokens found)\n");
    }
  } else {
    console.log("4️⃣  Skipping mock token transfer (not on localhost)\n");
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  ✅  All done on ${networkName}! Your MetaMask account now has:`);
  console.log("");
  console.log("  • Contract Owner — full admin access");
  console.log("  • Authorized Reviewer — can approve/reject KYC");
  if (isLocalhost) {
    console.log("  • 100 ETH — for gas fees");
    console.log("  • 10,000 USDT + 10,000 USDC mock tokens");
    console.log("");
    console.log("  Connect MetaMask to http://127.0.0.1:8545 (Chain ID: 1337)");
  } else {
    console.log("");
    console.log(`  Connect MetaMask to Sepolia (Chain ID: 11155111)`);
    console.log("  Make sure you have Sepolia ETH for gas (use a faucet)");
  }
  console.log("═══════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
