// lib/wagmi.js
import { polygon, localhost, hardhat } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const config = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_APP_NAME || "CoinCrop",

  // WalletConnect project ID
  projectId:
    process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ||
    "8b8afeeb851fe2c793314e42b58498c1",

  // Support Localhost (Hardhat) and Polygon Mainnet
  chains: [localhost, hardhat, polygon],
  ssr: true,
});

// Token addresses on Polygon Mainnet
export const POLYGON_TOKENS = {
  USDC: process.env.NEXT_PUBLIC_USDC_POLYGON ||
    "0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359",
  USDT: process.env.NEXT_PUBLIC_USDT_POLYGON ||
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

// Contract addresses on Polygon Mainnet
export const POLYGON_CONTRACTS = {
  PAYMENT_GATEWAY:
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON || "",
};

// ERC-20 minimal ABI for approve + balanceOf
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
];