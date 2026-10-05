// scripts/grant-admin-all.js
// ─────────────────────────────────────────────────────────────────────────────
// Grants admin access on the CURRENT network (passed via --network flag).
// This script is called by the PowerShell wrapper grant-admin.ps1.
//
// NEW ADMIN WALLET : 0x9f7A82baE2cb215E887bbBA1D73501c57163e210
// COMPROMISED (BLOCKED): 0x52b6af09417423ed709c9C11bbbbe967b1a4F561
// ─────────────────────────────────────────────────────────────────────────────
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ⚠️  PERMANENTLY BLOCKED: compromised account, never grant admin to this address
const COMPROMISED_ADDRESS = "0x52b6af09417423ed709c9C11bbbbe967b1a4F561";

async function main() {
  const newAdmin = process.env.ADMIN_ADDRESS;
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";

  if (!newAdmin || !ethers.isAddress(newAdmin)) {
    console.error("ERROR: Invalid ADMIN_ADDRESS");
    process.exit(1);
  }

  // !! SECURITY: block the permanently-compromised account
  if (newAdmin.toLowerCase() === COMPROMISED_ADDRESS.toLowerCase()) {
    console.error("BLOCKED: This address is compromised and permanently removed from this project.");
    console.error("  Blocked: " + COMPROMISED_ADDRESS);
    console.error("  Use the new admin: 0x9f7A82baE2cb215E887bbBA1D73501c57163e210");
    process.exit(1);
  }

  console.log(`Network: ${networkName.toUpperCase()}`);
  console.log("-".repeat(50));

  // Load deployment info
  const deployFile = path.join(__dirname, "..", `deployment-${networkName}.json`);
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  } catch {
    console.log(`⚠️  No deployment found for ${networkName} (${deployFile})`);
    console.log(`   Skipping ${networkName}...\n`);
    return;
  }

  const gatewayAddress = deploymentInfo.contracts.CryptoPaymentGateway;
  const [deployer] = await ethers.getSigners();

  console.log(`  Contract:  ${gatewayAddress}`);
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`  New Admin: ${newAdmin}`);

  // Connect to contract
  const gateway = await ethers.getContractAt(
    "CryptoPaymentGateway",
    gatewayAddress,
    deployer
  );

  // Verify ownership
  const currentOwner = await gateway.owner();
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(`  ⚠️  Deployer is not the owner. Owner is ${currentOwner}`);
    console.log(`  Skipping ${networkName}...\n`);
    return;
  }

  // Check if already the admin
  if (currentOwner.toLowerCase() === newAdmin.toLowerCase()) {
    console.log(`  ✅ Already the owner — nothing to do!\n`);
    return;
  }

  // [Localhost] Fund ETH
  if (isLocalhost) {
    console.log(`  💰 Sending 100 ETH...`);
    const tx = await deployer.sendTransaction({
      to: newAdmin,
      value: ethers.parseEther("100"),
    });
    await tx.wait();
    console.log(`  ✅ 100 ETH sent`);
  }

  // Add reviewer
  console.log(`  🔍 Granting reviewer access...`);
  const rTx = await gateway.addReviewer(newAdmin);
  await rTx.wait();
  console.log(`  ✅ Reviewer access granted`);

  // Transfer ownership
  console.log(`  👑 Transferring ownership...`);
  const oTx = await gateway.transferOwnership(newAdmin);
  await oTx.wait();
  console.log(`  ✅ Ownership transferred`);

  // [Localhost] Fund mock tokens
  if (isLocalhost) {
    try {
      const tokenFile = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "deployed-tokens-localhost.json"), "utf8")
      );
      if (tokenFile.mockUSDT && tokenFile.mockUSDC) {
        console.log(`  🪙 Sending mock tokens...`);
        const usdt = await ethers.getContractAt("MockERC20", tokenFile.mockUSDT, deployer);
        const usdc = await ethers.getContractAt("MockERC20", tokenFile.mockUSDC, deployer);
        const amt = ethers.parseUnits("10000", 6);
        await (await usdt.transfer(newAdmin, amt)).wait();
        await (await usdc.transfer(newAdmin, amt)).wait();
        console.log(`  ✅ 10,000 USDT + 10,000 USDC sent`);
      }
    } catch {}
  }

  console.log(`  🎉 ${networkName} — DONE!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("  ❌ Error:", error.message);
    process.exit(1);
  });
