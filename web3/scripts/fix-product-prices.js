// Script to fix product prices - set all three payment methods
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🔧 Fixing Product Prices...\n");

  // Read deployed contract addresses
  const deploymentPath = path.join(__dirname, "../deployment-localhost.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ deployment-localhost.json not found!");
    console.error("Please deploy contracts first");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const gatewayAddress = deployment.contracts.CryptoPaymentGateway;

  console.log("📋 Contract Address:");
  console.log(`   Gateway: ${gatewayAddress}`);
  console.log("");

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`👤 Using account: ${signer.address}\n`);

  // Get contract
  const Gateway = await ethers.getContractAt("CryptoPaymentGateway", gatewayAddress);

  // Get all products
  const productIds = await Gateway.getAllProducts();
  console.log(`📦 Found ${productIds.length} products\n`);

  if (productIds.length === 0) {
    console.log("No products to fix. Create a product first.");
    return;
  }

  // Fix each product
  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i];
    const product = await Gateway.products(productId);

    console.log(`\n📦 Product ${productId}: ${product.name}`);
    console.log(`   Current Prices:`);
    console.log(`   - ETH:  ${ethers.formatEther(product.priceETH)}`);
    console.log(`   - USDT: ${ethers.formatUnits(product.priceUSDT, 6)}`);
    console.log(`   - USDC: ${ethers.formatUnits(product.priceUSDC, 6)}`);

    // Check if product needs fixing (any price is 0)
    const needsFix = product.priceETH.isZero() || product.priceUSDT.isZero() || product.priceUSDC.isZero();

    if (!needsFix) {
      console.log(`   ✅ All prices set - no fix needed`);
      continue;
    }

    console.log(`   ⚠️  Some prices are 0 - fixing...`);

    // Set default price: 11.0 for all tokens (matching the screenshot)
    const defaultPriceETH = ethers.parseEther("11.0");
    const defaultPriceUSDT = ethers.parseUnits("11.0", 6);
    const defaultPriceUSDC = ethers.parseUnits("11.0", 6);

    // Use existing prices if they're not zero, otherwise use default
    const newPriceETH = product.priceETH.isZero() ? defaultPriceETH : product.priceETH;
    const newPriceUSDT = product.priceUSDT.isZero() ? defaultPriceUSDT : product.priceUSDT;
    const newPriceUSDC = product.priceUSDC.isZero() ? defaultPriceUSDC : product.priceUSDC;

    try {
      // Update product with all prices
      const tx = await Gateway.updateProduct(
        productId,
        product.name,
        product.description,
        product.ipfsHash,
        newPriceETH,
        newPriceUSDT,
        newPriceUSDC
      );

      console.log(`   📝 Updating product...`);
      await tx.wait();

      // Verify update
      const updatedProduct = await Gateway.products(productId);
      console.log(`   ✅ Product updated!`);
      console.log(`   New Prices:`);
      console.log(`   - ETH:  ${ethers.formatEther(updatedProduct.priceETH)}`);
      console.log(`   - USDT: ${ethers.formatUnits(updatedProduct.priceUSDT, 6)}`);
      console.log(`   - USDC: ${ethers.formatUnits(updatedProduct.priceUSDC, 6)}`);
    } catch (error) {
      console.log(`   ❌ Failed to update: ${error.message}`);
    }
  }

  console.log("\n✅ Product price fix complete!\n");
  console.log("🎉 All products now accept ETH, USDT, and USDC payments!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

