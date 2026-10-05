// ─────────────────────────────────────────────────────────────
// Notification Service — Twilio SMS alerts for merchant
// Sends an SMS whenever a buyer initiates a fiat payment or
// submits PAN details for KYC verification.
// ─────────────────────────────────────────────────────────────
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromPhone  = process.env.TWILIO_SENDER_PHONE;
const toPhone    = process.env.MERCHANT_PHONE;

// Lazily create client so missing env vars don't crash startup
function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
  }
  return twilio(accountSid, authToken);
}

/**
 * Send an SMS to the merchant's phone.
 * Silently logs errors rather than crashing the parent request.
 */
async function sendSMS(body: string): Promise<void> {
  if (!fromPhone || !toPhone) {
    console.warn("⚠️  SMS skipped — TWILIO_SENDER_PHONE or MERCHANT_PHONE not set");
    return;
  }

  try {
    const client = getClient();
    const msg = await client.messages.create({
      body,
      from: fromPhone,
      to: toPhone,
    });
    console.log(`📱 SMS sent [${msg.sid}]: "${body.slice(0, 60)}..."`);
  } catch (err: any) {
    // Never let notification failure crash a payment/KYC flow
    console.error("❌ SMS send failed:", err.message);
  }
}

// ── Public helpers ────────────────────────────────────────────

/**
 * Alert fired when a buyer clicks "Pay with Card / UPI".
 */
export async function notifyFiatCheckoutInitiated(opts: {
  productName: string;
  amountINR: string | number;
  orderId: string;
  merchantWallet: string;
}): Promise<void> {
  const { productName, amountINR, orderId, merchantWallet } = opts;
  const wallet = `${merchantWallet.slice(0, 6)}...${merchantWallet.slice(-4)}`;
  const body =
    `🛒 NEW FIAT CHECKOUT\n` +
    `Product: ${productName}\n` +
    `Amount: ₹${amountINR}\n` +
    `Merchant: ${wallet}\n` +
    `Order: ${orderId}\n` +
    `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;

  await sendSMS(body);
}

/**
 * Alert fired when a buyer submits PAN details for KYC.
 */
export async function notifyPanSubmitted(opts: {
  wallet: string;
  panStatus: string;
  fullName: string;
}): Promise<void> {
  const { wallet, panStatus, fullName } = opts;
  const shortWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  const statusEmoji = panStatus === "PASSED" ? "✅" : "❌";
  const body =
    `${statusEmoji} PAN VERIFICATION UPDATE\n` +
    `Name: ${fullName}\n` +
    `Status: ${panStatus}\n` +
    `Wallet: ${shortWallet}\n` +
    `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;

  await sendSMS(body);
}
