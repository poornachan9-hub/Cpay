// ─────────────────────────────────────────────────────────────
// Aadhaar Verification Service — Sandbox.co.in (OTP flow)
//
// Level 1: Verhoeff checksum (frontend already does this,
//          backend re-validates as a safety net)
// Level 2: Sandbox Aadhaar OTP — generate + verify
// Level 3: Offline eKYC ZIP (kept as fallback)
//
// API docs: https://docs.sandbox.co.in/kyc/aadhaar-otp
// Test Aadhaar: 999941057058 | OTP: 123456 (Sandbox sandbox)
// ─────────────────────────────────────────────────────────────
import { ethers } from "ethers";
import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";
import fetch from "node-fetch";
import { env } from "../config/env";
import { isValidAadhaar } from "../utils/verhoeff";

// ── Level 1: Checksum validation ────────────────────────────

export interface AadhaarChecksumResult {
  valid: boolean;
  error: string | null;
}

export function validateAadhaarChecksum(aadhaar: string): AadhaarChecksumResult {
  return isValidAadhaar(aadhaar);
}

// ── Sandbox auth helper ──────────────────────────────────────

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
    const errText = await res.text();
    throw new Error(`Sandbox auth failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  if (!data.access_token) {
    throw new Error("Sandbox auth returned no access_token");
  }
  return data.access_token;
}

// ── Level 2a: Generate Aadhaar OTP ──────────────────────────

export interface AadhaarOtpGenerateResult {
  otpSent: boolean;
  referenceId: string;   // stored in DB, sent back to frontend
  message: string;
  error: string | null;
}

/**
 * Calls Sandbox Aadhaar OTP generate.
 * The Aadhaar number is only sent server-side — never to the frontend.
 */
export async function generateAadhaarOtp(
  aadhaarNumber: string
): Promise<AadhaarOtpGenerateResult> {
  const cleaned = aadhaarNumber.replace(/[\s-]/g, "");

  // Re-validate on backend as a safety net
  const validation = validateAadhaarChecksum(cleaned);
  if (!validation.valid) {
    return {
      otpSent: false,
      referenceId: "",
      message: validation.error ?? "Invalid Aadhaar",
      error: validation.error,
    };
  }

  try {
    const accessToken = await getSandboxToken();

    const res = await fetch(`${env.SANDBOX_BASE_URL}/kyc/aadhaar/otp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-api-key": env.SANDBOX_API_KEY,
        "x-api-version": "2.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "@entity": "in.co.sandbox.kyc.aadhaar.request",
        aadhaar_number: cleaned,
      }),
    });

    const raw = (await res.json()) as any;
    const data = raw?.data ?? raw;

    if (!res.ok || data?.code === "500") {
      const errMsg = data?.message ?? raw?.message ?? "OTP generation failed";
      return { otpSent: false, referenceId: "", message: errMsg, error: errMsg };
    }

    const referenceId: string = data?.ref_id ?? data?.reference_id ?? `SB-OTP-${Date.now()}`;
    const message: string =
      data?.message ?? "OTP sent to mobile number linked with Aadhaar";

    return { otpSent: true, referenceId, message, error: null };
  } catch (err: any) {
    console.error("❌ Aadhaar OTP generate error:", err.message);
    throw err;
  }
}

// ── Level 2b: Verify Aadhaar OTP ────────────────────────────

export interface AadhaarOtpVerifyResult {
  verified: boolean;
  name: string;
  maskedAadhaar: string;
  dob: string;
  gender: string;
  address: string;
  referenceId: string;
  error: string | null;
}

/**
 * Calls Sandbox Aadhaar OTP verify.
 * Returns sanitized demographic data — never raw Aadhaar digits.
 */
export async function verifyAadhaarOtp(
  referenceId: string,
  otp: string
): Promise<AadhaarOtpVerifyResult> {
  const errorResult = (msg: string): AadhaarOtpVerifyResult => ({
    verified: false,
    name: "",
    maskedAadhaar: "",
    dob: "",
    gender: "",
    address: "",
    referenceId,
    error: msg,
  });

  if (!referenceId || !otp) {
    return errorResult("referenceId and OTP are required");
  }

  if (!/^\d{6}$/.test(otp)) {
    return errorResult("OTP must be exactly 6 digits");
  }

  try {
    const accessToken = await getSandboxToken();

    const res = await fetch(`${env.SANDBOX_BASE_URL}/kyc/aadhaar/otp/verify`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-api-key": env.SANDBOX_API_KEY,
        "x-api-version": "2.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "@entity": "in.co.sandbox.kyc.aadhaar.request",
        ref_id: referenceId,
        otp,
      }),
    });

    const raw = (await res.json()) as any;
    const data = raw?.data ?? raw;

    if (!res.ok) {
      const msg = data?.message ?? raw?.message ?? "OTP verification failed";
      return errorResult(msg);
    }

    // Status can be "VALID" or similar
    const status: string = (data?.status ?? "").toUpperCase();
    if (status !== "VALID" && status !== "SUCCESS" && status !== "VERIFIED") {
      const msg = data?.message ?? "OTP is incorrect or expired";
      return errorResult(msg);
    }

    // Build address from nested fields
    const addr = data?.address ?? {};
    const addressParts = [
      addr.house,
      addr.street,
      addr.landmark,
      addr.locality,
      addr.vtc,
      addr.district,
      addr.state,
      addr.pincode,
    ].filter(Boolean);
    const address = addressParts.join(", ");

    // Mask Aadhaar — Sandbox may return it as XXXX-XXXX-1234
    const maskedAadhaar: string =
      data?.masked_aadhaar ?? data?.maskedAadhaar ?? "XXXX-XXXX-XXXX";

    return {
      verified: true,
      name: data?.name ?? "",
      maskedAadhaar,
      dob: data?.dob ?? "",
      gender: data?.gender ?? "",
      address,
      referenceId,
      error: null,
    };
  } catch (err: any) {
    console.error("❌ Aadhaar OTP verify error:", err.message);
    throw err;
  }
}

// ── Level 3: Offline eKYC ZIP (kept as fallback) ─────────────

export interface OfflineEkycResult {
  aadhaarVerified: boolean;
  name: string;
  maskedAadhaar: string;
  dob: string;
  address: string;
  referenceId: string;
  xmlHash: string;
  error: string | null;
}

export async function processOfflineEkyc(
  zipBuffer: Buffer,
  passcode: string
): Promise<OfflineEkycResult> {
  const errorResult = (msg: string): OfflineEkycResult => ({
    aadhaarVerified: false,
    name: "",
    maskedAadhaar: "",
    dob: "",
    address: "",
    referenceId: "",
    xmlHash: "",
    error: msg,
  });

  try {
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      return errorResult("Failed to open ZIP file. Ensure it is a valid ZIP archive.");
    }

    const entries = zip.getEntries();
    const xmlEntry = entries.find(
      (e) => e.entryName.toLowerCase().endsWith(".xml") && !e.isDirectory
    );

    if (!xmlEntry) {
      return errorResult("No XML file found inside the ZIP archive.");
    }

    let xmlContent: string;
    try {
      xmlContent = xmlEntry.getData().toString("utf-8");
      if (!xmlContent.includes("<?xml") && !xmlContent.includes("<OfflinePaperlessKyc")) {
        return errorResult("Could not decrypt the XML. The passcode may be incorrect.");
      }
    } catch {
      return errorResult("Failed to extract XML from ZIP. Check the passcode.");
    }

    const xmlHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(xmlContent));
    const signatureValid = xmlContent.includes("<ds:Signature") || xmlContent.includes("<Signature");

    const parsed = await parseStringPromise(xmlContent, {
      explicitArray: false,
      ignoreAttrs: false,
    });

    const root = parsed.OfflinePaperlessKyc ?? parsed;
    const uidData = root.UidData ?? root;
    const poi = uidData.Poi?.$ ?? uidData.Poi ?? {};
    const poa = uidData.Poa?.$ ?? uidData.Poa ?? {};

    const name = poi.name ?? poi.Name ?? "";
    const dob = poi.dob ?? poi.Dob ?? poi.DOB ?? "";
    const referenceId = root.$?.referenceId ?? root.referenceId ?? root.$?.txn ?? "";
    const maskedAadhaar = root.$?.uid ?? uidData.$?.uid ?? "XXXX-XXXX-XXXX";

    const addressParts = [
      poa.house ?? "", poa.street ?? "", poa.lm ?? "",
      poa.loc ?? "", poa.vtc ?? "", poa.dist ?? "",
      poa.state ?? "", poa.pc ?? "",
    ].filter(Boolean);

    return {
      aadhaarVerified: signatureValid,
      name,
      maskedAadhaar,
      dob,
      address: addressParts.join(", "),
      referenceId,
      xmlHash,
      error: signatureValid ? null : "UIDAI digital signature verification failed",
    };
  } catch (err: any) {
    return errorResult(`Unexpected error: ${err.message}`);
  }
}
