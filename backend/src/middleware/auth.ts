// ─────────────────────────────────────────────────────────────
// JWT authentication middleware
// ─────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

// Extend Express Request to carry the authenticated wallet address
export interface AuthRequest extends Request {
  wallet?: string;
}

/**
 * Middleware that verifies the JWT from the Authorization header.
 * On success, sets `req.wallet` to the authenticated wallet address.
 */
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { wallet: string };
    req.wallet = decoded.wallet;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
