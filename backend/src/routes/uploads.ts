import { NextFunction, Response, Router } from "express";
import multer from "multer";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { uploadFileToIpfs, uploadJsonToIpfs } from "../services/pinata";

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseProductImage(req: AuthRequest, res: Response, next: NextFunction): void {
  imageUpload.single("file")(req, res, (error: any) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({
        error: error.code === "LIMIT_FILE_SIZE"
          ? "Product image exceeds the 5 MB upload limit"
          : "Invalid image upload",
      });
      return;
    }
    if (error) {
      res.status(400).json({ error: "Invalid image upload" });
      return;
    }
    next();
  });
}

function hasValidImageSignature(file: NonNullable<AuthRequest["file"]>): boolean {
  const bytes = file.buffer;
  if (file.mimetype === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.mimetype === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }
  if (file.mimetype === "image/webp") {
    return bytes.length >= 12 &&
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP";
  }
  return false;
}

router.post("/image", requireAuth, parseProductImage, async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "An image file is required" });
  if (!imageMimeTypes.has(file.mimetype) || !hasValidImageSignature(file)) {
    return res.status(415).json({ error: "Use a valid JPEG, PNG, or WebP image" });
  }

  const result = await uploadFileToIpfs(file, "Product image", {
    type: "product-image",
    merchant: req.wallet || "",
  });
  if (!result.success) return res.status(502).json({ error: "Product image upload failed" });
  return res.status(201).json({ ipfsHash: result.cid });
});

router.post("/metadata", requireAuth, async (req: AuthRequest, res: Response) => {
  const metadata = req.body;
  if (
    !metadata ||
    typeof metadata.name !== "string" ||
    !metadata.name.trim() ||
    metadata.name.length > 120 ||
    typeof metadata.description !== "string" ||
    metadata.description.length > 5000 ||
    (metadata.weight !== undefined && (typeof metadata.weight !== "string" || metadata.weight.length > 80)) ||
    (metadata.batchCode !== undefined && (typeof metadata.batchCode !== "string" || metadata.batchCode.length > 100)) ||
    (metadata.image !== null && metadata.image !== undefined && typeof metadata.image !== "string")
  ) {
    return res.status(400).json({ error: "Invalid product metadata" });
  }

  const productMetadata = {
    ...metadata,
    merchant: req.wallet,
  };
  if (JSON.stringify(productMetadata).length > 20000) {
    return res.status(413).json({ error: "Product metadata exceeds the upload limit" });
  }

  const result = await uploadJsonToIpfs(productMetadata, `Product-${metadata.name}`, {
    type: "product-metadata",
    merchant: req.wallet || "",
  });
  if (!result.success) return res.status(502).json({ error: "Product metadata upload failed" });
  return res.status(201).json({ ipfsHash: result.cid });
});

export default router;