-- =====================================================================
-- Migration: add 'oversold' to paypal_orders status whitelist
-- =====================================================================
-- Run this in Supabase SQL editor after the earlier paypal-* migrations.
-- Idempotent: safe to re-run.
--
-- 'oversold' is set when PayPal captured the buyer's money but our partial
-- unique index (uq_po_one_captured_per_product) rejected the captured
-- UPDATE because another captured row already exists for the same product.
-- These rows surface in the admin /orders page with a "refund manually"
-- banner. No auto-refund — owner refunds in PayPal Dashboard and clicks
-- "Marked refunded" to flip the row to 'refunded'.
-- =====================================================================

ALTER TABLE paypal_orders
  DROP CONSTRAINT IF EXISTS po_status_check;

ALTER TABLE paypal_orders
  ADD CONSTRAINT po_status_check
  CHECK (status IN (
    'created',
    'approved',
    'captured',
    'failed',
    'refunded',
    'voided',
    'oversold'
  ));
