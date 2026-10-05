// diagnose.js — Pure ASCII output, no emoji, captures full error
const { ethers } = require("hardhat");

async function main() {
  console.log("=== DIAGNOSTIC START ===");
  console.log("Network name: " + hre.network.name);
  console.log("Chain ID: " + hre.network.config.chainId);
  console.log("RPC URL: " + hre.network.config.url);

  console.log("Getting signers...");
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address: " + deployer.address);

  console.log("Getting balance...");
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("MATIC balance: " + ethers.formatEther(balance));

  console.log("=== DIAGNOSTIC OK ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log("=== ERROR ===");
    console.log("Message: " + err.message);
    console.log("Code: " + err.code);
    console.log("Stack: " + err.stack);
    process.exit(1);
  });
