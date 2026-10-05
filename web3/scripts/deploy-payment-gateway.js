// scripts/deploy-payment-gateway.js (FIXED VERSION)
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying Crypto Payment Gateway...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Fixed: Use provider.getBalance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  let usdtAddress, usdcAddress;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    // For localhost, try to read previously deployed mock tokens
    try {
      const tokenAddresses = JSON.parse(
        fs.readFileSync(`deployed-tokens-${hre.network.name}.json`, "utf8")
      );
      usdtAddress = tokenAddresses.mockUSDT;
      usdcAddress = tokenAddresses.mockUSDC;
      console.log("Using previously deployed mock tokens:");
      console.log(`USDT: ${usdtAddress}`);
      console.log(`USDC: ${usdcAddress}`);
    } catch (error) {
      console.log(
        "Mock tokens not found. Please run 'npx hardhat run scripts/deploy-mock-tokens.js --network localhost' first"
      );
      process.exit(1);
    }
  } else if (hre.network.name === "holesky") {
    // For Holesky, use environment variables or deploy mock tokens
    usdtAddress = process.env.HOLESKY_USDT_ADDRESS;
    usdcAddress = process.env.HOLESKY_USDC_ADDRESS;

    if (!usdtAddress || !usdcAddress) {
      console.log(
        "USDT/USDC addresses not provided for Holesky. Deploying mock tokens..."
      );

      // Deploy mock tokens
      const MockERC20 = await ethers.getContractFactory("MockERC20");

      const mockUSDT = await MockERC20.deploy(
        "Mock Tether USD",
        "USDT",
        6,
        ethers.parseUnits("1000000", 6)
      );
      await mockUSDT.waitForDeployment();
      usdtAddress = await mockUSDT.getAddress();

      const mockUSDC = await MockERC20.deploy(
        "Mock USD Coin",
        "USDC",
        6,
        ethers.parseUnits("1000000", 6)
      );
      await mockUSDC.waitForDeployment();
      usdcAddress = await mockUSDC.getAddress();

      console.log("Mock tokens deployed:");
      console.log(`USDT: ${usdtAddress}`);
      console.log(`USDC: ${usdcAddress}`);
    }
  }

  // Deploy the main contract
  console.log("Deploying CryptoPaymentGateway...");
  const CryptoPaymentGateway = await ethers.getContractFactory(
    "CryptoPaymentGateway"
  );

  const paymentGateway = await CryptoPaymentGateway.deploy(
    usdtAddress,
    usdcAddress
  );
  await paymentGateway.waitForDeployment();

  console.log(
    "CryptoPaymentGateway deployed to:",
    await paymentGateway.getAddress()
  );

  // Save deployment information
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CryptoPaymentGateway: await paymentGateway.getAddress(),
      USDT: usdtAddress,
      USDC: usdcAddress,
    },
    constructorArgs: [usdtAddress, usdcAddress],
  };

  fs.writeFileSync(
    `deployment-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n=== Deployment Summary ===");
  console.log(
    `Network: ${hre.network.name} (Chain ID: ${hre.network.config.chainId})`
  );
  console.log(`CryptoPaymentGateway: ${await paymentGateway.getAddress()}`);
  console.log(`USDT Token: ${usdtAddress}`);
  console.log(`USDC Token: ${usdcAddress}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Deployment info saved to: deployment-${hre.network.name}.json`);

  // Verify contract on Etherscan (only for testnets/mainnet)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\nWaiting for block confirmations...");
    await paymentGateway.deploymentTransaction().wait(6);

    console.log("Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: await paymentGateway.getAddress(),
        constructorArguments: [usdtAddress, usdcAddress],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Contract verification failed:", error.message);
    }
  }

  // Setup initial configuration (optional)
  console.log("\nSetting up initial configuration...");

  // Add deployer as authorized reviewer (already done in constructor)
  console.log("Deployer is already set as authorized reviewer");

  // Log current platform fee
  const platformFee = await paymentGateway.platformFeeRate();
  console.log(`Platform fee rate: ${Number(platformFee) / 100}%`);

  console.log("\n=== Next Steps ===");
  console.log("1. Update your frontend with the deployed contract addresses");
  console.log("2. Fund the mock tokens if needed for testing");
  console.log("3. Test the KYC submission and approval flow");
  console.log("4. Test product creation and payment processing");

  if (hre.network.name === "localhost") {
    console.log("\nFor localhost testing:");
    console.log("- Make sure your Hardhat node is running");
    console.log("- Use the provided mock tokens for testing payments");
    console.log("- The deployer account has initial supply of both tokens");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
