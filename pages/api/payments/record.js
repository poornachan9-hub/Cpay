// pages/api/payments/record.js
// Records a completed on-chain payment into Supabase.
// Called by TokenPayment.jsx after transaction is confirmed.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      product_id,
      buyer_wallet,
      token_symbol,
      token_address,
      token_amount,
      tx_hash,
      chain_id = 137,
    } = req.body;

    if (!buyer_wallet || !tx_hash) {
      return res.status(400).json({ error: "buyer_wallet and tx_hash are required" });
    }

    const chainId = Number(chain_id);
    if (![1337, 137].includes(chainId)) {
      return res.status(400).json({ error: "Unsupported payment network" });
    }

    // Upsert by tx_hash to prevent duplicates
    const { data, error } = await supabase
      .from("crypto_payments")
      .upsert(
        {
          product_id: product_id ? parseInt(product_id) : null,
          buyer_wallet: buyer_wallet.toLowerCase(),
          token_symbol: token_symbol?.toUpperCase() || "USDC",
          token_address: token_address?.toLowerCase(),
          token_amount: parseFloat(token_amount) || 0,
          chain_id: chainId,
          tx_hash: tx_hash,
          status: "completed",
          network: chainId === 1337 ? "localhost" : "polygon",
          created_at: new Date().toISOString(),
        },
        { onConflict: "chain_id,tx_hash", ignoreDuplicates: true }
      )
      .select()
      .single();

    if (error) {
      console.error("[payments/record] Supabase error:", error);
      return res.status(503).json({
        error: "Payment succeeded on-chain but could not be saved for verification",
      });
    }

    return res.status(200).json({ success: true, payment: data });
  } catch (err) {
    console.error("[payments/record] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
