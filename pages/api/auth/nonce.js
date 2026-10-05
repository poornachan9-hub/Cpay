import { ethers } from "ethers";
import crypto from "crypto";

// Memory store for active nonces
const nonceStore = global._nonceStore || new Map();
if (!global._nonceStore) global._nonceStore = nonceStore;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { address } = req.query;
  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "address query parameter is required" });
  }

  let checksummed;
  try {
    checksummed = ethers.utils.getAddress(address);
  } catch {
    return res.status(400).json({ error: "Invalid Ethereum address" });
  }

  // Try forwarding to external backend if running
  try {
    const backendRes = await fetch(`http://127.0.0.1:4000/auth/nonce?address=${checksummed}`, {
      signal: AbortSignal.timeout(1000),
    });
    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data.nonce) {
        nonceStore.set(checksummed.toLowerCase(), data.nonce);
        return res.status(200).json(data);
      }
    }
  } catch (_) {
    // Backend unavailable, fallback to local generation
  }

  const nonce = crypto.randomUUID();
  nonceStore.set(checksummed.toLowerCase(), nonce);

  return res.status(200).json({ nonce });
}
