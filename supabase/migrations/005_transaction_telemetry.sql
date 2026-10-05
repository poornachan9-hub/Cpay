CREATE TABLE IF NOT EXISTS public.transaction_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  wallet_address text NOT NULL,
  tx_hash text NOT NULL CHECK (tx_hash ~ '^0x[a-fA-F0-9]{64}$'),
  network text NOT NULL,
  token text,
  amount numeric(78, 18) CHECK (amount IS NULL OR amount >= 0),
  status text NOT NULL CHECK (status IN ('submitted', 'pending', 'confirmed', 'failed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  confirmation_time_seconds integer CHECK (
    confirmation_time_seconds IS NULL OR confirmation_time_seconds >= 0
  ),
  block_number bigint CHECK (block_number IS NULL OR block_number >= 0),
  gas_used numeric(78, 0) CHECK (gas_used IS NULL OR gas_used >= 0),
  gas_price numeric(78, 0) CHECK (gas_price IS NULL OR gas_price >= 0),
  failure_reason text,
  data_source text NOT NULL DEFAULT 'polygon_rpc',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_telemetry_network_tx_hash_key UNIQUE (network, tx_hash),
  CONSTRAINT transaction_telemetry_confirmation_time_check
    CHECK (confirmed_at IS NULL OR confirmed_at >= submitted_at)
);

CREATE INDEX IF NOT EXISTS idx_transaction_telemetry_wallet_submitted
  ON public.transaction_telemetry (wallet_address, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_telemetry_status_submitted
  ON public.transaction_telemetry (status, submitted_at DESC);

ALTER TABLE public.transaction_telemetry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transaction_telemetry FROM anon, authenticated;
GRANT ALL ON public.transaction_telemetry TO service_role;

DROP POLICY IF EXISTS "Service role full access" ON public.transaction_telemetry;
CREATE POLICY "Service role full access"
  ON public.transaction_telemetry FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);