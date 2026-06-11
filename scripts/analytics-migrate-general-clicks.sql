-- =====================================================================
-- Migration: add general (site-wide) Depop + mailto event types
-- =====================================================================
-- Run this in Supabase SQL editor if you've already run analytics-schema.sql.
-- (If running for the first time, just use analytics-schema.sql instead — it
--  contains the same final state.)
-- Idempotent: safe to re-run.
-- =====================================================================

-- General clicks aren't tied to a specific relic, so product_id is null
-- for those rows. Make the column nullable.
ALTER TABLE product_events ALTER COLUMN product_id DROP NOT NULL;

-- Replace the event_type whitelist with the latest set.
ALTER TABLE product_events DROP CONSTRAINT IF EXISTS pe_event_type_check;
ALTER TABLE product_events ADD CONSTRAINT pe_event_type_check
  CHECK (event_type IN (
    'view',
    'depop_click',
    'depop_click_general',
    'mailto_click',
    'mailto_click_general',
    'image_zoom'
  ));

-- Enforce the relationship: general clicks (depop OR mailto) have NULL
-- product_id; per-product events must have one.
ALTER TABLE product_events DROP CONSTRAINT IF EXISTS pe_general_no_product;
ALTER TABLE product_events ADD CONSTRAINT pe_general_no_product
  CHECK (
    (event_type IN ('depop_click_general', 'mailto_click_general') AND product_id IS NULL)
    OR (event_type NOT IN ('depop_click_general', 'mailto_click_general') AND product_id IS NOT NULL)
  );
