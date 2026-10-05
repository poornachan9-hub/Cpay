// lib/aadhaar.js
// ─────────────────────────────────────────────────────────────────────────────
// Aadhaar Number Verification Utility
//
// Validates Aadhaar numbers using:
//   1. Format check (12 digits, cannot start with 0 or 1)
//   2. Verhoeff checksum algorithm (same error-detection used in real Aadhaar)
//
// Also generates a keccak256 proof hash for on-chain storage.
// ─────────────────────────────────────────────────────────────────────────────
import { ethers } from "ethers";

// ── Verhoeff Algorithm Tables ───────────────────────────────────────────────

// Multiplication table (Dihedral group D5)
const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Permutation table
const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// Inverse table
const inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

// ── Verhoeff Check ──────────────────────────────────────────────────────────

/**
 * Validates a number string using the Verhoeff checksum algorithm.
 * @param {string} num - The number string to validate
 * @returns {boolean} True if the checksum is valid
 */
export function verhoeffCheck(num) {
  let c = 0;
  const digits = num.split("").reverse().map(Number);

  for (let i = 0; i < digits.length; i++) {
    c = d[c][p[i % 8][digits[i]]];
  }

  return c === 0;
}

// ── Format Check ────────────────────────────────────────────────────────────

/**
 * Checks if the Aadhaar number has a valid format.
 * Must be exactly 12 digits and cannot start with 0 or 1.
 * @param {string} aadhaar - The Aadhaar number string
 * @returns {boolean}
 */
export function isValidAadhaarFormat(aadhaar) {
  return /^[2-9][0-9]{11}$/.test(aadhaar);
}

// ── Combined Validation ─────────────────────────────────────────────────────

/**
 * Full Aadhaar validation: format check + Verhoeff checksum.
 * @param {string} aadhaar - The 12-digit Aadhaar number
 * @returns {{ valid: boolean, error: string|null }}
 */
export function isValidAadhaar(aadhaar) {
  if (!aadhaar || typeof aadhaar !== "string") {
    return { valid: false, error: "Aadhaar number is required" };
  }

  // Remove any spaces or dashes (users sometimes type "1234 5678 9012")
  const cleaned = aadhaar.replace(/[\s-]/g, "");

  if (cleaned.length !== 12) {
    return { valid: false, error: "Must be exactly 12 digits" };
  }

  if (!isValidAadhaarFormat(cleaned)) {
    return { valid: false, error: "Cannot start with 0 or 1" };
  }

  if (!verhoeffCheck(cleaned)) {
    return { valid: false, error: "Invalid Aadhaar number (checksum failed)" };
  }

  return { valid: true, error: null };
}

// ── Proof Hash Generation ───────────────────────────────────────────────────

/**
 * Generates a keccak256 hash of the Aadhaar number for on-chain proof.
 * The actual Aadhaar number is NEVER stored — only the hash.
 * @param {string} aadhaar - The 12-digit Aadhaar number
 * @returns {string} The keccak256 hash (bytes32)
 */
export function generateAadhaarProofHash(aadhaar) {
  const cleaned = aadhaar.replace(/[\s-]/g, "");
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(cleaned));
}

// ── Format Helper ───────────────────────────────────────────────────────────

/**
 * Formats Aadhaar for display: "1234 5678 9012"
 * @param {string} aadhaar
 * @returns {string}
 */
export function formatAadhaar(aadhaar) {
  const cleaned = aadhaar.replace(/[\s-]/g, "");
  return cleaned.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3");
}
