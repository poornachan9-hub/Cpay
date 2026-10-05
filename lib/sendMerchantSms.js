export async function sendMerchantSms(body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromPhone = process.env.TWILIO_SENDER_PHONE;
  const toPhone = process.env.MERCHANT_PHONE;

  if (!accountSid || !authToken || !toPhone || (!messagingServiceSid && !fromPhone)) {
    return { sent: false, reason: "Twilio configuration is incomplete" };
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    const messageOptions = { body, to: toPhone };
    if (messagingServiceSid) {
      messageOptions.messagingServiceSid = messagingServiceSid;
    } else {
      messageOptions.from = fromPhone;
    }
    const message = await client.messages.create(messageOptions);
    console.log(`[Twilio] Merchant notification accepted (${message.sid}, ${message.status})`);
    return { sent: true, status: message.status };
  } catch (error) {
    console.error("[Twilio] Merchant notification failed:", error.code || error.message);
    return {
      sent: false,
      reason: error.code ? `Twilio rejected the message (code ${error.code})` : "Twilio request failed",
    };
  }
}