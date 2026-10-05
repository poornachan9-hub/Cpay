// /api/notify-checkout.js
// Sends a checkout alert after the buyer submits the demo checkout form.
import { sendMerchantSms } from "../../lib/sendMerchantSms";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { order, amount, currency, wallet } = req.body || {};
  const parsedAmount = Number(amount);
  if (!order || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ sent: false, reason: "Order and a valid amount are required" });
  }

  const shortWallet = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Unknown";
  const notification = await sendMerchantSms(
    `Checkout Alert: Order ${order} opened for ${parsedAmount.toFixed(2)} ${currency || "INR"} by ${shortWallet}.`
  );
  return res.status(200).json(notification);
}
