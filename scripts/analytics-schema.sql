-- =====================================================================
-- product_events  —  anonymous engagement tracking
-- =====================================================================
-- Run this in the Supabase SQL editor (one-time setup).
--
-- Stores three kinds of low-cardinality events:
--   - 'view'         : modal/detail opened. duration_ms recorded on close.
--   - 'depop_click'  : "Buy on Depop" link clicked (purchase-intent proxy).
--   - 'image_zoom'   : fullscreen viewer opened (engaged-view proxy).
--
-- session_id is an anonymous UUID generated in the browser and stored in
-- localStorage. No PII. No third-party tracking.
-- =====================================================================

CREATE TABLE IF NOT EXISTS product_events (
  id           BIGSERIAL PRIMARY KEY,
  product_id   TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  duration_ms  INTEGER,
  session_id   TEXT,
  referrer     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Whitelist event_type so a misconfigured client can't write arbitrary strings.
  CONSTRAINT pe_event_type_check
    CHECK (event_type IN ('view', 'depop_click', 'image_zoom')),

  -- Cap any single dwell at 5 minutes (300000 ms). Anything longer is
  -- almost certainly an afk visitor; we treat dwell as directional, not truth.
  CONSTRAINT pe_duration_sane
    CHECK (duration_ms IS NULL OR (duration_ms >= 0 AND duration_ms <= 300000)),

  -- Tiny string-length guards so a bad client can't bloat the table.
  CONSTRAINT pe_product_id_len  CHECK (char_length(product_id) <= 64),
  CONSTRAINT pe_session_id_len  CHECK (session_id IS NULL OR char_length(session_id) <= 64),
  CONSTRAINT pe_referrer_len    CHECK (referrer IS NULL OR char_length(referrer) <= 512)
);

-- Indexes for the aggregation queries the admin dashboard runs.
CREATE INDEX IF NOT EXISTS idx_pe_product_created
  ON product_events (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pe_type_created
  ON product_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pe_created
  ON product_events (created_at DESC);

-- =====================================================================
-- Row-Level Security
-- =====================================================================
-- Writes: anyone with the anon key (i.e. any browser) can INSERT. The
--         CHECK constraint on event_type means they can't write garbage.
-- Reads:  no public access. Only the service-role key (used by the admin
--         dashboard server-side) can SELECT.
-- =====================================================================

ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_anon_insert" ON product_events;
CREATE POLICY "pe_anon_insert"
  ON product_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No SELECT, UPDATE, or DELETE policy → public can't read or modify anything.
-- Service role bypasses RLS, so admin reads still work.
