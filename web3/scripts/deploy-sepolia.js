// scripts/deploy-sepolia.js
// ============================================================
// All-in-one deploy script for Sepolia testnet.
// Deploys: MockUSDT → MockUSDC → CryptoPaymentGateway
//
// Run with:
//   npx hardhat run scripts/deploy-sepolia.js --network sepolia
//
// After running, copy the printed addresses into your .env.local
// ============================================================
const { ethers, hre: _hre } = require("hardhat");
const fs = require("fs");

async function main() {
  const networkName = hre.network.name;
  const chainId = hre.network.config.chainId;

  console.log("=".repeat(60));
  console.log(`🚀 Deploying to ${networkName} (Chain ID: ${chainId})`);
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\n📋 Deployer: ${deployer.address}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} ETH`);

  // Need at least 0.01 ETH for gas to deploy 3 contracts
  if (balance < ethers.parseEther("0.01")) {
    console.error(`\n❌ ERROR: Deployer wallet has insufficient Sepolia ETH.`);
    console.error(`   Current balance: ${ethers.formatEther(balance)} ETH`);
    console.error(`   Minimum needed:  0.01 ETH (for gas)`);
    console.error(`\n👉 Two issues to fix:`);
    console.error(`   1. Make sure PRIVATE_KEY in web3/.env is YOUR real wallet's private key.`);
    console.error(`      (NOT the placeholder 0xacb123... key)`);
    console.error(`   2. Get free Sepolia ETH from one of these faucets:`);
    console.error(`      - https://sepoliafaucet.com`);
    console.error(`      - https://faucet.sepolia.dev`);
    console.error(`      - https://www.alchemy.com/faucets/ethereum-sepolia`);
    console.error(`\n   Your deployer address: ${deployer.address}`);
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────
  // 1. Deploy Mock USDT
  // ──────────────────────────────────────────────────────────
  console.log("\n📦 1/3  Deploying Mock USDT...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const mockUSDT = await MockERC20.deploy(
    "Mock Tether USD",
    "USDT",
    6,                                        // 6 decimals like real USDT
    ethers.parseUnits("10000000", 6)          // 10M USDT initial supply
  );
  await mockUSDT.waitForDeployment();
  const usdtAddress = await mockUSDT.getAddress();
  console.log(`   ✅ Mock USDT → ${usdtAddress}`);

  // ──────────────────────────────────────────────────────────
  // 2. Deploy Mock USDC
  // ──────────────────────────────────────────────────────────
  console.log("\n📦 2/3  Deploying Mock USDC...");
  const mockUSDC = await MockERC20.deploy(
    "Mock USD Coin",
    "USDC",
    6,                                        // 6 decimals like real USDC
    ethers.parseUnits("10000000", 6)          // 10M USDC initial supply
  );
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log(`   ✅ Mock USDC → ${usdcAddress}`);

  // ──────────────────────────────────────────────────────────
  // 3. Deploy CryptoPaymentGateway
  // ──────────────────────────────────────────────────────────
  console.log("\n📦 3/3  Deploying CryptoPaymentGateway...");
  const CryptoPaymentGateway = await ethers.getContractFactory("CryptoPaymentGateway");

  const gateway = await CryptoPaymentGateway.deploy(usdtAddress, usdcAddress);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log(`   ✅ CryptoPaymentGateway → ${gatewayAddress}`);

  // ──────────────────────────────────────────────────────────
  // 4. Mint some USDC to deployer for the demo
  //    (10 000 USDC so you can fund the judge's wallet easily)
  // ──────────────────────────────────────────────────────────
  console.log("\n🪙  Minting 10,000 USDC to deployer for demo...");
  const mintTx = await mockUSDC.mint(deployer.address, ethers.parseUnits("10000", 6));
  await mintTx.wait();
  console.log("   ✅ Minted 10,000 USDC to deployer");

  // ──────────────────────────────────────────────────────────
  // 5. Save deployment to JSON
  // ──────────────────────────────────────────────────────────
  const deploymentInfo = {
    network: networkName,
    chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CryptoPaymentGateway: gatewayAddress,
      USDT: usdtAddress,
      USDC: usdcAddress,
    },
  };

  const outFile = `deployment-${networkName}.json`;
  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));

  // ──────────────────────────────────────────────────────────
  // 6. Print copy-paste block for .env.local
  // ──────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE — copy these into your .env.local");
  console.log("=".repeat(60));
  console.log(`
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_PAYMENT_GATEWAY_ADDRESS=${gatewayAddress}
NEXT_PUBLIC_SEPOLIA_USDT_ADDRESS=${usdtAddress}
NEXT_PUBLIC_SEPOLIA_USDC_ADDRESS=${usdcAddress}
  `.trim());
  console.log("=".repeat(60));
  console.log(`\n📄 Full deployment saved to: ${outFile}`);

  // ──────────────────────────────────────────────────────────
  // 7. Print "fund the judge" command
  // ──────────────────────────────────────────────────────────
  console.log("\n📌 NEXT STEP — fund the judge's wallet with 100 USDC:");
  console.log(`   npx hardhat run scripts/fund-judge.js --network sepolia`);
  console.log(`   (or send 100 USDC from MetaMask using the MockUSDC address above)\n`);

  // ──────────────────────────────────────────────────────────
  // Optional: verify contracts on Etherscan (skip if no API key)
  // ──────────────────────────────────────────────────────────
  if (process.env.ETHERSCAN_API_KEY && process.env.ETHERSCAN_API_KEY !== "YOUR_ETHERSCAN_API_KEY") {
    console.log("\n🔍 Waiting 6 block confirmations before verifying...");
    await gateway.deploymentTransaction().wait(6);

    for (const [name, addr, args] of [
      ["MockUSDT", usdtAddress, ["Mock Tether USD", "USDT", 6, ethers.parseUnits("10000000", 6)]],
      ["MockUSDC", usdcAddress, ["Mock USD Coin", "USDC", 6, ethers.parseUnits("10000000", 6)]],
      ["CryptoPaymentGateway", gatewayAddress, [usdtAddress, usdcAddress]],
    ]) {
      try {
        await hre.run("verify:verify", { address: addr, constructorArguments: args });
        console.log(`   ✅ ${name} verified on Etherscan`);
      } catch (e) {
        console.log(`   ⚠️  ${name} verification failed: ${e.message}`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Deploy failed:", err);
    process.exit(1);
  });
