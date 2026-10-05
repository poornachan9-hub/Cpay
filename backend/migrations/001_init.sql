-- ─────────────────────────────────────────────────────────────
-- CryptoPay Backend — Initial Schema
-- Run: psql $DATABASE_URL -f migrations/001_init.sql
-- ─────────────────────────────────────────────────────────────

-- Custom enum types
DO $$ BEGIN CREATE TYPE pan_status_enum    AS ENUM ('PENDING', 'PASSED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE aadhaar_status_enum AS ENUM ('PENDING', 'PASSED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE kyc_status_enum    AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Users table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  wallet_address  VARCHAR(42) PRIMARY KEY,           -- 0x-prefixed, checksummed
  nonce           VARCHAR(64) NOT NULL,               -- random nonce for SIWE-style login
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── KYC Records table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc_records (
  wallet_address      VARCHAR(42) PRIMARY KEY REFERENCES users(wallet_address),

  -- PAN verification
  pan_status          pan_status_enum     NOT NULL DEFAULT 'PENDING',
  pan_reference_id    VARCHAR(128),
  pan_response        JSONB,              -- full aggregator response (server-side only)
  pan_verified_at     TIMESTAMPTZ,

  -- Aadhaar verification
  aadhaar_status      aadhaar_status_enum NOT NULL DEFAULT 'PENDING',
  aadhaar_reference_id VARCHAR(128),
  aadhaar_response    JSONB,              -- minimal fields from offline eKYC
  aadhaar_checksum_valid BOOLEAN DEFAULT FALSE,
  aadhaar_xml_hash    VARCHAR(66),        -- keccak256 hash of the raw XML
  aadhaar_verified_at TIMESTAMPTZ,

  -- Combined KYC
  overall_kyc_status  kyc_status_enum     NOT NULL DEFAULT 'NOT_STARTED',
  kyc_proof_hash      VARCHAR(66),        -- keccak256 of the proof JSON
  ipfs_cid            VARCHAR(128),       -- Pinata CID
  tx_hash             VARCHAR(66),        -- on-chain transaction hash

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_kyc_overall_status ON kyc_records(overall_kyc_status);
CREATE INDEX idx_kyc_pan_status     ON kyc_records(pan_status);
CREATE INDEX idx_kyc_aadhaar_status ON kyc_records(aadhaar_status);
