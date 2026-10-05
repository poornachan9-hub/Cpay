import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rmxgznopbgnotmpfiztv.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { productPriceUSDC, productId, productName, merchantWallet, payerEmail } = req.body;

    // Validation
    if (!productPriceUSDC || productPriceUSDC <= 0) {
      return res.status(400).json({ error: "Invalid product price" });
    }
    if (!merchantWallet) {
      return res.status(400).json({ error: "Merchant wallet address is required" });
    }

    // 1. Calculate INR Equivalent (Estimated 88 INR per 1 USDC)
    const requiredINR = (productPriceUSDC * 88).toFixed(2);

    // 2. Generate Checkout URL
    const mudrexOrderId = `MUDREX_ONRAMP_${Date.now()}`;
    const redirectUrl = `/fiat-checkout?order=${mudrexOrderId}&amount=${requiredINR}&currency=INR&wallet=${merchantWallet}`;

    // 3. Save to Supabase
    const { error: dbError } = await supabase.from("fiat_payments").insert([{
      mudrex_order_id: mudrexOrderId,
      product_id: productId,
      product_name: productName,
      merchant_wallet: merchantWallet,
      crypto_amount: productPriceUSDC,
      fiat_amount: requiredINR,
      status: "PENDING"
    }]);

    if (dbError) {
      console.error("Supabase Insertion Error:", dbError);
    }

    // 4. Return the local demo checkout URL
    return res.status(200).json({
      success: true,
      orderId: mudrexOrderId,
      requiredINR: requiredINR,
      redirect_url: redirectUrl,
    });

  } catch (error) {
    console.error("[Onramp Error]:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || "Failed to process fiat checkout request"
    });
  }
}
