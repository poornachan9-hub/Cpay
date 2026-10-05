import { ethers } from "ethers";
import jwt from "jsonwebtoken";

const nonceStore = global._nonceStore || new Map();
if (!global._nonceStore) global._nonceStore = nonceStore;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "2444b2b9ba4555440bcf5a0d8612410a551a82f6caa0b29db0d14b21136ccb22";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { address, signature } = req.body || {};
  if (!address || !signature) {
    return res.status(400).json({ error: "address and signature are required" });
  }

  let checksummed;
  try {
    checksummed = ethers.utils.getAddress(address);
  } catch {
    return res.status(400).json({ error: "Invalid Ethereum address" });
  }

  // Try forwarding to external backend if running
  try {
    const backendRes = await fetch("http://127.0.0.1:4000/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: checksummed, signature }),
      signal: AbortSignal.timeout(1500),
    });
    if (backendRes.ok) {
      const data = await backendRes.json();
      return res.status(200).json(data);
    }
  } catch (_) {
    // Backend unavailable, fallback to local verification
  }

  const nonce = nonceStore.get(checksummed.toLowerCase());
  if (!nonce) {
    return res.status(404).json({ error: "Nonce not found. Please request /auth/nonce first." });
  }

  const message = `Sign this message to log in to CryptoPay.\n\nNonce: ${nonce}`;
  let recoveredAddress;
  try {
    recoveredAddress = ethers.utils.verifyMessage(message, signature);
  } catch {
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (recoveredAddress.toLowerCase() !== checksummed.toLowerCase()) {
    return res.status(401).json({ error: "Signature does not match the provided address" });
  }

  // Rotate nonce
  nonceStore.delete(checksummed.toLowerCase());

  const token = jwt.sign({ wallet: checksummed }, JWT_SECRET, { expiresIn: "24h" });

  return res.status(200).json({
    token,
    wallet: checksummed,
    message: "Authentication successful",
  });
}
