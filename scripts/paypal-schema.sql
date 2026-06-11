-- =====================================================================
-- paypal_orders  —  PayPal Checkout order tracking
-- =====================================================================
-- Run this in the Supabase SQL editor (one-time setup, before enabling
-- the PayPal button on the live site).
-- Idempotent: safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS paypal_orders (
  id                TEXT PRIMARY KEY,          -- PayPal order ID
  product_id        TEXT NOT NULL,             -- e.g. 'r-01'
  amount_cents      INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  status            TEXT NOT NULL,             -- 'created' | 'captured' | 'failed' | 'refunded' | 'voided'
  buyer_email       TEXT,
  buyer_name        TEXT,
  shipping_address  JSONB,
  payer_id          TEXT,
  capture_id        TEXT,
  raw_payload       JSONB,                     -- last capture/webhook payload, for audit
  sold_marked       BOOLEAN NOT NULL DEFAULT FALSE,  -- true once admin clicks "Mark sold"
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT po_status_check
    CHECK (status IN ('created', 'approved', 'captured', 'failed', 'refunded', 'voided')),
  CONSTRAINT po_amount_positive
    CHECK (amount_cents > 0),
  CONSTRAINT po_currency_len
    CHECK (char_length(currency) <= 8),
  CONSTRAINT po_product_id_len
    CHECK (char_length(product_id) <= 64)
);

CREATE INDEX IF NOT EXISTS idx_po_product_status
  ON paypal_orders (product_id, status);
CREATE INDEX IF NOT EXISTS idx_po_status_captured_at
  ON paypal_orders (status, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_created_at
  ON paypal_orders (created_at DESC);

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION set_paypal_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paypal_orders_updated_at ON paypal_orders;
CREATE TRIGGER trg_paypal_orders_updated_at
  BEFORE UPDATE ON paypal_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_paypal_orders_updated_at();

-- =====================================================================
-- Row-Level Security
-- =====================================================================
-- No public access at all. Service-role only (admin reads + server
-- actions write). Webhook handler also uses service role.
-- =====================================================================

ALTER TABLE paypal_orders ENABLE ROW LEVEL SECURITY;

-- (No CREATE POLICY statements → anon / authenticated have no access by default.)
