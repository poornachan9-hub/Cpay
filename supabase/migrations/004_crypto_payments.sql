CREATE TABLE IF NOT EXISTS public.crypto_payments (
  chain_id integer NOT NULL CHECK (chain_id IN (1337, 137)),
  tx_hash text NOT NULL CHECK (length(tx_hash) = 66),
  buyer_wallet text NOT NULL,
  product_id bigint NOT NULL,
  token_symbol text NOT NULL CHECK (token_symbol IN ('USDC', 'USDT')),
  token_address text NOT NULL,
  token_amount numeric(78, 18) NOT NULL CHECK (token_amount > 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  network text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_crypto_payments_wallet_chain_created
  ON public.crypto_payments (buyer_wallet, chain_id, created_at DESC);

ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.crypto_payments TO service_role;