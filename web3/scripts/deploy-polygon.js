// scripts/deploy-polygon.js
// ============================================================
// Deploy CryptoPaymentGateway to Polygon Mainnet and hand ownership to
// POLYGON_OWNER_ADDRESS. No transaction is sent without typed confirmation.
//
// Run:
//   npx hardhat run scripts/deploy-polygon.js --network polygon
// ============================================================
const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const readline = require("node:readline/promises");

// ── Real Polygon Mainnet token addresses ──────────────────────
// ethers v6 enforces EIP-55 checksums; compute them at runtime to be safe.
// Raw (lowercase) addresses sourced from Polygon / Circle official docs:
//   USDC (native): https://developers.circle.com/stablecoins/usdc-on-test-networks
//   USDT         : https://polygonscan.com/token/0xc2132d05d31c914a87c6611c10748aeb04b58e8f
const POLYGON_USDC = ethers.getAddress("0x3c499c542cef5e3811e1192ce70d8cc03d5c3359");
const POLYGON_USDT = ethers.getAddress("0xc2132d05d31c914a87c6611c10748aeb04b58e8f");

async function main() {
  const networkName = hre.network.name;
  const chainId = hre.network.config.chainId;
  const targetOwner = process.env.POLYGON_OWNER_ADDRESS;

  if (chainId !== 137) {
    console.error(`\n❌  Wrong network! Expected Polygon (137), got chainId ${chainId}.`);
    console.error(`    Run: npx hardhat run scripts/deploy-polygon.js --network polygon\n`);
    process.exit(1);
  }

  if (!targetOwner || !ethers.isAddress(targetOwner)) {
    throw new Error("Set POLYGON_OWNER_ADDRESS to the intended owner wallet in web3/.env");
  }

  const checksummedTargetOwner = ethers.getAddress(targetOwner);

  console.log("=".repeat(60));
  console.log(`🚀  Deploying to ${networkName} (Chain ID: ${chainId})`);
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\n📋  Deployer : ${deployer.address}`);
  console.log(`💰  MATIC bal: ${ethers.formatEther(balance)} MATIC`);

  // Keep a conservative balance floor for deployment and ownership handoff.
  if (balance < ethers.parseEther("0.5")) {
    console.error(`\n❌  Insufficient MATIC for gas.`);
    console.error(`    Current: ${ethers.formatEther(balance)} MATIC`);
    console.error(`    Minimum: 0.5 MATIC\n`);
    process.exit(1);
  }

  console.log(`\n🪙  Using real Polygon tokens:`);
  console.log(`    USDC → ${POLYGON_USDC}`);
  console.log(`    USDT → ${POLYGON_USDT}`);
  console.log(`    New owner → ${checksummedTargetOwner}`);

  for (const tokenAddress of [POLYGON_USDC, POLYGON_USDT]) {
    if ((await ethers.provider.getCode(tokenAddress)) === "0x") {
      throw new Error(`No token contract code found at ${tokenAddress}`);
    }
  }

  if (process.env.FORCE_DEPLOY !== "true") {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    const confirmation = await prompt.question(
      "This deploys a NEW Polygon gateway with empty state. Type DEPLOY NEW POLYGON CONTRACT to continue: "
    );
    prompt.close();
    if (confirmation !== "DEPLOY NEW POLYGON CONTRACT") {
      console.log("Deployment cancelled; no transaction was sent.");
      return;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Deploy CryptoPaymentGateway
  // ──────────────────────────────────────────────────────────
  console.log(`\n📦  Deploying CryptoPaymentGateway...`);
  const CryptoPaymentGateway = await ethers.getContractFactory("CryptoPaymentGateway");

  const gateway = await CryptoPaymentGateway.deploy(POLYGON_USDT, POLYGON_USDC);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log(`    ✅  CryptoPaymentGateway → ${gatewayAddress}`);

  const deploymentInfo = {
    network: "polygon",
    chainId: 137,
    deployer: deployer.address,
    owner: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CryptoPaymentGateway: gatewayAddress,
      USDT: POLYGON_USDT,
      USDC: POLYGON_USDC,
    },
  };
  const outFile = "deployment-polygon.json";
  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));

  if (checksummedTargetOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("\n➕ Granting reviewer permission to the target owner...");
    const addReviewerTx = await gateway.addReviewer(checksummedTargetOwner);
    await addReviewerTx.wait();

    console.log("\n➖ Removing the deployer’s reviewer mapping...");
    const removeReviewerTx = await gateway.removeReviewer(deployer.address);
    await removeReviewerTx.wait();

    console.log("\n🔑 Transferring ownership to the target address...");
    const transferTx = await gateway.transferOwnership(checksummedTargetOwner);
    await transferTx.wait();
  }

  const finalOwner = await gateway.owner();
  if (finalOwner.toLowerCase() !== checksummedTargetOwner.toLowerCase()) {
    throw new Error(`Ownership handoff did not complete. Current owner: ${finalOwner}`);
  }
  deploymentInfo.owner = finalOwner;
  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅  Contract owner: ${finalOwner}`);

  console.log(`\n📄  Deployment saved to: ${outFile}`);

  // ──────────────────────────────────────────────────────────
  // Print .env.local snippet
  // ──────────────────────────────────────────────────────────
  const envSnippet = `
# ── Polygon Mainnet (deployed ${new Date().toISOString()}) ──
NEXT_PUBLIC_CHAIN_ID=137
NEXT_PUBLIC_NETWORK=polygon
NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON=${gatewayAddress}
NEXT_PUBLIC_USDC_POLYGON=${POLYGON_USDC}
NEXT_PUBLIC_USDT_POLYGON=${POLYGON_USDT}
`.trim();

  console.log("\n" + "=".repeat(60));
  console.log("✅  DEPLOYMENT COMPLETE — update local config from this snippet");
  console.log("=".repeat(60));
  console.log(envSnippet);
  console.log("=".repeat(60));

  fs.writeFileSync("polygon-env-snippet.txt", envSnippet + "\n");
  console.log("\n📝  Env snippet also saved to: polygon-env-snippet.txt\n");

  const envLocalPath = "../.env.local";
  if (fs.existsSync(envLocalPath)) {
    let localContent = fs.readFileSync(envLocalPath, "utf8");
    if (localContent.includes("NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON=")) {
      localContent = localContent.replace(/NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON=.*/g, `NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON=${gatewayAddress}`);
    } else {
      localContent += `\nNEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON=${gatewayAddress}\n`;
    }
    fs.writeFileSync(envLocalPath, localContent);
    console.log(`✅  Updated NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON in ${envLocalPath}`);
  }

  // ──────────────────────────────────────────────────────────
  // Verify on Polygonscan (optional — needs POLYGONSCAN_API_KEY)
  // ──────────────────────────────────────────────────────────
  const polygonscanKey = process.env.POLYGONSCAN_API_KEY;
  if (polygonscanKey && polygonscanKey !== "YOUR_POLYGONSCAN_KEY") {
    console.log("🔍  Waiting 8 block confirmations before verifying...");
    await gateway.deploymentTransaction().wait(8);

    try {
      await hre.run("verify:verify", {
        address: gatewayAddress,
        constructorArguments: [POLYGON_USDT, POLYGON_USDC],
      });
      console.log("✅  CryptoPaymentGateway verified on Polygonscan");
    } catch (e) {
      console.log(`⚠️  Verification failed (may already be verified): ${e.message}`);
    }
  } else {
    console.log("ℹ️   Skipping Polygonscan verification — set POLYGONSCAN_API_KEY to enable.");
    console.log(`    Manual verify: https://polygonscan.com/verifyContract`);
  }

  console.log("\n🎉  Done! Next steps:");
  console.log("    1. Copy env vars above into .env.local");
  console.log("    2. npm run dev");
  console.log("    3. Connect MetaMask on Polygon → Buy a product → Pay with USDC/USDT\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌  Deploy failed:", err);
    process.exit(1);
  });
