// ─────────────────────────────────────────────────────────────
// CryptoPay Backend — Express Entry Point
// ─────────────────────────────────────────────────────────────
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { pool } from "./config/db";
import authRoutes from "./routes/auth";
import kycRoutes from "./routes/kyc";
import aiRoutes from "./routes/ai";
import uploadRoutes from "./routes/uploads";

const app = express();
const allowedOrigins = new Set([
  env.FRONTEND_URL,
  ...(process.env.NODE_ENV === "production"
    ? []
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ]),
]);

// ── Middleware ───────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err: any) {
    res.status(503).json({ status: "error", database: err.message });
  }
});

// ── Routes ──────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/kyc", kycRoutes);
app.use("/uploads", uploadRoutes);
app.use("/api/ai", aiRoutes);

// ── 404 handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global error handler ────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("💥 Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// ── Start server ────────────────────────────────────────────
const PORT = env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║          🚀 CryptoPay Backend Running                ║
║──────────────────────────────────────────────────────║
║  Port:     ${String(PORT).padEnd(40)}║
║  Frontend: ${env.FRONTEND_URL.padEnd(40)}║
║  Health:   http://localhost:${PORT}/health${" ".repeat(Math.max(0, 24 - String(PORT).length))}║
╚══════════════════════════════════════════════════════╝
  `);
});

export default app;
