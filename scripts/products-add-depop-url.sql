-- =====================================================================
-- Add per-product depop_url column
-- =====================================================================
-- Run this in the Supabase SQL editor (one-time setup).
-- Idempotent: safe to re-run.
--
-- depop_url is nullable. When set, the product page uses it as the
-- destination for the "Shop on Depop" button. When null, the button
-- falls back to the site-wide URL in data/products.js.
--
-- Must be an https://www.depop.com or https://depop.com URL.
-- =====================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS depop_url TEXT;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_depop_url_check;
ALTER TABLE products
  ADD CONSTRAINT products_depop_url_check
  CHECK (
    depop_url IS NULL
    OR (
      char_length(depop_url) <= 512
      AND depop_url ~* '^https://(www\.)?depop\.com/'
    )
  );
