// Script to distribute USDT and USDC tokens to all Hardhat test accounts
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\nDistributing Mock Tokens to Test Accounts...\n");

  // Read deployed token addresses
  const deploymentPath = path.join(__dirname, "../deployment-localhost.json");

  if (!fs.existsSync(deploymentPath)) {
    console.error("ERROR: deployment-localhost.json not found!");
    console.error("Please deploy contracts first using deploy-payment-gateway.js");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const usdtAddress = deployment.contracts.USDT;
  const usdcAddress = deployment.contracts.USDC;

  console.log("Token Addresses:");
  console.log(`   USDT: ${usdtAddress}`);
  console.log(`   USDC: ${usdcAddress}`);
  console.log("");

  // Get signers (Hardhat test accounts)
  const signers = await ethers.getSigners();
  console.log(`Found ${signers.length} test accounts\n`);

  // Get token contracts
  const USDT = await ethers.getContractAt("MockERC20", usdtAddress);
  const USDC = await ethers.getContractAt("MockERC20", usdcAddress);

  // Amount to distribute: 10,000 tokens (with 6 decimals) - using ethers v6 syntax
  const amount = ethers.parseUnits("10000", 6);
  const amountFormatted = "10,000";

  console.log(`Distributing ${amountFormatted} USDT and ${amountFormatted} USDC to each account...\n`);

  // Distribute to all accounts
  for (let i = 0; i < signers.length; i++) {
    const address = signers[i].address;

    try {
      // Transfer USDT
      const usdtTx = await USDT.transfer(address, amount);
      await usdtTx.wait();

      // Transfer USDC
      const usdcTx = await USDC.transfer(address, amount);
      await usdcTx.wait();

      // Get balances - using ethers v6 syntax
      const usdtBalance = await USDT.balanceOf(address);
      const usdcBalance = await USDC.balanceOf(address);

      console.log(`Account ${i}: ${address}`);
      console.log(`   USDT: ${ethers.formatUnits(usdtBalance, 6)}`);
      console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
      console.log("");
    } catch (error) {
      console.log(`WARNING Account ${i}: ${address} - ${error.message}`);
      console.log("");
    }
  }

  console.log("Token distribution complete!\n");

  // Show deployer remaining balance
  const deployerAddress = signers[0].address;
  const deployerUSDT = await USDT.balanceOf(deployerAddress);
  const deployerUSDC = await USDC.balanceOf(deployerAddress);

  console.log("Deployer Remaining Balance:");
  console.log(`   USDT: ${ethers.formatUnits(deployerUSDT, 6)}`);
  console.log(`   USDC: ${ethers.formatUnits(deployerUSDC, 6)}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

