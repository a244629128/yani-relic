-- =====================================================================
-- Add sale_price column to products
-- =====================================================================
-- Run this in the Supabase SQL editor (one-time setup, before using
-- the new Sale features in admin).
-- Idempotent: safe to re-run.
--
-- sale_price is NULL when an item isn't on sale. When set, it must be
-- > 0 and STRICTLY LESS THAN price (no "fake sales" or upcharges).
-- The percent-off badge shown on cards / product pages is computed
-- on the fly from (price, sale_price).
-- =====================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2);

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_sale_price_check;
ALTER TABLE products
  ADD CONSTRAINT products_sale_price_check
  CHECK (sale_price IS NULL OR (sale_price > 0 AND sale_price < price));
