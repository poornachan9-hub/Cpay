// scripts/deploy-mock-tokens.js (FIXED VERSION)
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Mock ERC20 tokens...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Fixed: Use provider.getBalance instead of deployer.getBalance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy Mock USDT
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  console.log("Deploying Mock USDT...");
  const mockUSDT = await MockERC20.deploy(
    "Mock Tether USD",
    "USDT",
    6, // 6 decimals like real USDT
    ethers.parseUnits("1000000", 6) // 1M USDT initial supply
  );
  await mockUSDT.waitForDeployment();
  console.log("Mock USDT deployed to:", await mockUSDT.getAddress());

  // Deploy Mock USDC
  console.log("Deploying Mock USDC...");
  const mockUSDC = await MockERC20.deploy(
    "Mock USD Coin",
    "USDC",
    6, // 6 decimals like real USDC
    ethers.parseUnits("1000000", 6) // 1M USDC initial supply
  );
  await mockUSDC.waitForDeployment();
  console.log("Mock USDC deployed to:", await mockUSDC.getAddress());

  // Save addresses to a file for later use
  const fs = require("fs");
  const addresses = {
    mockUSDT: await mockUSDT.getAddress(),
    mockUSDC: await mockUSDC.getAddress(),
    network: hre.network.name,
    deployer: deployer.address,
  };

  fs.writeFileSync(
    `deployed-tokens-${hre.network.name}.json`,
    JSON.stringify(addresses, null, 2)
  );

  console.log("\n=== Mock Tokens Deployment Summary ===");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Mock USDT: ${await mockUSDT.getAddress()}`);
  console.log(`Mock USDC: ${await mockUSDC.getAddress()}`);
  console.log(`Addresses saved to: deployed-tokens-${hre.network.name}.json`);

  // Verify contracts on Etherscan (only for testnets/mainnet)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\nWaiting for block confirmations...");
    await mockUSDT.deploymentTransaction().wait(6);
    await mockUSDC.deploymentTransaction().wait(6);

    console.log("Verifying contracts...");
    try {
      await hre.run("verify:verify", {
        address: await mockUSDT.getAddress(),
        constructorArguments: [
          "Mock Tether USD",
          "USDT",
          6,
          ethers.parseUnits("1000000", 6),
        ],
      });
      console.log("Mock USDT verified!");
    } catch (error) {
      console.log("Mock USDT verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: await mockUSDC.getAddress(),
        constructorArguments: [
          "Mock USD Coin",
          "USDC",
          6,
          ethers.parseUnits("1000000", 6),
        ],
      });
      console.log("Mock USDC verified!");
    } catch (error) {
      console.log("Mock USDC verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
