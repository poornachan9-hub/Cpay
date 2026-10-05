import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, PAYMENT_TOKENS, getContractAddresses } from "../lib/constants";

// ERC20 ABI for token interactions
const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

class ContractService {
  constructor() {
    // NOTE: contractAddress is resolved dynamically in getReadOnlyContract
    // and getContractWithWagmi to always use the correct network addresses.
    // Do NOT cache it here — env vars may not be fully evaluated at module init.
  }

  // Gas estimation helper
  async estimateGasWithBuffer(contract, methodName, params, options = {}) {
    try {
      console.log(`⛽ Estimating gas for ${methodName}...`);
      const gasEstimate = await contract.estimateGas[methodName](
        ...params,
        options
      );

      // Add 20% buffer
      const gasLimit = gasEstimate.mul(120).div(100);

      console.log(
        `✅ Gas estimate: ${gasEstimate.toString()}, with buffer: ${gasLimit.toString()}`
      );
      return gasLimit;
    } catch (error) {
      console.error(`❌ Gas estimation failed for ${methodName}:`, error);
      throw new Error(
        `Gas estimation failed: ${error.reason || error.message}`
      );
    }
  }

  // Get gas price with buffer
  async getGasPriceWithBuffer(provider) {
    const gasPrice = await provider.getGasPrice();
    return gasPrice.mul(110).div(100); // 10% buffer
  }

  // Initialize contract with signer or provider
  getContract(signerOrProvider, abi, contractAddress) {
    // Allow callers to pass an explicit address; fall back to env-resolved one
    const addr = contractAddress || CONTRACT_ADDRESSES.PAYMENT_GATEWAY;
    if (
      signerOrProvider &&
      signerOrProvider.account &&
      signerOrProvider.transport
    ) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      return new ethers.Contract(addr, abi, signer);
    }
    return new ethers.Contract(addr, abi, signerOrProvider);
  }

  async getContractWithWagmi(walletClient, abi) {
    if (!walletClient) {
      throw new Error("Wallet client is required");
    }

    if (typeof window !== "undefined" && window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      const addresses = getContractAddresses(network.chainId);
      const signer = provider.getSigner();
      return new ethers.Contract(addresses.PAYMENT_GATEWAY, abi, signer);
    }

    throw new Error("No ethereum provider found");
  }

  // Token approval functions
  async getTokenContract(tokenAddress, signer) {
    return new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  }

  async checkTokenAllowance(
    tokenAddress,
    ownerAddress,
    spenderAddress,
    signer
  ) {
    try {
      const tokenContract = await this.getTokenContract(tokenAddress, signer);
      const allowance = await tokenContract.allowance(
        ownerAddress,
        spenderAddress
      );
      const balance = await tokenContract.balanceOf(ownerAddress);
      const symbol = await tokenContract.symbol();

      console.log(`📊 ${symbol} Token Info:`);
      console.log(`  - Balance: ${allowance.toString()}`);
      console.log(`  - Allowance: ${allowance.toString()}`);

      return {
        allowance,
        balance,
        symbol,
      };
    } catch (error) {
      console.error("❌ Error checking token allowance:", error);
      throw error;
    }
  }

  async approveToken(tokenAddress, spenderAddress, amount, signer) {
    try {
      console.log("🔓 Approving token...");
      const tokenContract = await this.getTokenContract(tokenAddress, signer);

      // Estimate gas for approval
      const gasLimit = await this.estimateGasWithBuffer(
        tokenContract,
        "approve",
        [spenderAddress, amount]
      );
      const gasPrice = await this.getGasPriceWithBuffer(signer.provider);

      const tx = await tokenContract.approve(spenderAddress, amount, {
        gasLimit,
        gasPrice,
      });

      console.log("✅ Token approval sent:", tx.hash);
      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Token approval failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced KYC Functions with gas estimation
  async submitKYC(contract, ipfsHash) {
    try {
      console.log("📝 Submitting KYC:", ipfsHash);

      if (!ipfsHash || ipfsHash.trim() === "") {
        throw new Error("IPFS hash cannot be empty");
      }

      // Check current KYC status
      const signer = contract.signer;
      const userAddress = await signer.getAddress();

      try {
        const currentKYC = await contract.kycData(userAddress);
        const currentStatus = currentKYC.status.toNumber();

        if (currentStatus === 1) {
          throw new Error("KYC is already pending review");
        } else if (currentStatus === 2) {
          throw new Error("KYC is already approved");
        }
      } catch (error) {
        if (!error.message.includes("already")) {
          console.warn("⚠️ Could not check current status:", error.message);
        } else {
          throw error;
        }
      }

      // Estimate gas with buffer
      const gasLimit = await this.estimateGasWithBuffer(contract, "submitKYC", [
        ipfsHash,
      ]);
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.submitKYC(ipfsHash, {
        gasLimit,
        gasPrice,
      });

      console.log("✅ KYC submitted:", tx.hash);
      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error submitting KYC:", error);
      return { success: false, error: error.message };
    }
  }

  async reviewKYC(contract, userAddress, approved, rejectionReason = "") {
    try {
      const gasLimit = await this.estimateGasWithBuffer(contract, "reviewKYC", [
        userAddress,
        approved,
        rejectionReason,
      ]);
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.reviewKYC(
        userAddress,
        approved,
        rejectionReason,
        {
          gasLimit,
          gasPrice,
        }
      );

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error reviewing KYC:", error);
      return { success: false, error: error.message };
    }
  }

  async cancelKYC(contract, userAddress) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(contract, "cancelKYC", [
        userAddress,
      ]);
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.cancelKYC(userAddress, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error cancelling KYC:", error);
      return { success: false, error: error.message };
    }
  }

  async submitAadhaarProof(contract, proofHash) {
    try {
      console.log("🔒 Submitting Aadhaar proof:", proofHash);

      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "submitAadhaarProof",
        [proofHash]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.submitAadhaarProof(proofHash, {
        gasLimit,
        gasPrice,
      });

      console.log("✅ Aadhaar proof submitted:", tx.hash);
      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error submitting Aadhaar proof:", error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced Product Functions with gas estimation
  async createProduct(
    contract,
    name,
    description,
    ipfsHash,
    priceETH,
    priceUSDT,
    priceUSDC
  ) {
    try {
      const params = [
        name,
        description,
        ipfsHash,
        ethers.utils.parseEther(priceETH.toString()),
        ethers.utils.parseUnits(priceUSDT.toString(), 6),
        ethers.utils.parseUnits(priceUSDC.toString(), 6),
      ];

      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "createProduct",
        params
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.createProduct(...params, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error creating product:", error);
      return { success: false, error: error.message };
    }
  }

  async updateProduct(
    contract,
    productId,
    name,
    description,
    ipfsHash,
    priceETH,
    priceUSDT,
    priceUSDC
  ) {
    try {
      const params = [
        productId,
        name,
        description,
        ipfsHash,
        ethers.utils.parseEther(priceETH.toString()),
        ethers.utils.parseUnits(priceUSDT.toString(), 6),
        ethers.utils.parseUnits(priceUSDC.toString(), 6),
      ];

      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "updateProduct",
        params
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.updateProduct(...params, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error updating product:", error);
      return { success: false, error: error.message };
    }
  }

  async pauseProduct(contract, productId) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "pauseProduct",
        [productId]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.pauseProduct(productId, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error pausing product:", error);
      return { success: false, error: error.message };
    }
  }

  async resumeProduct(contract, productId) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "resumeProduct",
        [productId]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.resumeProduct(productId, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error resuming product:", error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced Payment Functions with token approval
  async payWithETH(contract, productId, ipfsHash, ethAmount) {
    try {
      const value = ethers.utils.parseEther(ethAmount.toString());

      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "payWithETH",
        [productId, ipfsHash],
        { value }
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.payWithETH(productId, ipfsHash, {
        value,
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error paying with ETH:", error);
      return { success: false, error: error.message };
    }
  }

  async payWithUSDT(contract, productId, ipfsHash, tokenAddress) {
    try {
      console.log("💰 Processing USDT payment...");

      // Get product details to check price
      const product = await contract.products(productId);
      const requiredAmount = product.priceUSDT;

      // Check if price is zero (handle both BigNumber and regular numbers)
      const isZero = requiredAmount.isZero ? requiredAmount.isZero() : requiredAmount.toString() === "0";
      if (isZero) {
        throw new Error("USDT payment not accepted for this product");
      }

      const signer = contract.signer;
      const userAddress = await signer.getAddress();

      console.log(tokenAddress, userAddress, contract.address, signer);

      // Check token allowance and balance
      const tokenInfo = await this.checkTokenAllowance(
        tokenAddress,
        userAddress,
        contract.address,
        signer
      );

      if (tokenInfo.balance.lt(requiredAmount)) {
        throw new Error(
          `Insufficient USDT balance. Required: ${ethers.utils.formatUnits(
            requiredAmount,
            6
          )} USDT`
        );
      }

      // Check if approval is needed
      if (tokenInfo.allowance.lt(requiredAmount)) {
        console.log("🔓 USDT approval required...");

        // Request approval for exact amount or max amount
        const approvalAmount = requiredAmount; // or ethers.constants.MaxUint256 for unlimited
        const approvalResult = await this.approveToken(
          tokenAddress,
          contract.address,
          approvalAmount,
          signer
        );

        if (!approvalResult.success) {
          throw new Error("Token approval failed: " + approvalResult.error);
        }

        console.log("✅ USDT approved, waiting for confirmation...");
        await approvalResult.tx.wait(); // Wait for approval to be mined
        console.log("✅ Approval confirmed");
      }

      // Now proceed with payment
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "payWithUSDT",
        [productId, ipfsHash]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.payWithUSDT(productId, ipfsHash, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error paying with USDT:", error);
      return { success: false, error: error.message };
    }
  }

  async payWithUSDC(contract, productId, ipfsHash, tokenAddress) {
    try {
      console.log("💰 Processing USDC payment...");

      // Get product details to check price
      const product = await contract.products(productId);
      const requiredAmount = product.priceUSDC;

      // Check if price is zero (handle both BigNumber and regular numbers)
      const isZero = requiredAmount.isZero ? requiredAmount.isZero() : requiredAmount.toString() === "0";
      if (isZero) {
        throw new Error("USDC payment not accepted for this product");
      }

      const signer = contract.signer;
      const userAddress = await signer.getAddress();

      // Check token allowance and balance
      const tokenInfo = await this.checkTokenAllowance(
        tokenAddress,
        userAddress,
        contract.address,
        signer
      );

      if (tokenInfo.balance.lt(requiredAmount)) {
        throw new Error(
          `Insufficient USDC balance. Required: ${ethers.utils.formatUnits(
            requiredAmount,
            6
          )} USDC`
        );
      }

      // Check if approval is needed
      if (tokenInfo.allowance.lt(requiredAmount)) {
        console.log("🔓 USDC approval required...");

        const approvalAmount = requiredAmount;
        const approvalResult = await this.approveToken(
          tokenAddress,
          contract.address,
          approvalAmount,
          signer
        );

        if (!approvalResult.success) {
          throw new Error("Token approval failed: " + approvalResult.error);
        }

        console.log("✅ USDC approved, waiting for confirmation...");
        await approvalResult.tx.wait();
        console.log("✅ Approval confirmed");
      }

      // Proceed with payment
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "payWithUSDC",
        [productId, ipfsHash]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.payWithUSDC(productId, ipfsHash, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error paying with USDC:", error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced Payout Functions
  async processPayout(contract, merchantAddress, token) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "processPayout",
        [merchantAddress, token]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.processPayout(merchantAddress, token, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error processing payout:", error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced Administrative Functions
  async updatePlatformFee(contract, newFeeRate) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "updatePlatformFee",
        [newFeeRate]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.updatePlatformFee(newFeeRate, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error updating platform fee:", error);
      return { success: false, error: error.message };
    }
  }

  async addReviewer(contract, reviewerAddress) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "addReviewer",
        [reviewerAddress]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.addReviewer(reviewerAddress, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error adding reviewer:", error);
      return { success: false, error: error.message };
    }
  }

  async removeReviewer(contract, reviewerAddress) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "removeReviewer",
        [reviewerAddress]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.removeReviewer(reviewerAddress, {
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error removing reviewer:", error);
      return { success: false, error: error.message };
    }
  }

  async emergencyPause(contract) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "emergencyPause",
        []
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.emergencyPause({
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error pausing contract:", error);
      return { success: false, error: error.message };
    }
  }

  async emergencyUnpause(contract) {
    try {
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "emergencyUnpause",
        []
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      const tx = await contract.emergencyUnpause({
        gasLimit,
        gasPrice,
      });

      return { success: true, tx, hash: tx.hash };
    } catch (error) {
      console.error("❌ Error unpausing contract:", error);
      return { success: false, error: error.message };
    }
  }

  // Add this to your ContractService class in contractService.js

  async withdrawPlatformFees(contract, tokenType, amount) {
    try {
      console.log(
        `💰 Withdrawing platform fees: ${amount} of token type ${tokenType}`
      );

      // Validate inputs
      if (!contract) {
        throw new Error("Contract instance is required");
      }

      if (tokenType < 0 || tokenType > 2) {
        throw new Error(
          "Invalid token type. Must be 0 (ETH), 1 (USDT), or 2 (USDC)"
        );
      }

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // Parse amount based on token type
      let parsedAmount;
      const tokenNames = ["ETH", "USDT", "USDC"];

      if (tokenType === 0) {
        // ETH
        parsedAmount = ethers.utils.parseEther(amount.toString());
      } else {
        // USDT or USDC (both have 6 decimals)
        parsedAmount = ethers.utils.parseUnits(amount.toString(), 6);
      }

      console.log(
        `📊 Parsed amount: ${parsedAmount.toString()} for ${
          tokenNames[tokenType]
        }`
      );

      // Check contract balance before withdrawal
      let contractBalance;
      if (tokenType === 0) {
        // ETH
        contractBalance = await contract.provider.getBalance(contract.address);
        console.log(
          `💎 Contract ETH balance: ${ethers.utils.formatEther(
            contractBalance
          )} ETH`
        );

        if (contractBalance.lt(parsedAmount)) {
          throw new Error(
            `Insufficient ETH balance. Contract has ${ethers.utils.formatEther(
              contractBalance
            )} ETH, but ${amount} ETH requested`
          );
        }
      } else {
        // For USDT/USDC, the contract will handle balance check
        console.log(
          `🏦 Withdrawing ${amount} ${tokenNames[tokenType]} (contract will verify balance)`
        );
      }

      // Estimate gas for the withdrawal
      const gasLimit = await this.estimateGasWithBuffer(
        contract,
        "withdrawPlatformFees",
        [tokenType, parsedAmount]
      );
      const gasPrice = await this.getGasPriceWithBuffer(contract.provider);

      // Execute withdrawal
      const tx = await contract.withdrawPlatformFees(tokenType, parsedAmount, {
        gasLimit,
        gasPrice,
      });

      console.log(`✅ Platform fees withdrawal transaction sent: ${tx.hash}`);
      console.log(`📤 Withdrawing ${amount} ${tokenNames[tokenType]} to owner`);

      return {
        success: true,
        tx,
        hash: tx.hash,
        amount: amount,
        token: tokenNames[tokenType],
        message: `Successfully initiated withdrawal of ${amount} ${tokenNames[tokenType]}`,
      };
    } catch (error) {
      console.error("❌ Error withdrawing platform fees:", error);

      // Parse common error messages
      let errorMessage = error.message;
      if (error.message.includes("Insufficient balance")) {
        errorMessage = "Insufficient contract balance for withdrawal";
      } else if (error.message.includes("Ownable: caller is not the owner")) {
        errorMessage = "Only the contract owner can withdraw platform fees";
      } else if (error.message.includes("user rejected")) {
        errorMessage = "Transaction was rejected by user";
      }

      return {
        success: false,
        error: errorMessage,
        originalError: error.message,
      };
    }
  }

  // Helper function to get contract balances
  async getContractBalances(contract) {
    try {
      const balances = {};

      // Get ETH balance
      const ethBalance = await contract.provider.getBalance(contract.address);
      balances.eth = ethers.utils.formatEther(ethBalance);

      // Get USDT balance (if USDT contract address is available)
      try {
        const usdtContract = await this.getTokenContract(
          CONTRACT_ADDRESSES.USDT,
          contract.provider
        );
        const usdtBalance = await usdtContract.balanceOf(contract.address);
        balances.usdt = ethers.utils.formatUnits(usdtBalance, 6);
      } catch (error) {
        console.warn("Could not fetch USDT balance:", error.message);
        balances.usdt = "0";
      }

      // Get USDC balance (if USDC contract address is available)
      try {
        const usdcContract = await this.getTokenContract(
          CONTRACT_ADDRESSES.USDC,
          contract.provider
        );
        const usdcBalance = await usdcContract.balanceOf(contract.address);
        balances.usdc = ethers.utils.formatUnits(usdcBalance, 6);
      } catch (error) {
        console.warn("Could not fetch USDC balance:", error.message);
        balances.usdc = "0";
      }

      return { success: true, data: balances };
    } catch (error) {
      console.error("Error getting contract balances:", error);
      return { success: false, error: error.message };
    }
  }

  // Keep existing read-only functions unchanged
  async getKYCData(contract, userAddress) {
    try {
      const kycData = await contract.kycData(userAddress);
      return {
        success: true,
        data: {
          id: kycData.id.toString(),
          user: kycData.user,
          ipfsHash: kycData.ipfsHash,
          status: kycData.status,
          submittedAt: kycData.submittedAt.toString(),
          reviewedAt: kycData.reviewedAt.toString(),
          rejectionReason: kycData.rejectionReason,
          reviewedBy: kycData.reviewedBy,
        },
      };
    } catch (error) {
      console.error("❌ Error getting KYC data:", error);
      return { success: false, error: error.message };
    }
  }

  async getProduct(contract, productId) {
    try {
      const product = await contract.products(productId);
      return {
        success: true,
        data: {
          id: product.id.toString(),
          merchant: product.merchant,
          name: product.name,
          description: product.description,
          ipfsHash: product.ipfsHash,
          priceETH: ethers.utils.formatEther(product.priceETH),
          priceUSDT: ethers.utils.formatUnits(product.priceUSDT, 6),
          priceUSDC: ethers.utils.formatUnits(product.priceUSDC, 6),
          status: product.status,
          createdAt: product.createdAt.toString(),
          totalSales: product.totalSales.toString(),
          totalRevenue: product.totalRevenue.toString(),
          isActive: product.isActive,
        },
      };
    } catch (error) {
      console.error("❌ Error getting product:", error);
      return { success: false, error: error.message };
    }
  }

  async getAllProducts(contract) {
    try {
      const productIds = await contract.getAllProducts();
      const products = [];

      for (const id of productIds) {
        const productResult = await this.getProduct(contract, id);
        if (productResult.success) {
          products.push(productResult.data);
        }
      }

      return { success: true, data: products };
    } catch (error) {
      console.error("❌ Error getting all products:", error);
      return { success: false, error: error.message };
    }
  }

  async getMerchantProducts(contract, merchantAddress) {
    try {
      const productIds = await contract.getMerchantProducts(merchantAddress);
      const products = [];

      for (const id of productIds) {
        const productResult = await this.getProduct(contract, id);
        if (productResult.success) {
          products.push(productResult.data);
        }
      }

      return { success: true, data: products };
    } catch (error) {
      console.error("❌ Error getting merchant products:", error);
      return { success: false, error: error.message };
    }
  }

  async getMerchantAnalytics(contract, merchantAddress) {
    try {
      const analytics = await contract.getMerchantAnalytics(merchantAddress);
      return {
        success: true,
        data: {
          totalTransactions: analytics.totalTransactions.toString(),
          totalRevenue: analytics.totalRevenue.toString(),
          totalProducts: analytics.totalProducts.toString(),
          lastPayoutTime: analytics.lastPayoutTime.toString(),
          ethRevenue: ethers.utils.formatEther(analytics.ethRevenue),
          usdtRevenue: ethers.utils.formatUnits(analytics.usdtRevenue, 6),
          usdcRevenue: ethers.utils.formatUnits(analytics.usdcRevenue, 6),
        },
      };
    } catch (error) {
      console.error("❌ Error getting merchant analytics:", error);
      return { success: false, error: error.message };
    }
  }

  async getPlatformAnalytics(contract) {
    try {
      const analytics = await contract.getPlatformAnalytics();
      return {
        success: true,
        data: {
          totalTransactions: analytics.totalTransactions.toString(),
          totalRevenue: analytics.totalRevenue.toString(),
          totalMerchants: analytics.totalMerchants.toString(),
          totalProducts: analytics.totalProducts.toString(),
          ethVolume: ethers.utils.formatEther(analytics.ethVolume),
          usdtVolume: ethers.utils.formatUnits(analytics.usdtVolume, 6),
          usdcVolume: ethers.utils.formatUnits(analytics.usdcVolume, 6),
        },
      };
    } catch (error) {
      console.error("❌ Error getting platform analytics:", error);
      return { success: false, error: error.message };
    }
  }

  async getPendingPayouts(contract, merchantAddress) {
    try {
      const payouts = await contract.getPendingPayouts(merchantAddress);
      return {
        success: true,
        data: {
          ethAmount: ethers.utils.formatEther(payouts.ethAmount),
          usdtAmount: ethers.utils.formatUnits(payouts.usdtAmount, 6),
          usdcAmount: ethers.utils.formatUnits(payouts.usdcAmount, 6),
        },
      };
    } catch (error) {
      console.error("❌ Error getting pending payouts:", error);
      return { success: false, error: error.message };
    }
  }

  async getTransaction(contract, transactionId) {
    try {
      const transaction = await contract.transactions(transactionId);
      return {
        success: true,
        data: {
          id: transaction.id.toString(),
          productId: transaction.productId.toString(),
          buyer: transaction.buyer,
          merchant: transaction.merchant,
          token: transaction.token,
          amount: transaction.amount.toString(),
          platformFee: transaction.platformFee.toString(),
          merchantAmount: transaction.merchantAmount.toString(),
          timestamp: transaction.timestamp.toString(),
          ipfsHash: transaction.ipfsHash,
          processed: transaction.processed,
        },
      };
    } catch (error) {
      console.error("❌ Error getting transaction:", error);
      return { success: false, error: error.message };
    }
  }

  async getAllTransactions(contract) {
    try {
      const transactionIds = await contract.getAllTransactions();
      const transactions = [];

      for (const id of transactionIds) {
        const transactionResult = await this.getTransaction(contract, id);
        if (transactionResult.success) {
          transactions.push(transactionResult.data);
        }
      }

      return { success: true, data: transactions };
    } catch (error) {
      console.error("❌ Error getting all transactions:", error);
      return { success: false, error: error.message };
    }
  }

  // Add this to your contractService
  async getAllAuthorizedReviewers(contract) {
    try {
      const reviewers = [];

      // Get all KYC users first
      const kycUsers = await contract.getKYCUsers();

      // Check each user
      for (const userAddr of kycUsers) {
        try {
          const isReviewer = await contract.authorizedReviewers(userAddr);
          if (isReviewer) {
            reviewers.push(userAddr);
          }
        } catch (error) {
          console.error(
            `Error checking reviewer status for ${userAddr}:`,
            error
          );
        }
      }

      // Add contract owner (they have reviewer permissions)
      try {
        const owner = await contract.owner();
        if (!reviewers.find((r) => r.toLowerCase() === owner.toLowerCase())) {
          reviewers.push(owner);
        }
      } catch (error) {
        console.error("Error getting contract owner:", error);
      }

      return { success: true, data: reviewers };
    } catch (error) {
      console.error("Error getting authorized reviewers:", error);
      return { success: false, error: error.message, data: [] };
    }
  }

  async getPayoutHistory(contract) {
    try {
      console.log("📋 Fetching all payout history from contract...");

      const payoutHistory = await contract.getPayoutHistory();

      console.log(`📊 Retrieved ${payoutHistory.length} total payouts`);

      // Format the data for easier use
      const formattedPayouts = payoutHistory.map((payout, index) => {
        // Token configurations
        const tokenConfigs = {
          0: { name: "ETH", decimals: 18 }, // Assuming 0 = ETH
          1: { name: "USDC", decimals: 6 }, // Assuming 1 = USDC
          2: { name: "USDT", decimals: 6 }, // Assuming 2 = USDT
          // Add more tokens as needed
        };

        // Get token config
        const config = tokenConfigs[payout.token];
        const tokenName = config?.name || "UNKNOWN";

        let formattedAmount;

        // Debug logs
        console.log("Raw payout.amount:", payout.amount);
        console.log("payout.token:", payout.token);
        console.log("Config found:", config);

        if (!config) {
          formattedAmount = payout.amount.toString(); // Return as-is if unknown token
        } else {
          // Convert from smallest unit to human-readable format using string manipulation
          const amountStr = payout.amount.toString();
          const decimals = config.decimals;

          console.log("Amount string:", amountStr);
          console.log("Decimals:", decimals);
          console.log("Amount string length:", amountStr.length);

          if (amountStr.length <= decimals) {
            // Handle small amounts (less than 1 token)
            const paddedAmount = amountStr.padStart(decimals, "0");
            const decimalPart = paddedAmount.slice(-decimals);
            formattedAmount = `0.${decimalPart}`;
          } else {
            // Handle normal amounts
            const wholePart = amountStr.slice(0, -decimals);
            const decimalPart = amountStr.slice(-decimals);
            formattedAmount = `${wholePart}.${decimalPart}`;
            console.log("Whole part:", wholePart);
            console.log("Decimal part:", decimalPart);
            console.log("Formatted amount before cleanup:", formattedAmount);
          }

          // Remove trailing zeros and format based on token type
          const num = parseFloat(formattedAmount);
          console.log("Parsed number:", num);

          if (config.decimals === 18) {
            // ETH - show up to 4 decimal places
            formattedAmount = num.toFixed(4).replace(/\.?0+$/, "");
          } else {
            // USDC, USDT - show up to 2 decimal places
            formattedAmount = num.toFixed(2).replace(/\.?0+$/, "");
          }

          console.log("Final formatted amount:", formattedAmount);
        }

        return {
          id: index,
          merchant: payout.merchant,
          amount: payout.amount.toString(), // Raw amount (for calculations)
          formattedAmount: formattedAmount, // Human-readable amount
          displayAmount: `${formattedAmount} ${tokenName}`, // Amount with token symbol
          token: payout.token, // Enum value
          tokenName: tokenName, // Human-readable token name
          timestamp: parseInt(payout.timestamp.toString()),
          transactionIds: payout.transactionIds.map((id) => id.toString()),
          // Add formatted date for convenience
          date: new Date(
            parseInt(payout.timestamp.toString()) * 1000
          ).toISOString(),
          formattedDate: new Date(
            parseInt(payout.timestamp.toString()) * 1000
          ).toLocaleDateString(),
        };
      });

      return {
        success: true,
        data: formattedPayouts,
        totalPayouts: formattedPayouts.length,
      };
    } catch (error) {
      console.error("❌ Error fetching payout history:", error);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  // Utility Functions
  formatTokenAmount(amount, token) {
    switch (token) {
      case PAYMENT_TOKENS.ETH:
        return ethers.utils.formatEther(amount);
      case PAYMENT_TOKENS.USDT:
      case PAYMENT_TOKENS.USDC:
        return ethers.utils.formatUnits(amount, 6);
      default:
        return amount.toString();
    }
  }

  parseTokenAmount(amount, token) {
    switch (token) {
      case PAYMENT_TOKENS.ETH:
        return ethers.utils.parseEther(amount.toString());
      case PAYMENT_TOKENS.USDT:
      case PAYMENT_TOKENS.USDC:
        return ethers.utils.parseUnits(amount.toString(), 6);
      default:
        return ethers.BigNumber.from(amount);
    }
  }

  // Get contract read-only instance for viewing data
  getReadOnlyContract(abi) {
    const networkName = process.env.NEXT_PUBLIC_NETWORK || "localhost";

    // Reset cached provider if network changed
    if (this._readOnlyNetworkName !== networkName) {
      this._readOnlyProvider = null;
      this._readOnlyNetworkName = networkName;
    }

    if (!this._readOnlyProvider) {
      let rpcUrl;
      switch (networkName) {
        case "polygon":
          // Use the same working Polygon RPC as hardhat.config.js
          rpcUrl =
            process.env.NEXT_PUBLIC_ALCHEMY_POLYGON
              ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_POLYGON}`
              : "https://polygon.drpc.org";
          break;
        case "sepolia":
          rpcUrl =
            "https://sepolia.infura.io/v3/d86c5aeafd6b468e942615e5340daee0";
          break;
        case "holesky":
          rpcUrl =
            "https://ethereum-holesky.blockpi.network/v1/rpc/public";
          break;
        case "localhost":
        default:
          rpcUrl = "http://localhost:8545";
          break;
      }

      console.log(`[ContractService] Read-only RPC: ${rpcUrl} (${networkName})`);
      this._readOnlyProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    }

    // Resolve contract address fresh each call (env vars fully loaded by now)
    const addresses = {
      localhost: process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_ADDRESS ||
        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      sepolia: process.env.NEXT_PUBLIC_SEPOLIA_PAYMENT_GATEWAY_ADDRESS || "",
      polygon: process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON || "",
    };
    const contractAddress = addresses[networkName] || addresses.localhost;

    if (!contractAddress) {
      console.error(
        `[ContractService] No contract address for network "${networkName}". ` +
        `Set NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON in .env.local`
      );
    }

    return this.getContract(this._readOnlyProvider, abi, contractAddress);
  }

  // Batch multiple contract calls for better performance
  async batchContractCalls(contract, calls) {
    try {
      const results = await Promise.all(
        calls.map(call => {
          const [method, ...params] = call;
          return contract[method](...params).catch(err => {
            console.error(`Error calling ${method}:`, err);
            return null;
          });
        })
      );
      return { success: true, data: results };
    } catch (error) {
      console.error("Batch contract call error:", error);
      return { success: false, error: error.message };
    }
  }
}

export const contractService = new ContractService();
