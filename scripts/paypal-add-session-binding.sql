-- =====================================================================
-- Migration: bind paypal_orders to the buyer's browser session
-- =====================================================================
-- Run this in Supabase SQL editor if you've already run paypal-schema.sql.
-- Adds a buyer_session_id column so we can verify the same browser that
-- created an order is the one cancelling it.
-- Idempotent: safe to re-run.
-- =====================================================================

ALTER TABLE paypal_orders
  ADD COLUMN IF NOT EXISTS buyer_session_id TEXT;

ALTER TABLE paypal_orders
  DROP CONSTRAINT IF EXISTS po_buyer_session_id_len;
ALTER TABLE paypal_orders
  ADD CONSTRAINT po_buyer_session_id_len
  CHECK (buyer_session_id IS NULL OR char_length(buyer_session_id) <= 64);

-- Defense-in-depth: at most ONE captured order per product, ever. The
-- application also checks this in createPayPalOrder, but enforcing it
-- at the index level makes oversell structurally impossible.
CREATE UNIQUE INDEX IF NOT EXISTS uq_po_one_captured_per_product
  ON paypal_orders (product_id) WHERE status = 'captured';
