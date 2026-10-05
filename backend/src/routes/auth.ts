// ─────────────────────────────────────────────────────────────
// Auth Routes — wallet-based login (nonce + signature → JWT)
// ─────────────────────────────────────────────────────────────
import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env";

const nonceStore = new Map<string, string>();

const router = Router();

// ── GET /auth/nonce ─────────────────────────────────────────
// Query: ?address=0x...
// Returns a random nonce for the wallet to sign.
// Creates the user row if it doesn't exist yet.
// ─────────────────────────────────────────────────────────────
router.get("/nonce", async (req: Request, res: Response) => {
  try {
    const { address } = req.query;

    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "address query parameter is required" });
    }

    // Normalize to checksummed address
    let checksummed: string;
    try {
      checksummed = ethers.utils.getAddress(address);
    } catch {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Generate a fresh nonce
    const nonce = uuidv4();

    // Store in memory instead of DB
    nonceStore.set(checksummed, nonce);

    return res.json({ nonce });
  } catch (err: any) {
    console.error("❌ /auth/nonce error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /auth/verify ───────────────────────────────────────
// Body: { address: "0x...", signature: "0x..." }
// Verifies EIP-191 personal_sign signature, returns JWT.
// ─────────────────────────────────────────────────────────────
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { address, signature } = req.body;

    if (!address || !signature) {
      return res.status(400).json({ error: "address and signature are required" });
    }

    let checksummed: string;
    try {
      checksummed = ethers.utils.getAddress(address);
    } catch {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Look up the stored nonce
    const nonce = nonceStore.get(checksummed);

    if (!nonce) {
      return res.status(404).json({ error: "User not found. Call /auth/nonce first." });
    }

    // Build the message the frontend should have signed
    const message = `Sign this message to log in to CryptoPay.\n\nNonce: ${nonce}`;

    // Recover the signer address
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch {
      return res.status(400).json({ error: "Invalid signature" });
    }

    if (recoveredAddress.toLowerCase() !== checksummed.toLowerCase()) {
      return res
        .status(401)
        .json({ error: "Signature does not match the provided address" });
    }

    // Rotate the nonce so the same signature can't be replayed
    const newNonce = uuidv4();
    nonceStore.set(checksummed, newNonce);

    // Issue JWT (24h expiry)
    const token = jwt.sign({ wallet: checksummed }, env.JWT_SECRET, {
      expiresIn: "24h",
    });

    return res.json({
      token,
      wallet: checksummed,
      message: "Authentication successful",
    });
  } catch (err: any) {
    console.error("❌ /auth/verify error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
