-- =====================================================================
-- Migration: add 'flip_deck_claim' event type
-- =====================================================================
-- Run this in Supabase SQL editor after the earlier analytics-* migrations.
-- Idempotent — safe to re-run.
--
-- Fires when a visitor clicks "Claim →" on a face-up flip-deck card on
-- the homepage. Useful as a top-of-funnel signal: how many visitors
-- discover a relic via the deck mechanic vs. browsing /shop directly.
-- =====================================================================

ALTER TABLE product_events
  DROP CONSTRAINT IF EXISTS pe_event_type_check;
ALTER TABLE product_events
  ADD CONSTRAINT pe_event_type_check
  CHECK (event_type IN (
    'view',
    'depop_click',
    'depop_click_general',
    'mailto_click',
    'mailto_click_general',
    'image_zoom',
    'flip_deck_claim'
  ));
