// pages/api/offramp/index.js
// Mudrex off-ramp: USDC/USDT → INR → Bank transfer
// Polygon Mainnet production integration
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { sendMerchantSms } from "../../../lib/sendMerchantSms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Mudrex / Saber API base URL
const MUDREX_URL =
  process.env.MUDREX_BASE_URL || "https://api.saber.money";

// Polygon Mainnet token addresses (for on-chain balance check)
const POLYGON_TOKEN_ADDRESSES = {
  USDC: process.env.NEXT_PUBLIC_USDC_POLYGON ||
    "0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359",
  USDT: process.env.NEXT_PUBLIC_USDT_POLYGON ||
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

// Polygon Mainnet public RPC for balance checks
const POLYGON_RPC = process.env.NEXT_PUBLIC_ALCHEMY_POLYGON
  ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_POLYGON}`
  : "https://polygon-rpc.com";

// ── On-chain ERC20 balance check via JSON-RPC ──────────────────
async function getTokenBalance(walletAddress, tokenAddress) {
  try {
    // balanceOf(address) selector = 0x70a08231
    const data =
      "0x70a08231" +
      walletAddress.replace("0x", "").padStart(64, "0");

    const res = await axios.post(
      POLYGON_RPC,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: tokenAddress, data }, "latest"],
      },
      { timeout: 8000 }
    );

    const hex = res.data?.result;
    if (!hex || hex === "0x") return 0;
    // Both USDC and USDT have 6 decimals on Polygon
    return parseInt(hex, 16) / 1e6;
  } catch (e) {
    console.warn("[balance-check] RPC call failed:", e.message);
    return null; // null = couldn't verify (don't block the user)
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      cryptoAmount,
      tokenSymbol = "USDC",
      userWallet,
      userBankIFSC,
      userBankAccount,
      holderName = "",
      userPhone = "",
    } = req.body;

    // ── Validation ──────────────────────────────────────────────
    const token = tokenSymbol.toUpperCase();
    if (!["USDC", "USDT"].includes(token)) {
      return res.status(400).json({ error: "token_symbol must be USDC or USDT" });
    }
    if (!cryptoAmount || parseFloat(cryptoAmount) <= 0) {
      return res.status(400).json({ error: "Invalid crypto amount" });
    }
    if (!userWallet || !/^0x[0-9a-fA-F]{40}$/.test(userWallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    if (!userBankIFSC || userBankIFSC.length !== 11) {
      return res.status(400).json({ error: "Invalid IFSC code" });
    }
    if (!userBankAccount || userBankAccount.length < 9) {
      return res.status(400).json({ error: "Invalid bank account number" });
    }

    const amount = parseFloat(cryptoAmount);
    const tokenAddress = POLYGON_TOKEN_ADDRESSES[token];

    // ── On-chain balance check ──────────────────────────────────
    const onChainBalance = await getTokenBalance(userWallet, tokenAddress);
    if (onChainBalance !== null && onChainBalance < amount) {
      return res.status(400).json({
        error: `Insufficient on-chain ${token} balance. Wallet has ${onChainBalance.toFixed(2)} ${token}, requested ${amount} ${token}.`,
      });
    }

    // ── 1. Get INR quote from Mudrex ───────────────────────────
    let estimatedINR = amount * 86; // fallback rate
    let mudrexQuoteId = null;

    try {
      const quoteRes = await axios.post(
        `${MUDREX_URL}/saber/quote/sell`,
        { from_currency: token, to_currency: "INR", from_amount: amount.toString() },
        {
          headers: {
            "x-api-key": process.env.MUDREX_API_KEY,
            "x-api-secret": process.env.MUDREX_API_SECRET,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      const qd = quoteRes.data?.data || quoteRes.data;
      if (qd?.to_amount) {
        estimatedINR = parseFloat(qd.to_amount);
        mudrexQuoteId = qd.quote_id || null;
      }
    } catch (quoteErr) {
      console.warn("[mudrex-quote] Using fallback rate:", quoteErr.message);
    }

    // ── 2. Create off-ramp order with Mudrex ───────────────────
    let mudrexOrderId = `LOCAL_${Date.now()}`;
    let redirectUrl = null;

    try {
      const orderPayload = {
        from_currency: token,
        to_currency: "INR",
        from_amount: amount.toString(),
        ...(mudrexQuoteId ? { quote_id: mudrexQuoteId } : {}),
        user_details: {
          wallet_address: userWallet,
          phone_number: userPhone,
          name: holderName,
        },
        beneficiary_details: {
          account_number: userBankAccount,
          ifsc_code: userBankIFSC.toUpperCase(),
          account_holder_name: holderName,
        },
      };

      const orderRes = await axios.post(
        `${MUDREX_URL}/saber/order/create`,
        orderPayload,
        {
          headers: {
            "x-api-key": process.env.MUDREX_API_KEY,
            "x-api-secret": process.env.MUDREX_API_SECRET,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      const od = orderRes.data?.data || orderRes.data;
      mudrexOrderId = od?.order_id || mudrexOrderId;
      redirectUrl = od?.payment_url || od?.redirect_url || null;
    } catch (orderErr) {
      console.warn("[mudrex-order] Order creation failed:", orderErr.response?.data || orderErr.message);
      // Proceed: log in Supabase anyway so we can manually process
    }

    // ── 3. Persist to Supabase fiat_offramps ───────────────────
    const { error: dbError } = await supabase.from("fiat_offramps").insert([
      {
        user_wallet: userWallet.toLowerCase(),
        mudrex_order_id: mudrexOrderId,
        amount_usdc: token === "USDC" ? amount : null,
        amount_usdt: token === "USDT" ? amount : null,
        token_symbol: token,
        amount_inr: estimatedINR,
        bank_account: userBankAccount.slice(-4), // store last 4 digits only
        ifsc: userBankIFSC.toUpperCase(),
        holder_name: holderName,
        status: "initiated",
      },
    ]);

    if (dbError) {
      console.error("[supabase] fiat_offramps insert error:", dbError);
    }

    const shortWallet = `${userWallet.slice(0, 6)}...${userWallet.slice(-4)}`;
    const notification = await sendMerchantSms(
      `New bank withdrawal request: ${amount} ${token} to bank account ending ${userBankAccount.slice(-4)}; order ${mudrexOrderId}; wallet ${shortWallet}.`
    );

    // ── 4. Return success response ──────────────────────────────
    return res.status(200).json({
      success: true,
      order_id: mudrexOrderId,
      estimated_inr: estimatedINR.toFixed(2),
      token_symbol: token,
      amount,
      status: "initiated",
      eta: "24h",
      notification,
      ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
    });

  } catch (err) {
    console.error("[offramp] Unhandled error:", err.response?.data || err.message);
    return res.status(err.response?.status || 500).json({
      error:
        err.response?.data?.message ||
        err.message ||
        "Failed to process off-ramp request",
    });
  }
}
