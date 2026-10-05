// scripts/deploy-croploan.js
// ============================================================
// Deploys CropLoan contract to Sepolia (or localhost).
// Reuses the existing Mock USDC already deployed via deploy-sepolia.js.
//
// Run with:
//   npx hardhat run scripts/deploy-croploan.js --network sepolia
//
// After running, copy NEXT_PUBLIC_CROP_LOAN_ADDRESS into .env.local
// ============================================================
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  const chainId = hre.network.config.chainId;

  console.log("=".repeat(60));
  console.log(`🌾 Deploying CropLoan to ${networkName} (Chain ID: ${chainId})`);
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\n📋 Deployer: ${deployer.address}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.005")) {
    console.error(`\n❌ ERROR: Need at least 0.005 Sepolia ETH for gas.`);
    console.error(`   To get Sepolia ETH: https://sepoliafaucet.com`);
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────
  // 1. Read existing USDC address from deployment JSON or env
  // ──────────────────────────────────────────────────────────
  const usdcEnvName = networkName === "sepolia"
    ? "NEXT_PUBLIC_SEPOLIA_USDC_ADDRESS"
    : "NEXT_PUBLIC_USDC_ADDRESS";
  let usdcAddress = process.env[usdcEnvName];

  // Try reading from deployment JSON as fallback
  if (!usdcAddress) {
    try {
      const depFile = path.join(__dirname, "..", `deployment-${networkName}.json`);
      const dep = JSON.parse(fs.readFileSync(depFile, "utf8"));
      usdcAddress = dep.contracts?.USDC;
    } catch (e) {
      console.warn("⚠️  Could not read deployment JSON, trying env...");
    }
  }

  if (!usdcAddress) {
    console.error("❌ ERROR: USDC address not found.");
    console.error("   Set NEXT_PUBLIC_SEPOLIA_USDC_ADDRESS in web3/.env");
    console.error("   Or run deploy-sepolia.js first.");
    process.exit(1);
  }

  console.log(`\n💎 Using USDC at: ${usdcAddress}`);

  // ──────────────────────────────────────────────────────────
  // 2. Deploy CropLoan
  // ──────────────────────────────────────────────────────────
  console.log("\n📦 Deploying CropLoan...");
  const CropLoan = await ethers.getContractFactory("CropLoan");
  const cropLoan = await CropLoan.deploy(usdcAddress);
  await cropLoan.waitForDeployment();
  const cropLoanAddress = await cropLoan.getAddress();
  console.log(`   ✅ CropLoan → ${cropLoanAddress}`);

  // ──────────────────────────────────────────────────────────
  // 3. Fund the lending reserve with 1000 USDC for demo
  //    (Deployer must hold USDC and approve first)
  // ──────────────────────────────────────────────────────────
  console.log("\n🏦 Funding CropLoan reserve with 1,000 USDC...");
  const MockERC20 = await ethers.getContractAt("MockERC20", usdcAddress);

  // Mint 1000 USDC to deployer (MockERC20 allows open mint on testnet)
  const mintAmount = ethers.parseUnits("1000", 6);
  try {
    const mintTx = await MockERC20.mint(deployer.address, mintAmount);
    await mintTx.wait();
    console.log("   ✅ Minted 1,000 USDC to deployer");
  } catch (e) {
    console.warn("   ⚠️  Mint failed (may already have balance):", e.message);
  }

  // Approve CropLoan to spend deployer's USDC
  const approveTx = await MockERC20.approve(cropLoanAddress, mintAmount);
  await approveTx.wait();
  console.log("   ✅ Approved CropLoan to spend USDC");

  // Fund reserve
  const fundTx = await cropLoan.fundReserve(mintAmount);
  await fundTx.wait();
  const reserveBal = await cropLoan.getReserveBalance();
  console.log(`   ✅ Reserve funded: ${ethers.formatUnits(reserveBal, 6)} USDC`);

  // ──────────────────────────────────────────────────────────
  // 4. Save deployment info
  // ──────────────────────────────────────────────────────────
  const deploymentInfo = {
    network: networkName,
    chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CropLoan: cropLoanAddress,
      USDC: usdcAddress,
    },
  };

  const outFile = `deployment-croploan-${networkName}.json`;
  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Deployment saved to: ${outFile}`);

  // ──────────────────────────────────────────────────────────
  // 5. Print .env.local snippet
  // ──────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE — add this to your .env.local:");
  console.log("=".repeat(60));
  console.log(`\nNEXT_PUBLIC_CROP_LOAN_ADDRESS=${cropLoanAddress}\n`);
    const loanEnvName = networkName === "sepolia"
      ? "NEXT_PUBLIC_SEPOLIA_CROP_LOAN_ADDRESS"
      : networkName === "polygon"
      ? "NEXT_PUBLIC_CROP_LOAN_POLYGON_ADDRESS"
      : "NEXT_PUBLIC_CROP_LOAN_ADDRESS";
    console.log(`\n${loanEnvName}=${cropLoanAddress}\n`);
  console.log("=".repeat(60));

  // ──────────────────────────────────────────────────────────
  // 6. Optional Etherscan verification
  // ──────────────────────────────────────────────────────────
  if (
    process.env.ETHERSCAN_API_KEY &&
    process.env.ETHERSCAN_API_KEY !== "YOUR_ETHERSCAN_API_KEY"
  ) {
    console.log("\n🔍 Waiting 6 confirmations before verifying on Etherscan...");
    await cropLoan.deploymentTransaction().wait(6);
    try {
      await hre.run("verify:verify", {
        address: cropLoanAddress,
        constructorArguments: [usdcAddress],
      });
      console.log("   ✅ CropLoan verified on Etherscan");
    } catch (e) {
      console.warn("   ⚠️  Verification failed:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Deploy failed:", err);
    process.exit(1);
  });
