// components/DocScanner.jsx
// Browser-local OCR scanner widget for KYC document scanning
// Sits inside the KYC submit modal — user uploads doc, clicks Scan, fields auto-fill
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUpload, FiSearch, FiCheck, FiX, FiAlertTriangle,
  FiRefreshCw, FiFileText, FiUser, FiCalendar, FiHash, FiMapPin,
} from "react-icons/fi";

const DOC_TYPES = [
  { id: "aadhaar",  label: "Aadhaar Card",        flag: "🇮🇳", hint: "12-digit unique ID" },
  { id: "pan",      label: "PAN Card",             flag: "💳", hint: "Permanent Account Number" },
  { id: "passport", label: "Passport",             flag: "📕", hint: "Indian Passport" },
  { id: "dl",       label: "Driving Licence",      flag: "🚗", hint: "State DL" },
  { id: "generic",  label: "Other Document",       flag: "📄", hint: "Any ID proof" },
];

function extractDocumentFields(text, docType) {
  const name = text.match(/(?:full\s+)?name\s*[:\-]\s*([^\r\n]+)/i)?.[1]?.trim() || "";
  const dateOfBirth = text.match(
    /(?:date\s+of\s+birth|dob|birth\s+date)\s*[:\-]?\s*(\d{1,4}[./-]\d{1,2}[./-]\d{1,4})/i
  )?.[1] || "";
  const panNumber = text.match(/\b[A-Z]{5}\d{4}[A-Z]\b/i)?.[0]?.toUpperCase() || "";
  const aadhaarNumber = text.match(/(?:\d[\s-]*){12}/)?.[0]?.replace(/\D/g, "") || "";
  const passportNumber = text.match(/\b[A-Z]\d{7}\b/i)?.[0]?.toUpperCase() || "";

  let idNumber = "";
  if (docType === "aadhaar") idNumber = aadhaarNumber;
  else if (docType === "pan") idNumber = panNumber;
  else if (docType === "passport") idNumber = passportNumber;
  else idNumber = panNumber || aadhaarNumber || passportNumber;

  return { name, dob: dateOfBirth, idNumber };
}

export default function DocScanner({ onDataConfirmed, onClose }) {
  const [step, setStep] = useState("choose"); // choose | upload | scanning | result | error
  const [docType, setDocType] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const fileRef = useRef(null);

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFileSelect = (file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
    if (!allowed.includes(file.type)) {
      setErrorMsg("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File too large (max 10MB).");
      return;
    }
    setImageFile(file);
    setErrorMsg("");
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
    setStep("upload");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // ── Scan ────────────────────────────────────────────────────────────────────
  const handleScan = async () => {
    if (!imageFile) return;
    setStep("scanning");
    setErrorMsg("");

    let worker;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setScanProgress(Math.round(message.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(imageFile);
      if (!data.text.trim()) {
        throw new Error("No text was found. Try a clearer image.");
      }

      const fields = extractDocumentFields(data.text, docType);
      setScanResult({ complete: true });
      setEditedFields(fields);
      setConfidence(Math.round(data.confidence || 0));
      setStep("result");
    } catch (err) {
      setErrorMsg(err.message || "Local OCR failed to scan this image.");
      setStep("upload");
    } finally {
      if (worker) await worker.terminate();
      setScanProgress(0);
    }
  };

  // ── Confirm ─────────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    onDataConfirmed({
      docType,
      fields: editedFields,
      confidence,
    });
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(15,11,30,0.98) 0%,rgba(20,20,40,0.98) 100%)",
      border: "1px solid rgba(99,102,241,0.3)",
      borderRadius: 20,
      padding: 24,
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18,
          }}>🔍</div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:"#fff" }}>
              AI Document Scanner
            </div>
            <div style={{ fontSize:12, color:"#6366f1" }}>
              OCR runs locally in your browser
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:8, padding:"6px 10px", color:"#94a3b8", cursor:"pointer",
              fontSize:12,
            }}
          >
            Skip Scanner
          </button>
        )}
      </div>

      {/* Step: Choose document type */}
      {step === "choose" && (
        <div>
          <p style={{ color:"#94a3b8", fontSize:14, marginBottom:16 }}>
            Select your document type and we&apos;ll extract your details automatically.
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
            {DOC_TYPES.map((d) => (
              <button
                key={d.id}
                onClick={() => { setDocType(d.id); setStep("upload"); }}
                style={{
                  padding:"14px 10px", borderRadius:12, cursor:"pointer",
                  background: docType === d.id
                    ? "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.3))"
                    : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${docType === d.id ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
                  color:"#fff", textAlign:"center",
                  transition:"all 0.2s",
                }}
              >
                <div style={{ fontSize:24, marginBottom:6 }}>{d.flag}</div>
                <div style={{ fontWeight:700, fontSize:13 }}>{d.label}</div>
                <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{d.hint}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Upload */}
      {step === "upload" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <button
              onClick={() => setStep("choose")}
              style={{ background:"none", border:"none", color:"#6366f1", cursor:"pointer", fontSize:22 }}
            >‹</button>
            <span style={{ color:"#e2e8f0", fontWeight:700 }}>
              {DOC_TYPES.find((d) => d.id === docType)?.flag}{" "}
              Upload {DOC_TYPES.find((d) => d.id === docType)?.label}
            </span>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border:"2px dashed rgba(99,102,241,0.4)", borderRadius:14,
              padding:"32px 20px", textAlign:"center", cursor:"pointer",
              background: imagePreview ? "transparent" : "rgba(99,102,241,0.04)",
              transition:"border-color 0.2s",
            }}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                style={{ maxHeight:200, maxWidth:"100%", borderRadius:10, margin:"0 auto" }}
              />
            ) : (
              <>
                <FiUpload style={{ fontSize:36, color:"#6366f1", marginBottom:10, display:"block", margin:"0 auto 10px" }} />
                <div style={{ color:"#e2e8f0", fontWeight:600 }}>
                  Drag & drop or click to upload
                </div>
                <div style={{ color:"#6b7280", fontSize:12, marginTop:6 }}>
                  JPG, PNG or WEBP • Max 10MB
                </div>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            style={{ display:"none" }}
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />

          {errorMsg && (
            <div style={{ color:"#f87171", fontSize:13, marginTop:8, display:"flex", gap:6, alignItems:"center" }}>
              <FiAlertTriangle /> {errorMsg}
            </div>
          )}

          {imageFile && (
            <div style={{ display:"flex", gap:10, marginTop:14 }}>
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                style={{
                  flex:1, padding:"11px 0", borderRadius:10, cursor:"pointer",
                  background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
                  color:"#f87171", fontWeight:600, fontSize:14,
                }}
              >
                <FiX style={{ marginRight:6 }} />Change Image
              </button>
              <button
                onClick={handleScan}
                style={{
                  flex:2, padding:"11px 0", borderRadius:10, cursor:"pointer",
                  background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                  border:"none", color:"#fff", fontWeight:700, fontSize:15,
                  boxShadow:"0 0 20px rgba(99,102,241,0.4)",
                }}
              >
                🔍 Scan Document
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step: Scanning animation */}
      {step === "scanning" && (
        <div style={{ textAlign:"center", padding:"40px 0" }}>
          <motion.div
            animate={{ rotate:360 }}
            transition={{ duration:1, repeat:Infinity, ease:"linear" }}
            style={{ display:"inline-block", marginBottom:16 }}
          >
            <FiRefreshCw style={{ fontSize:40, color:"#6366f1" }} />
          </motion.div>
          <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:17 }}>
            Scanning document…
          </div>
          <div style={{ color:"#6b7280", fontSize:13, marginTop:8 }}>
            Extracting text on this device: {scanProgress}%
          </div>
          {/* Scanning progress dots */}
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:16 }}>
            {[0,1,2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity:[0.3, 1, 0.3] }}
                transition={{ delay: i*0.3, duration:1, repeat:Infinity }}
                style={{ width:8, height:8, borderRadius:"50%", background:"#6366f1" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === "result" && editedFields && (
        <div>
          {/* Confidence badge */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16,
          }}>
            <span style={{ color:"#e2e8f0", fontWeight:700 }}>
              OCR complete. Review and correct the fields below.
            </span>
            <span style={{
              padding:"4px 12px", borderRadius:20,
              background: confidence >= 66
                ? "rgba(96,165,250,0.15)" : "rgba(234,179,8,0.15)",
              border: `1px solid ${confidence >= 66 ? "rgba(96,165,250,0.4)" : "rgba(234,179,8,0.4)"}`,
              color: confidence >= 66 ? "#60a5fa" : "#eab308",
              fontSize:13, fontWeight:700,
            }}>
              {confidence}% OCR confidence
            </span>
          </div>

          {confidence < 40 && (
            <div style={{
              background:"rgba(234,179,8,0.1)", border:"1px solid rgba(234,179,8,0.3)",
              borderRadius:10, padding:12, marginBottom:16, color:"#fde68a", fontSize:13,
            }}>
              ⚠️ OCR confidence is low. This does not verify document authenticity; review every field.
            </div>
          )}

          {/* Extracted fields (editable) */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { key:"name", label:"Full Name", icon:<FiUser />, placeholder:"e.g. Rahul Sharma" },
              { key:"dob", label:"Date of Birth", icon:<FiCalendar />, placeholder:"DD/MM/YYYY" },
              { key:"idNumber", label:"ID Number", icon:<FiHash />, placeholder:"Document number" },
              { key:"fatherName", label:"Father's Name", icon:<FiUser />, placeholder:"(if available)" },
              { key:"address", label:"Address", icon:<FiMapPin />, placeholder:"Address from document" },
            ].filter(({ key }) => editedFields[key] !== undefined || ["name","dob","idNumber"].includes(key))
             .map(({ key, label, icon, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize:12, color:"#94a3b8", display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                  {icon} {label}
                </label>
                <input
                  type="text"
                  value={editedFields[key] || ""}
                  onChange={(e) => setEditedFields((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width:"100%", padding:"10px 14px", borderRadius:9,
                    background:"rgba(255,255,255,0.06)",
                    border:`1px solid ${editedFields[key] ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color:"#fff", fontSize:14, fontFamily:"monospace", outline:"none",
                    boxSizing:"border-box",
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            <button
              onClick={() => { setStep("upload"); setScanResult(null); setEditedFields({}); }}
              style={{
                flex:1, padding:"12px 0", borderRadius:10, cursor:"pointer",
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                color:"#94a3b8", fontWeight:600, fontSize:14,
              }}
            >
              ↩ Rescan
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex:2, padding:"12px 0", borderRadius:10, cursor:"pointer",
                background:"linear-gradient(135deg,#60a5fa,#2563eb)",
                border:"none", color:"#fff", fontWeight:800, fontSize:15,
              }}
            >
              ✅ Use This Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
