import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { ethers } from "ethers";
import Layout from "../components/Layout";
import OnRampButton from "../components/OnRampButton";
import TransactionRiskPanel from "../components/TransactionRiskPanel";
import PredictionValidationCard from "../components/PredictionValidationCard";
import { FiSend, FiDollarSign } from "react-icons/fi";
import { motion } from "framer-motion";
import { getContractAddresses, TOKEN_CONFIG } from "../lib/constants";
import toast from "react-hot-toast";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

function extractRevertDetails(err) {
  const msg = err?.message || "";
  const reason = err?.reason;
  const rawData = err?.data || err?.error?.data || err?.error?.error?.data;

  // 1. If ethers or RPC gave a clean, non-empty reason string
  if (reason && typeof reason === "string" && !reason.includes("missing revert data")) {
    return {
      status: "reverted",
      revertReason: reason,
      conclusive: true,
    };
  }

  // 2. Try decoding standard Error(string) selector 0x08c379a0
  const hexString = typeof rawData === "string" ? rawData : (rawData?.data || "");
  if (hexString && hexString.startsWith("0x08c379a0")) {
    try {
      const decoded = ethers.utils.defaultAbiCoder.decode(["string"], "0x" + hexString.slice(10))[0];
      return {
        status: "reverted",
        revertReason: decoded,
        conclusive: true,
      };
    } catch (_) {}
  }

  // 3. Try regex match for explicit revert string
  const match = msg.match(/execution reverted: (.*?)(?:\"|\'|\n|$)/i) || msg.match(/reverted with reason string [\"'](.*?)[\"']/i);
  if (match && match[1] && !match[1].includes("missing revert data")) {
    return {
      status: "reverted",
      revertReason: match[1],
      conclusive: true,
    };
  }

  // 4. If missing revert data or ambiguous call exception
  if (msg.includes("missing revert data") || msg.includes("without a reason string")) {
    return {
      status: "inconclusive",
      revertReason: "Ambiguous error: Reverted without a decoded reason string (RPC returned missing revert data)",
      conclusive: false,
    };
  }

  // 5. Generic unclassified error
  return {
    status: "inconclusive",
    revertReason: reason || msg || "Ambiguous simulation error",
    conclusive: false,
  };
}

export default function Transfer() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("POL");
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("");
  const [transactionNetwork, setTransactionNetwork] = useState("");
  const [riskPrediction, setRiskPrediction] = useState(null);
  const [evaluatingRisk, setEvaluatingRisk] = useState(false);
  const [blockchainResult, setBlockchainResult] = useState(null);

  const evaluateRiskFor = async (tokenToUse, recipientToUse, amountToUse) => {
    if (!recipientToUse || !ethers.utils.isAddress(recipientToUse)) {
      setRiskPrediction(null);
      return;
    }
    setEvaluatingRisk(true);
    try {
      let currentGasPrice = 35.0;
      try {
        const provider = new ethers.providers.JsonRpcProvider("https://polygon.drpc.org");
        const gp = await provider.getGasPrice();
        currentGasPrice = parseFloat(ethers.utils.formatUnits(gp, "gwei"));
      } catch (_) {}

      const isAaveContract = recipientToUse && (
        recipientToUse.toLowerCase() === "0x794a61358d6845594f94dc1db02a252b5b4814ad" ||
        recipientToUse.toLowerCase() === "0x8be5ad27ced4f9d0c6bf23d45efefef16fa2c125"
      );

      const targetAddress = isAaveContract
        ? recipientToUse
        : (tokenToUse === "POL"
            ? recipientToUse
            : (getContractAddresses(137)[tokenToUse] || recipientToUse));

      const gasLimitToUse = isAaveContract ? 210000 : (tokenToUse === "POL" ? 21000 : 65000);

      const res = await fetch("/api/predict-tx-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetAddress,
          gas_limit: gasLimitToUse,
          gas_price_gwei: currentGasPrice,
          value_native: tokenToUse === "POL" && Number(amountToUse) > 0 ? Number(amountToUse) : 0.0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRiskPrediction(data);
      }
    } catch (err) {
      console.error("Failed to evaluate risk:", err);
    } finally {
      setEvaluatingRisk(false);
    }
  };

  const handleLoadControlledTest = () => {
    const controlledToken = "USDT";
    const controlledRecipient = "0x000000000000000000000000000000000000dEaD";
    const controlledAmount = "1.0";

    setToken(controlledToken);
    setRecipient(controlledRecipient);
    setAmount(controlledAmount);
    setBlockchainResult(null);
    setTransactionStatus("");
    setTransactionHash("");

    console.log("CONTROLLED TEST LOADED");
    console.log("Asset: USDT");
    console.log("Recipient: 0x000000000000000000000000000000000000dEaD");
    console.log("Amount: 1.0");
    console.log("Prediction Domain: Tokens (USDT / USDC)");

    evaluateRiskFor(controlledToken, controlledRecipient, controlledAmount);
    toast.success("Loaded Controlled USDT Failure Test. Click 'Simulate EVM' to test safely.");
  };

  const handleLoadAaveTest = () => {
    const controlledToken = "POL";
    const controlledRecipient = "0x794a61358d6845594f94dc1db02a252b5b4814ad";
    const controlledAmount = "0.01";

    setToken(controlledToken);
    setRecipient(controlledRecipient);
    setAmount(controlledAmount);
    setBlockchainResult(null);
    setTransactionStatus("");
    setTransactionHash("");

    evaluateRiskFor(controlledToken, controlledRecipient, controlledAmount);
    toast.success("Loaded Controlled Aave V3 Pool Test. Click 'Simulate EVM' to test on-chain state verification.");
  };

  const checkRisk = useCallback(() => {
    evaluateRiskFor(token, recipient, amount);
  }, [recipient, token, amount]);

  const handleSimulate = async () => {
    // Benchmark caller is 0x75c4883bDb6e6A5D2c10D86e8E00d1a89aF69b0E (has 0 USDT balance)
    const callerAddress = address && ethers.utils.isAddress(address)
      ? address
      : "0x75c4883bDb6e6A5D2c10D86e8E00d1a89aF69b0E";

    if (!recipient || !ethers.utils.isAddress(recipient)) {
      toast.error("Enter a valid recipient address to simulate");
      return;
    }
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      toast.error("Enter a valid amount greater than zero");
      return;
    }

    setSimulating(true);
    setBlockchainResult(null);
    const toastId = toast.loading("Simulating EVM execution (no gas spent)...");

    try {
      let provider;
      if (typeof window !== "undefined" && window.ethereum && isConnected) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
      } else {
        provider = new ethers.providers.JsonRpcProvider("https://polygon.drpc.org");
      }

      const decimals = token === "POL" ? 18 : (TOKEN_CONFIG[token]?.decimals || 6);
      const amountUnits = ethers.utils.parseUnits(amount, decimals);

      if (token === "POL") {
        const code = await provider.getCode(recipient);
        if (code === "0x") {
          // Recipient is an EOA (Externally Owned Account) with no smart contract code
          const balance = await provider.getBalance(callerAddress);
          if (balance.lt(amountUnits)) {
            setBlockchainResult({
              type: "simulation",
              status: "reverted",
              conclusive: true,
              statusText: "Simulation Reverted (Insufficient Balance)",
              revertReason: "Sender has insufficient native POL balance for value transfer",
            });
            toast.error("Simulation Reverted: Insufficient POL balance", { id: toastId });
            return;
          } else {
            setBlockchainResult({
              type: "simulation",
              status: "success",
              conclusive: true,
              statusText: "Simulation Succeeded (EOA Native Transfer Executable)",
              revertReason: null,
            });
            toast.success("Simulation passed: Native transfer executable", { id: toastId });
            return;
          }
        } else {
          // Recipient is a smart contract with code
          await provider.call({
            from: callerAddress,
            to: recipient,
            value: amountUnits,
          });
        }
      } else {
        // ERC20 token transfer simulation
        const tokenAddress = getContractAddresses(137)[token];
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        await contract.callStatic.transfer(recipient, amountUnits, { from: callerAddress });
      }

      setBlockchainResult({
        type: "simulation",
        status: "success",
        conclusive: true,
        statusText: "Simulation Succeeded (EVM confirmed executable)",
        revertReason: null,
      });
      toast.success("EVM Simulation passed: Transaction would succeed", { id: toastId });
    } catch (err) {
      let details = extractRevertDetails(err);

      // Defensive fallback: If browser RPC returned an ambiguous error without a reason for ERC20 on Polygon,
      // query the Polygon Mainnet RPC directly to verify the exact EVM revert reason.
      if (!details.conclusive && token !== "POL") {
        try {
          const directProvider = new ethers.providers.JsonRpcProvider("https://polygon.drpc.org");
          const directTokenAddress = getContractAddresses(137)[token];
          const directContract = new ethers.Contract(directTokenAddress, ERC20_ABI, directProvider);
          await directContract.callStatic.transfer(recipient, amountUnits, { from: callerAddress });
        } catch (directErr) {
          const directDetails = extractRevertDetails(directErr);
          if (directDetails.conclusive) {
            details = directDetails;
          }
        }
      }

      setBlockchainResult({
        type: "simulation",
        status: details.status,
        conclusive: details.conclusive,
        statusText: details.status === "reverted" ? "Simulation Reverted (Execution Revert)" : "Simulation Inconclusive (Ambiguous Error)",
        revertReason: details.revertReason,
      });

      if (details.conclusive && details.status === "reverted") {
        toast.error(`EVM Simulation Reverted: ${details.revertReason}`, { id: toastId });
      } else if (!details.conclusive) {
        toast.error(`Simulation Inconclusive: ${details.revertReason}`, { id: toastId });
      } else {
        toast.error(details.revertReason || "Simulation error", { id: toastId });
      }
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (recipient && ethers.utils.isAddress(recipient)) {
      const timer = setTimeout(checkRisk, 500);
      return () => clearTimeout(timer);
    } else {
      setRiskPrediction(null);
    }
  }, [recipient, token, amount, checkRisk]);

  const handleTransfer = async () => {
    if (!isConnected || !address) {
      toast.error("Connect your wallet first");
      return;
    }

    if (!ethers.utils.isAddress(recipient)) {
      toast.error("Invalid recipient address");
      return;
    }

    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      toast.error("Enter a valid amount greater than zero");
      return;
    }

    let submittedHash = "";
    let submittedNetwork = "";
    setTransactionHash("");
    setTransactionStatus("Preparing transaction");
    setTransactionNetwork("");
    setLoading(true);
    const toastId = toast.loading("Processing transfer...");

    try {
      if (!window.ethereum) throw new Error("No wallet provider found");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const { chainId } = await provider.getNetwork();
      if (![1337, 137].includes(chainId)) {
        throw new Error("Switch your wallet to Polygon PoS or Hardhat Local");
      }
      const networkName = chainId === 137 ? "Polygon PoS" : "Hardhat Local (controlled test)";
      submittedNetwork = networkName;
      setTransactionNetwork(networkName);

      const signer = provider.getSigner();
      const decimals = token === "POL" ? 18 : TOKEN_CONFIG[token]?.decimals;
      if (!Number.isInteger(decimals)) throw new Error("Unsupported asset");

      let amountUnits;
      try {
        amountUnits = ethers.utils.parseUnits(amount, decimals);
      } catch {
        throw new Error(`Enter an amount with no more than ${decimals} decimal places`);
      }
      if (amountUnits.isZero()) throw new Error("Amount is too small");

      let tx;
      if (token === "POL") {
        tx = await signer.sendTransaction({
          to: recipient,
          value: amountUnits,
        });
      } else {
        const tokenAddress = getContractAddresses(chainId)[token];
        if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
          throw new Error(`${token} is not configured for Polygon`);
        }
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        tx = await contract.transfer(recipient, amountUnits);
      }

      submittedHash = tx.hash;
      setTransactionHash(submittedHash);
      setTransactionStatus("Pending confirmation");
      toast.loading(`Waiting for ${networkName} confirmation...`, { id: toastId });

      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("Transaction reverted on Polygon");

      setTransactionStatus("Confirmed");
      setBlockchainResult({
        type: "broadcast",
        status: "success",
        conclusive: true,
        statusText: "Confirmed on-chain (Status 1)",
        txHash: submittedHash,
        revertReason: null,
      });
      toast.success(`Transfer confirmed on ${networkName}`, { id: toastId });
      setAmount("");
      setRecipient("");
    } catch (error) {
      const details = extractRevertDetails(error);
      if (submittedHash) {
        const reverted = error.receipt?.status === 0;
        setTransactionStatus(reverted ? "Failed (Reverted)" : "Confirmation pending");
        setBlockchainResult({
          type: "broadcast",
          status: reverted ? "reverted" : details.status,
          conclusive: reverted ? true : details.conclusive,
          statusText: reverted ? "Reverted on-chain (Status 0)" : "Confirmation pending",
          txHash: submittedHash,
          revertReason: details.revertReason,
        });
        toast.error(
          reverted
            ? `Transaction reverted on ${submittedNetwork}`
            : "Transaction submitted; confirmation is not yet available",
          { id: toastId }
        );
      } else {
        setTransactionStatus("Failed");
        setBlockchainResult({
          type: "broadcast",
          status: details.status,
          conclusive: details.conclusive,
          statusText: details.status === "reverted" ? "Submission Reverted" : "Submission Inconclusive",
          txHash: null,
          revertReason: details.revertReason,
        });
        toast.error(details.revertReason || "Transfer failed", { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Transfer Funds">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Crypto Transfer Dashboard */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-2xl border backdrop-blur-xl"
          style={{
            background: "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(139, 92, 246, 0.2)"
          }}
        >
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30">
              <FiSend className="h-8 w-8 text-purple-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Send Crypto
              </h1>
              <p className="text-gray-400 mt-1">
                Send on Polygon PoS; Hardhat Local is for controlled testing.
              </p>
            </div>
          </div>

          {/* Controlled Benchmark Failure Test Mode */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/25 p-3.5 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-500/30 px-2 py-0.5 font-bold text-indigo-300 text-[10px] tracking-wider uppercase border border-indigo-400/30">
                  Controlled Test
                </span>
                <span className="font-semibold text-white">Safe USDT Revert Benchmark</span>
              </div>
              <p className="text-gray-400">
                Loads 1.0 USDT transfer from zero-balance wallet to verify deterministic EVM revert (no gas spent on simulation).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLoadControlledTest}
                className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border border-indigo-400/40 px-3.5 py-2 text-xs font-bold text-white transition shadow-md hover:shadow-indigo-500/25 active:scale-95"
              >
                Load USDT Test
              </button>
              <button
                type="button"
                onClick={handleLoadAaveTest}
                className="shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border border-purple-400/40 px-3.5 py-2 text-xs font-bold text-white transition shadow-md hover:shadow-purple-500/25 active:scale-95"
              >
                Load Aave Pool Test
              </button>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Recipient Address</label>
              <input 
                type="text" 
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                style={{
                  background: "rgba(139, 92, 246, 0.05)",
                  borderColor: "rgba(139, 92, 246, 0.2)"
                }}
                placeholder="0x..."
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  style={{
                    background: "rgba(139, 92, 246, 0.05)",
                    borderColor: "rgba(139, 92, 246, 0.2)"
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="w-1/3">
                <label className="block text-sm font-medium text-gray-300 mb-2">Asset</label>
                <select 
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  style={{
                    background: "rgba(139, 92, 246, 0.1)",
                    borderColor: "rgba(139, 92, 246, 0.2)"
                  }}
                >
                  <option value="POL" className="bg-gray-900">
                    {walletChainId === 1337 ? "ETH (Hardhat Local)" : "POL"}
                  </option>
                  <option value="USDT" className="bg-gray-900">USDT</option>
                  <option value="USDC" className="bg-gray-900">USDC</option>
                </select>
              </div>
            </div>

            {/* Advisory Pre-Transaction Failure Risk Radar */}
            <TransactionRiskPanel
              prediction={riskPrediction}
              loading={evaluatingRisk}
              onRecheck={checkRisk}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleSimulate}
                disabled={simulating || loading}
                className="flex-1 py-3.5 rounded-xl border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-200 font-semibold shadow transition-all duration-300 disabled:opacity-50 text-sm"
              >
                {simulating ? "Simulating EVM..." : "Simulate EVM (Safe / No Broadcast)"}
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleTransfer}
                disabled={loading || simulating || !isConnected}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50 text-sm"
              >
                {loading ? "Processing..." : !isConnected ? "Connect Wallet" : "Send Funds"}
              </motion.button>
            </div>

            {transactionStatus && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm" role="status">
                <p className="text-gray-300">
                  {transactionNetwork || "Selected network"} status: {transactionStatus}
                </p>
                {transactionHash && (
                  transactionNetwork === "Polygon PoS" ? (
                    <a
                      href={`https://polygonscan.com/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block break-all font-mono text-xs text-blue-300 hover:text-blue-200"
                    >
                      {transactionHash}
                    </a>
                  ) : (
                    <p className="mt-1 break-all font-mono text-xs text-gray-400">
                      {transactionHash}
                    </p>
                  )
                )}
              </div>
            )}

            {/* Validation Benchmark: Prediction vs Reality */}
            <PredictionValidationCard
              prediction={riskPrediction}
              blockchainResult={blockchainResult}
            />
          </div>
        </motion.div>

        {/* Fiat On-Ramp Modal/Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-8 rounded-2xl border backdrop-blur-xl"
          style={{
            background: "linear-gradient(135deg, rgba(15, 11, 19, 0.8) 0%, rgba(26, 22, 37, 0.8) 50%, rgba(15, 11, 19, 0.8) 100%)",
            borderColor: "rgba(59, 130, 246, 0.2)"
          }}
        >
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
              <FiDollarSign className="h-8 w-8 text-blue-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Fiat Conversion
              </h2>
              <p className="text-gray-400 mt-1">
                Convert your fiat currency directly to crypto via card
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 p-6 rounded-xl border border-blue-500/20">
             <p className="text-sm text-gray-300 mb-4">
               Use our integrated payment gateway to purchase crypto directly with your credit or debit card. The funds will be deposited into your connected wallet.
             </p>
             <OnRampButton 
               product={{ 
                 priceUSDC: amount || 10, 
                 id: "fiat-to-crypto", 
                 name: "Crypto Purchase", 
                 merchant: address || "0x0000000000000000000000000000000000000000"
               }} 
             />
          </div>
        </motion.div>

      </div>
    </Layout>
  );
}
