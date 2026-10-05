// ─────────────────────────────────────────────────────────────
// KYC Routes — PAN, Aadhaar OTP, status, and on-chain finalization
// All manual/mock verification replaced with Sandbox.co.in API
// ─────────────────────────────────────────────────────────────
import { Router, Response, NextFunction } from "express";
import { ethers } from "ethers";
import multer from "multer";
import { query } from "../config/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { verifyPan, isValidPanFormat } from "../services/pan";
import {
  validateAadhaarChecksum,
  generateAadhaarOtp,
  verifyAadhaarOtp,
  processOfflineEkyc,
} from "../services/aadhaar";
import { submitKycOnChain, getOnChainKycStatus } from "../services/blockchain";
import { uploadFileToIpfs, uploadJsonToIpfs } from "../services/pinata";


const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const allowedKycDocumentTypes = new Set(["identity", "address", "business", "bank"]);
const allowedKycMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function parseKycFile(req: AuthRequest, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (error: any) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({
        error: error.code === "LIMIT_FILE_SIZE"
          ? "Document exceeds the 10 MB upload limit"
          : "Invalid document upload",
      });
      return;
    }
    if (error) {
      res.status(400).json({ error: "Invalid document upload" });
      return;
    }
    next();
  });
}

function hasValidDocumentSignature(file: NonNullable<AuthRequest["file"]>): boolean {
  const bytes = file.buffer;
  switch (file.mimetype) {
    case "application/pdf":
      return bytes.subarray(0, 5).toString() === "%PDF-";
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    default:
      return false;
  }
}

router.post(
  "/documents",
  requireAuth,
  parseKycFile,
  async (req: AuthRequest, res: Response) => {
    const file = req.file;
    const documentType = req.body?.documentType;
    if (!file) return res.status(400).json({ error: "A document file is required" });
    if (!allowedKycDocumentTypes.has(documentType)) {
      return res.status(400).json({ error: "Invalid KYC document type" });
    }
    if (!allowedKycMimeTypes.has(file.mimetype) || !hasValidDocumentSignature(file)) {
      return res.status(415).json({ error: "Only valid PDF, JPEG, and PNG documents are accepted" });
    }

    const result = await uploadFileToIpfs(file, `KYC ${documentType} document`, {
      type: "kyc-document",
      documentType,
    });
    if (!result.success) {
      return res.status(502).json({ error: "Document upload failed. Check server-side Pinata configuration." });
    }
    return res.status(201).json({ ipfsHash: result.cid });
  }
);

router.post("/metadata", requireAuth, async (req: AuthRequest, res: Response) => {
  const payload = req.body;
  if (
    !payload ||
    !Array.isArray(payload.documents) ||
    payload.documents.length === 0 ||
    !/^0x[a-fA-F0-9]{64}$/.test(payload.aadhaarProofHash || "")
  ) {
    return res.status(400).json({ error: "Invalid KYC metadata" });
  }

  const documents = payload.documents.map((document: any) => ({
    type: document.type,
    ipfsHash: document.ipfsHash,
    filename: document.filename,
  }));
  if (documents.some((document: any) =>
    !allowedKycDocumentTypes.has(document.type) ||
    typeof document.ipfsHash !== "string" ||
    !/^[a-zA-Z0-9]+$/.test(document.ipfsHash)
  )) {
    return res.status(400).json({ error: "Invalid KYC document metadata" });
  }

  const result = await uploadJsonToIpfs({
    documents,
    submittedAt: new Date().toISOString(),
    userAddress: req.wallet,
    aadhaarProofHash: payload.aadhaarProofHash,
  }, "KYC Metadata");
  if (!result.success) {
    return res.status(502).json({ error: "KYC metadata upload failed" });
  }
  return res.status(201).json({ ipfsHash: result.cid });
});

// ── Helper: ensure KYC record exists ─────────────────────────
async function ensureKycRecord(wallet: string): Promise<void> {
  await query(
    `INSERT INTO kyc_records (wallet_address)
     VALUES ($1)
     ON CONFLICT (wallet_address) DO NOTHING`,
    [wallet]
  );
}

// ── Helper: update overall status based on PAN + Aadhaar ─────
async function refreshOverallStatus(wallet: string): Promise<string> {
  const rows = await query<{
    pan_status: string;
    aadhaar_status: string;
    overall_kyc_status: string;
  }>(
    "SELECT pan_status, aadhaar_status, overall_kyc_status FROM kyc_records WHERE wallet_address = $1",
    [wallet]
  );

  if (rows.length === 0) return "NOT_STARTED";

  const { pan_status, aadhaar_status } = rows[0];

  let newStatus: string;

  if (pan_status === "FAILED" || aadhaar_status === "FAILED") {
    newStatus = "FAILED";
  } else if (pan_status === "PASSED" && aadhaar_status === "PASSED") {
    newStatus = "AADHAAR_VERIFIED";
  } else if (aadhaar_status === "OTP_SENT") {
    newStatus = "AADHAAR_OTP_SENT";
  } else if (pan_status === "PASSED") {
    newStatus = "PAN_VERIFIED";
  } else {
    newStatus = "NOT_STARTED";
  }

  await query(
    "UPDATE kyc_records SET overall_kyc_status = $1, updated_at = NOW() WHERE wallet_address = $2",
    [newStatus, wallet]
  );

  return newStatus;
}

// ─────────────────────────────────────────────────────────────
// GET /kyc/status — returns current KYC status from DB
// ─────────────────────────────────────────────────────────────
router.get("/status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = req.wallet!;

    const rows = await query(
      `SELECT
        pan_status, aadhaar_status, overall_kyc_status,
        pan_reference_id, aadhaar_reference_id,
        aadhaar_checksum_valid,
        kyc_proof_hash, ipfs_cid, tx_hash,
        created_at, updated_at
       FROM kyc_records WHERE wallet_address = $1`,
      [wallet]
    );

    if (rows.length === 0) {
      return res.json({
        wallet,
        panStatus: "PENDING",
        aadhaarStatus: "PENDING",
        overallKycStatus: "NOT_STARTED",
        aadhaarReferenceId: null,
        kycProofHash: null,
        ipfsCid: null,
        txHash: null,
      });
    }

    const r = rows[0] as any;
    return res.json({
      wallet,
      panStatus: r.pan_status,
      aadhaarStatus: r.aadhaar_status,
      overallKycStatus: r.overall_kyc_status,
      aadhaarReferenceId: r.aadhaar_reference_id,
      aadhaarChecksumValid: r.aadhaar_checksum_valid,
      kycProofHash: r.kyc_proof_hash,
      ipfsCid: r.ipfs_cid,
      txHash: r.tx_hash,
    });
  } catch (err: any) {
    console.error("❌ /kyc/status error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /kyc/pan/start — real PAN verification via Sandbox API
// Body: { pan: "ABCDE1234F", fullName: "...", dob: "YYYY-MM-DD" }
// ─────────────────────────────────────────────────────────────
router.post(
  "/pan/start",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      const { pan, fullName, dob } = req.body;

      // Input validation
      if (!pan || !fullName || !dob) {
        return res.status(400).json({ error: "pan, fullName, and dob are required" });
      }

      const panUpper = pan.toUpperCase().trim();
      if (!isValidPanFormat(panUpper)) {
        return res.status(400).json({ error: "Invalid PAN format. Expected: ABCDE1234F" });
      }

      // Validate DOB format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        return res.status(400).json({ error: "dob must be in YYYY-MM-DD format" });
      }

      await ensureKycRecord(wallet);

      // Guard: already verified
      const existing = await query<{ overall_kyc_status: string }>(
        "SELECT overall_kyc_status FROM kyc_records WHERE wallet_address = $1",
        [wallet]
      );
      if (existing[0]?.overall_kyc_status === "KYC_VERIFIED") {
        return res.status(400).json({ error: "KYC is already verified" });
      }

      // Call Sandbox PAN API
      const result = await verifyPan({ pan: panUpper, fullName, dob });
      const panStatus = result.panValid && result.nameMatch ? "PASSED" : "FAILED";

      // Store result
      await query(
        `UPDATE kyc_records
         SET pan_status = $1,
             pan_reference_id = $2,
             pan_response = $3,
             pan_verified_at = NOW(),
             updated_at = NOW()
         WHERE wallet_address = $4`,
        [panStatus, result.referenceId, JSON.stringify(result.rawResponse), wallet]
      );

      const overallStatus = await refreshOverallStatus(wallet);

      return res.json({
        panValid: result.panValid,
        nameMatch: result.nameMatch,
        panStatus,
        referenceId: result.referenceId,
        overallKycStatus: overallStatus,
        message:
          panStatus === "PASSED"
            ? "PAN verified successfully ✓"
            : result.panValid
            ? "PAN is valid but name does not match our records"
            : "PAN verification failed — invalid PAN number",
      });
    } catch (err: any) {
      console.error("❌ /kyc/pan/start error:", err.message);

      if (err.message.includes("not configured")) {
        return res.status(503).json({
          error: err.message,
          hint: "Set SANDBOX_API_KEY and SANDBOX_API_SECRET in your backend .env file",
        });
      }

      return res.status(500).json({ error: "PAN verification failed: " + err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /kyc/aadhaar/start — Generate Aadhaar OTP via Sandbox API
// Body: { aadhaarNumber: "999941057058", consent: true }
// ─────────────────────────────────────────────────────────────
router.post(
  "/aadhaar/start",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      const { aadhaarNumber, consent } = req.body;

      // Require explicit user consent
      if (!consent) {
        return res.status(400).json({
          error: "User consent is required for Aadhaar verification",
        });
      }

      if (!aadhaarNumber) {
        return res.status(400).json({ error: "aadhaarNumber is required" });
      }

      const cleaned = aadhaarNumber.replace(/[\s-]/g, "");

      // Validate format + checksum
      const validation = validateAadhaarChecksum(cleaned);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      await ensureKycRecord(wallet);

      // Guard: PAN must be verified first
      const kycRow = await query<{ pan_status: string; overall_kyc_status: string }>(
        "SELECT pan_status, overall_kyc_status FROM kyc_records WHERE wallet_address = $1",
        [wallet]
      );
      if (!kycRow.length || kycRow[0].pan_status !== "PASSED") {
        return res.status(400).json({
          error: "Please complete PAN verification before Aadhaar verification",
        });
      }
      if (kycRow[0].overall_kyc_status === "KYC_VERIFIED") {
        return res.status(400).json({ error: "KYC is already verified" });
      }

      // Call Sandbox: generate OTP
      const result = await generateAadhaarOtp(cleaned);

      if (!result.otpSent) {
        return res.status(400).json({
          error: result.error ?? "Failed to send OTP",
          message: result.message,
        });
      }

      // Store referenceId and OTP_SENT status
      await query(
        `UPDATE kyc_records
         SET aadhaar_status = 'OTP_SENT',
             aadhaar_reference_id = $1,
             aadhaar_response = $2,
             updated_at = NOW()
         WHERE wallet_address = $3`,
        [
          result.referenceId,
          JSON.stringify({ otpSent: true, message: result.message }),
          wallet,
        ]
      );

      const overallStatus = await refreshOverallStatus(wallet);

      return res.json({
        otpSent: true,
        referenceId: result.referenceId,
        message: result.message,
        overallKycStatus: overallStatus,
      });
    } catch (err: any) {
      console.error("❌ /kyc/aadhaar/start error:", err.message);

      if (err.message.includes("not configured")) {
        return res.status(503).json({
          error: err.message,
          hint: "Set SANDBOX_API_KEY and SANDBOX_API_SECRET in your backend .env file",
        });
      }

      return res.status(500).json({ error: "Aadhaar OTP generation failed: " + err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /kyc/aadhaar/verify — Verify Aadhaar OTP via Sandbox API
// Body: { otp: "123456" }
// ─────────────────────────────────────────────────────────────
router.post(
  "/aadhaar/verify",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({ error: "otp is required" });
      }

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: "OTP must be exactly 6 digits" });
      }

      // Get stored reference_id
      const rows = await query<{
        aadhaar_reference_id: string;
        aadhaar_status: string;
        overall_kyc_status: string;
      }>(
        "SELECT aadhaar_reference_id, aadhaar_status, overall_kyc_status FROM kyc_records WHERE wallet_address = $1",
        [wallet]
      );

      if (!rows.length) {
        return res.status(400).json({
          error: "No KYC record found. Please start Aadhaar verification first.",
        });
      }

      const { aadhaar_reference_id, aadhaar_status, overall_kyc_status } = rows[0];

      if (overall_kyc_status === "KYC_VERIFIED") {
        return res.status(400).json({ error: "KYC is already verified" });
      }

      if (aadhaar_status !== "OTP_SENT") {
        return res.status(400).json({
          error: "Aadhaar OTP has not been sent. Call /aadhaar/start first.",
        });
      }

      if (!aadhaar_reference_id) {
        return res.status(400).json({
          error: "Reference ID not found. Please regenerate the OTP.",
        });
      }

      // Call Sandbox: verify OTP
      const result = await verifyAadhaarOtp(aadhaar_reference_id, otp);

      if (!result.verified) {
        return res.status(400).json({
          error: result.error ?? "OTP verification failed",
          aadhaarStatus: "OTP_FAILED",
        });
      }

      // Store verified details (no raw Aadhaar — only masked)
      await query(
        `UPDATE kyc_records
         SET aadhaar_status = 'PASSED',
             aadhaar_response = $1,
             aadhaar_checksum_valid = true,
             aadhaar_verified_at = NOW(),
             updated_at = NOW()
         WHERE wallet_address = $2`,
        [
          JSON.stringify({
            name: result.name,
            maskedAadhaar: result.maskedAadhaar,
            dob: result.dob,
            gender: result.gender,
            address: result.address,
            referenceId: result.referenceId,
          }),
          wallet,
        ]
      );

      const overallStatus = await refreshOverallStatus(wallet);

      return res.json({
        aadhaarVerified: true,
        name: result.name,
        maskedAadhaar: result.maskedAadhaar,
        dob: result.dob,
        gender: result.gender,
        overallKycStatus: overallStatus,
        message: "Aadhaar verified successfully ✓",
      });
    } catch (err: any) {
      console.error("❌ /kyc/aadhaar/verify error:", err.message);
      return res.status(500).json({ error: "Aadhaar OTP verification failed: " + err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /kyc/aadhaar/offline — Offline eKYC ZIP (fallback)
// ─────────────────────────────────────────────────────────────
router.post(
  "/aadhaar/offline",
  requireAuth,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      const { passcode } = req.body;

      if (!req.file) return res.status(400).json({ error: "ZIP file is required" });
      if (!passcode) return res.status(400).json({ error: "passcode is required" });

      await ensureKycRecord(wallet);

      const result = await processOfflineEkyc(req.file.buffer, passcode);

      if (!result.aadhaarVerified) {
        await query(
          `UPDATE kyc_records
           SET aadhaar_status = 'FAILED',
               aadhaar_response = $1,
               aadhaar_verified_at = NOW(), updated_at = NOW()
           WHERE wallet_address = $2`,
          [JSON.stringify({ error: result.error, maskedAadhaar: result.maskedAadhaar }), wallet]
        );
        const overallStatus = await refreshOverallStatus(wallet);
        return res.json({ aadhaarVerified: false, error: result.error, overallKycStatus: overallStatus });
      }

      await query(
        `UPDATE kyc_records
         SET aadhaar_status = 'PASSED',
             aadhaar_reference_id = $1,
             aadhaar_response = $2,
             aadhaar_checksum_valid = true,
             aadhaar_xml_hash = $3,
             aadhaar_verified_at = NOW(), updated_at = NOW()
         WHERE wallet_address = $4`,
        [
          result.referenceId,
          JSON.stringify({ name: result.name, maskedAadhaar: result.maskedAadhaar, dob: result.dob }),
          result.xmlHash,
          wallet,
        ]
      );

      const overallStatus = await refreshOverallStatus(wallet);
      return res.json({
        aadhaarVerified: true,
        name: result.name,
        maskedAadhaar: result.maskedAadhaar,
        dob: result.dob,
        overallKycStatus: overallStatus,
        message: "Aadhaar offline eKYC verified successfully",
      });
    } catch (err: any) {
      console.error("❌ /kyc/aadhaar/offline error:", err.message);
      return res.status(500).json({ error: "Offline eKYC failed: " + err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /kyc/finalize — build proof → IPFS → on-chain → KYC_VERIFIED
// Both PAN and Aadhaar must be PASSED
// ─────────────────────────────────────────────────────────────
router.post(
  "/finalize",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const wallet = req.wallet!;

      const rows = await query<{
        pan_status: string;
        aadhaar_status: string;
        overall_kyc_status: string;
        pan_reference_id: string;
        aadhaar_reference_id: string;
      }>(
        `SELECT pan_status, aadhaar_status, overall_kyc_status,
                pan_reference_id, aadhaar_reference_id
         FROM kyc_records WHERE wallet_address = $1`,
        [wallet]
      );

      if (rows.length === 0) {
        return res.status(400).json({
          error: "No KYC record found. Complete PAN and Aadhaar verification first.",
        });
      }

      const record = rows[0];

      if (record.overall_kyc_status === "KYC_VERIFIED") {
        return res.status(400).json({ error: "KYC is already verified" });
      }

      if (record.pan_status !== "PASSED") {
        return res.status(400).json({
          error: "PAN verification must be completed first",
          panStatus: record.pan_status,
        });
      }

      if (record.aadhaar_status !== "PASSED") {
        return res.status(400).json({
          error: "Aadhaar verification must be completed first",
          aadhaarStatus: record.aadhaar_status,
        });
      }

      // Build KYC proof JSON (no raw PAN/Aadhaar digits)
      const kycProof = {
        wallet,
        panStatus: "PASSED",
        aadhaarStatus: "PASSED",
        panReferenceId: record.pan_reference_id,
        aadhaarReferenceId: record.aadhaar_reference_id,
        verifiedAt: new Date().toISOString(),
        version: "2.0",
      };

      const proofString = JSON.stringify(kycProof, Object.keys(kycProof).sort());
      const kycProofHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(proofString));

      // Upload to IPFS
      console.log("📤 Uploading KYC proof to IPFS...");
      const ipfsResult = await uploadJsonToIpfs(kycProof, `KYC-Proof-${wallet.slice(0, 8)}`);

      if (!ipfsResult.success) {
        return res.status(500).json({
          error: "Failed to upload KYC proof to IPFS: " + ipfsResult.error,
        });
      }

      // Check on-chain status
      const onChainStatus = await getOnChainKycStatus(wallet);
      const alreadyOnChain =
        onChainStatus && (onChainStatus.status === 1 || onChainStatus.status === 2);

      let txHash = "";

      if (alreadyOnChain) {
        console.log(`ℹ️ KYC already on-chain (status ${onChainStatus!.status}) — skipping`);
      } else {
        console.log("📝 Submitting KYC proof on-chain...");
        const txResult = await submitKycOnChain(wallet, ipfsResult.cid);

        if (!txResult.success) {
          const alreadyExists =
            txResult.error?.includes("already submitted") ||
            txResult.error?.includes("execution reverted");
          if (!alreadyExists) {
            return res.status(500).json({
              error: "On-chain KYC submission failed: " + txResult.error,
              ipfsCid: ipfsResult.cid,
            });
          }
          console.warn("⚠️ On-chain tx reverted (already exists) — marking VERIFIED");
        } else {
          txHash = txResult.txHash;
        }
      }

      // Update DB to KYC_VERIFIED
      await query(
        `UPDATE kyc_records
         SET overall_kyc_status = 'KYC_VERIFIED',
             kyc_proof_hash = $1,
             ipfs_cid = $2,
             tx_hash = $3,
             updated_at = NOW()
         WHERE wallet_address = $4`,
        [kycProofHash, ipfsResult.cid, txHash || null, wallet]
      );

      return res.json({
        overallKycStatus: "KYC_VERIFIED",
        kycProofHash,
        ipfsCid: ipfsResult.cid,
        txHash: txHash || null,
        message: "KYC verified successfully! ✓",
      });
    } catch (err: any) {
      console.error("❌ /kyc/finalize error:", err.message);
      return res.status(500).json({ error: "KYC finalization failed: " + err.message });
    }
  }
);

export default router;
