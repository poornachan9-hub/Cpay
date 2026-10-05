// ─────────────────────────────────────────────────────────────
// PAN Verification Service — Sandbox.co.in API
//
// API docs: https://docs.sandbox.co.in/kyc/pan
// Test PAN: ABCDE1234F
// ─────────────────────────────────────────────────────────────
import fetch from "node-fetch";
import { env } from "../config/env";

export interface PanVerifyRequest {
  pan: string;       // ABCDE1234F
  fullName: string;
  dob: string;       // YYYY-MM-DD
}

export interface PanVerifyResult {
  panValid: boolean;
  nameMatch: boolean;
  panStatus: string;
  referenceId: string;
  rawResponse: any;
}

/**
 * Validates PAN format: exactly 5 uppercase letters + 4 digits + 1 uppercase letter.
 */
export function isValidPanFormat(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
}

/**
 * Authenticates with Sandbox.co.in and returns an access token.
 * Tokens are short-lived. Call once per request.
 */
async function getSandboxToken(): Promise<string> {
  if (!env.SANDBOX_API_KEY || !env.SANDBOX_API_SECRET) {
    throw new Error(
      "Sandbox API credentials not configured. Set SANDBOX_API_KEY and SANDBOX_API_SECRET in your .env file."
    );
  }

  const res = await fetch(`${env.SANDBOX_BASE_URL}/authenticate`, {
    method: "POST",
    headers: {
      "x-api-key": env.SANDBOX_API_KEY,
      "x-api-secret": env.SANDBOX_API_SECRET,
      "x-api-version": "2.0",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sandbox auth failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as any;
  if (!data.access_token) {
    throw new Error("Sandbox auth response missing access_token");
  }
  return data.access_token;
}

/**
 * Verifies a PAN number via Sandbox.co.in.
 * Returns panValid, nameMatch, status and a referenceId.
 */
export async function verifyPan(req: PanVerifyRequest): Promise<PanVerifyResult> {
  if (!isValidPanFormat(req.pan)) {
    return {
      panValid: false,
      nameMatch: false,
      panStatus: "INVALID_FORMAT",
      referenceId: "",
      rawResponse: null,
    };
  }

  try {
    const accessToken = await getSandboxToken();

    const res = await fetch(`${env.SANDBOX_BASE_URL}/kyc/pan/verify`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-api-key": env.SANDBOX_API_KEY,
        "x-api-version": "2.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "@entity": "in.co.sandbox.kyc.pan.request",
        pan: req.pan,
      }),
    });

    const raw = (await res.json()) as any;
    const data = raw?.data ?? raw;

    // Sandbox returns data.valid for PAN validity
    const panValid = !!(data?.valid ?? data?.pan_status === "VALID");

    // Name match: exact match or fuzzy — compare uppercase first word
    const sandboxName: string = (data?.name ?? "").toUpperCase().trim();
    const submittedName: string = req.fullName.toUpperCase().trim();
    const nameMatch =
      sandboxName.length > 0 &&
      (sandboxName === submittedName ||
        sandboxName.includes(submittedName.split(" ")[0]) ||
        submittedName.includes(sandboxName.split(" ")[0]));

    const referenceId = data?.reference_id ?? data?.referenceId ?? `SB-PAN-${Date.now()}`;

    return {
      panValid,
      nameMatch,
      panStatus: panValid && nameMatch ? "PASSED" : "FAILED",
      referenceId,
      rawResponse: {
        // Never log the raw PAN number in prod — only status
        status: data?.valid,
        category: data?.category,
        type: data?.type,
        referenceId,
      },
    };
  } catch (err: any) {
    console.error("❌ PAN verify error:", err.message);
    throw err;
  }
}
