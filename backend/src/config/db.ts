// ─────────────────────────────────────────────────────────────
// PostgreSQL connection pool
// ─────────────────────────────────────────────────────────────
import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log connection status
pool.on("connect", () => {
  console.log("📦 PostgreSQL client connected");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err.message);
});

/**
 * Helper to run a query and return rows.
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
