import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rmxgznopbgnotmpfiztv.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Basic Webhook integrity validation
    const payload = req.body;
    const mudrexOrderId = payload.order_id || payload.id;
    const newStatus = payload.status; // e.g., COMPLETED, FAILED, EXPIRED

    if (!mudrexOrderId || !newStatus) {
      return res.status(400).json({ error: "Invalid webhook payload structure" });
    }

    console.log(`[On-Ramp Webhook] Mudrex order ${mudrexOrderId} shifted to status: ${newStatus}`);

    // Update the database to reflect that the fiat payment succeeded 
    // (since it bypasses CryptoPaymentGateway.sol natively)
    const { data, error } = await supabase
      .from("fiat_payments")
      .update({ 
        status: newStatus.toUpperCase(),
        updated_at: new Date().toISOString()
      })
      .eq("mudrex_order_id", mudrexOrderId);

    if (error) {
      throw error;
    }

    // Advanced: If status is COMPLETED, you could optionally trigger an internal system Event, 
    // email receipt, or Discord notification here.

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[On-Ramp Webhook Error]:", error);
    return res.status(500).json({ error: "Failed to process on-ramp webhook" });
  }
}
