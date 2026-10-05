// ─────────────────────────────────────────────────────────────
// Verhoeff checksum algorithm — validates Aadhaar numbers
// Ported from the frontend lib/aadhaar.js
// ─────────────────────────────────────────────────────────────

// Dihedral group D5 multiplication table
const d: number[][] = [
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
const p: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Verhoeff checksum validation.
 * Returns true if the number passes the checksum.
 */
export function verhoeffCheck(num: string): boolean {
  let c = 0;
  const digits = num.split("").reverse().map(Number);

  for (let i = 0; i < digits.length; i++) {
    c = d[c][p[i % 8][digits[i]]];
  }

  return c === 0;
}

/**
 * Format check: exactly 12 digits, cannot start with 0 or 1.
 */
export function isValidAadhaarFormat(aadhaar: string): boolean {
  return /^[2-9][0-9]{11}$/.test(aadhaar);
}

/**
 * Full Aadhaar validation: format + Verhoeff checksum.
 */
export function isValidAadhaar(aadhaar: string): { valid: boolean; error: string | null } {
  if (!aadhaar || typeof aadhaar !== "string") {
    return { valid: false, error: "Aadhaar number is required" };
  }

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
