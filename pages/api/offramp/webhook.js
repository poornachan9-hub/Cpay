import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rmxgznopbgnotmpfiztv.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Basic Webhook integrity validation (If Mudrex provides a secret, validate it here)
    // Mudrex typically sends payloads with { order_id, status, ... }
    const payload = req.body;
    const mudrexOrderId = payload.order_id || payload.id;
    const newStatus = payload.status;

    if (!mudrexOrderId || !newStatus) {
      return res.status(400).json({ error: "Invalid webhook payload structure" });
    }

    console.log(`[Mudrex Webhook] Received status update for order ${mudrexOrderId}: ${newStatus}`);

    // Update the database
    const { data, error } = await supabase
      .from("payouts")
      .update({ 
        status: newStatus.toUpperCase(),
        updated_at: new Date().toISOString()
      })
      .eq("mudrex_order_id", mudrexOrderId);

    if (error) {
      throw error;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[Webhook Error]:", error);
    return res.status(500).json({ error: "Failed to process webhook" });
  }
}
