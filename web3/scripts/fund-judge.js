// scripts/fund-judge.js
// ============================================================
// Sends 100 USDC from the deployer wallet to the judge's wallet.
// Run this AFTER deploy-sepolia.js.
//
// Usage:
//   JUDGE_ADDRESS=0xJUDGE_WALLET npx hardhat run scripts/fund-judge.js --network sepolia
// ============================================================
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  // Load deployed addresses from JSON
  const deployFile = `deployment-${networkName}.json`;
  if (!fs.existsSync(deployFile)) {
    console.error(`❌ ${deployFile} not found. Run deploy-sepolia.js first.`);
    process.exit(1);
  }

  const { contracts } = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const usdcAddress = contracts.USDC;

  const judgeAddress = process.env.JUDGE_ADDRESS;
  if (!judgeAddress) {
    console.error("❌ Set JUDGE_ADDRESS env var to the judge's wallet address.");
    console.error("   Example: JUDGE_ADDRESS=0x1234... npx hardhat run scripts/fund-judge.js --network sepolia");
    process.exit(1);
  }

  const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ];

  const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, deployer);
  const amount = ethers.parseUnits("100", 6); // 100 USDC

  console.log(`\n💸 Sending 100 USDC to judge: ${judgeAddress}`);
  const tx = await usdc.transfer(judgeAddress, amount);
  await tx.wait();

  const judgeBalance = await usdc.balanceOf(judgeAddress);
  console.log(`✅ Done! Judge's USDC balance: ${ethers.formatUnits(judgeBalance, 6)} USDC`);
  console.log(`🔗 https://sepolia.etherscan.io/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
  });
