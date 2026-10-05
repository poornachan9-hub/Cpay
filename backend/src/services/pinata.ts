// ─────────────────────────────────────────────────────────────
// Pinata Service — uploads JSON to IPFS via Pinata
// ─────────────────────────────────────────────────────────────
import fetch from "node-fetch";
import { env } from "../config/env";

const PINATA_BASE_URL = "https://api.pinata.cloud";
const FormData = require("form-data");

type UploadableFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export async function uploadFileToIpfs(
  file: UploadableFile,
  name: string,
  keyvalues: Record<string, string>
): Promise<{ success: boolean; cid: string }> {
  try {
    if (!env.PINATA_JWT) {
      throw new Error("Pinata is not configured");
    }

    const extensionByMimeType: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const form = new FormData();
    form.append("file", file.buffer, {
      filename: `${name.replace(/[^a-zA-Z0-9._-]/g, "-")}.${extensionByMimeType[file.mimetype]}`,
      contentType: file.mimetype,
    });
    form.append(
      "pinataMetadata",
      JSON.stringify({
        name,
        keyvalues,
      })
    );
    form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const response = await fetch(`${PINATA_BASE_URL}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${env.PINATA_JWT}`,
      },
      body: form,
    });

    if (!response.ok) {
      console.error(`[Pinata] Document upload failed with status ${response.status}`);
      return { success: false, cid: "" };
    }

    const result = (await response.json()) as { IpfsHash?: string };
    if (!result.IpfsHash) return { success: false, cid: "" };
    return { success: true, cid: result.IpfsHash };
  } catch (error: any) {
    console.error("[Pinata] Document upload failed:", error.name || "UploadError");
    return { success: false, cid: "" };
  }
}

/**
 * Upload a JSON object to IPFS via Pinata.
 * Returns the IPFS CID (content identifier).
 */
export async function uploadJsonToIpfs(
  jsonData: any,
  name: string = "KYC Proof",
  keyvalues: Record<string, string> = {}
): Promise<{ success: boolean; cid: string; error?: string }> {
  try {
    const body = {
      pinataContent: jsonData,
      pinataMetadata: {
        name,
        keyvalues: {
          type: "kyc-proof",
          timestamp: new Date().toISOString(),
          ...keyvalues,
        },
      },
      pinataOptions: {
        cidVersion: 1,
      },
    };

    const response = await fetch(`${PINATA_BASE_URL}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.PINATA_JWT}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata returned HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      cid: result.IpfsHash,
    };
  } catch (err: any) {
    console.error("❌ Pinata upload failed:", err.message);
    return {
      success: false,
      cid: "",
      error: err.message,
    };
  }
}
