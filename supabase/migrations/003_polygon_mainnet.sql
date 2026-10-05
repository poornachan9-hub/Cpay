-- supabase/migrations/003_polygon_mainnet.sql
-- ═══════════════════════════════════════════════════════════════
-- Phase 6: Polygon Mainnet Schema Migration
-- Run via: Supabase Dashboard → SQL Editor → Run
--          OR: supabase db push (if using Supabase CLI)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Alter payments table to add Polygon fields ──────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS chain_id       integer DEFAULT 137,
  ADD COLUMN IF NOT EXISTS token_address  text,
  ADD COLUMN IF NOT EXISTS token_symbol   text CHECK (token_symbol IN ('USDC', 'USDT', 'ETH', 'MATIC')),
  ADD COLUMN IF NOT EXISTS token_amount   numeric;

-- Update existing rows to Sepolia chain_id for data integrity
UPDATE payments
  SET chain_id = 11155111
  WHERE chain_id IS NULL AND created_at < now();

-- ── 2. Create fiat_offramps table ─────────────────────────────
CREATE TABLE IF NOT EXISTS fiat_offramps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet      text NOT NULL,
  mudrex_order_id  text UNIQUE,
  token_symbol     text DEFAULT 'USDC' CHECK (token_symbol IN ('USDC', 'USDT')),
  amount_usdc      numeric,
  amount_usdt      numeric,
  amount_inr       numeric,
  bank_account     text,    -- last 4 digits only (PII-redacted)
  ifsc             text,
  holder_name      text,
  status           text DEFAULT 'initiated' CHECK (
                     status IN ('initiated', 'processing', 'completed', 'failed', 'refunded')
                   ),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_fiat_offramps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiat_offramps_updated_at ON fiat_offramps;
CREATE TRIGGER trg_fiat_offramps_updated_at
  BEFORE UPDATE ON fiat_offramps
  FOR EACH ROW EXECUTE FUNCTION update_fiat_offramps_updated_at();

-- ── 3. Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fiat_offramps_wallet
  ON fiat_offramps (user_wallet);

CREATE INDEX IF NOT EXISTS idx_fiat_offramps_status
  ON fiat_offramps (status);

CREATE INDEX IF NOT EXISTS idx_fiat_offramps_created
  ON fiat_offramps (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_chain_id
  ON payments (chain_id);

CREATE INDEX IF NOT EXISTS idx_payments_token_symbol
  ON payments (token_symbol);

-- ── 4. RLS: Row-Level Security ─────────────────────────────────
ALTER TABLE fiat_offramps ENABLE ROW LEVEL SECURITY;

-- CoinCrop uses wallet-as-identity (no Supabase Auth email).
-- wallet address is stored in JWT custom claims or matched directly.

-- Policy: users can read their own offramp records
DROP POLICY IF EXISTS "Users can view own offramps" ON fiat_offramps;
CREATE POLICY "Users can view own offramps"
  ON fiat_offramps FOR SELECT
  USING (
    lower(user_wallet) = lower(
      COALESCE(
        current_setting('request.jwt.claims', true)::json->>'wallet',
        current_setting('request.jwt.claims', true)::json->>'sub',
        ''
      )
    )
  );

-- Policy: service role can insert/update (API route uses service key)
DROP POLICY IF EXISTS "Service role full access" ON fiat_offramps;
CREATE POLICY "Service role full access"
  ON fiat_offramps FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 5. Grant table access ─────────────────────────────────────
GRANT ALL ON fiat_offramps TO service_role;
GRANT SELECT ON fiat_offramps TO anon, authenticated;

-- ── DONE ──────────────────────────────────────────────────────
-- After running this migration:
--   1. Deploy contract: npx hardhat run scripts/deploy-polygon.js --network polygon
--   2. Add NEXT_PUBLIC_PAYMENT_GATEWAY_POLYGON to .env.local
--   3. npm run dev → test on Polygon Mainnet
