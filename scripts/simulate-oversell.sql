-- =====================================================================
-- Oversell simulation — for sandbox testing of the Phase 2A flow.
-- =====================================================================
--
-- USAGE (two-tab dance):
--   1) Open /shop/r-01 on your deployed (or local) site in browser tab A.
--   2) Click "Buy with PayPal" — PayPal popup opens. DO NOT click Pay yet.
--   3) In Supabase SQL editor (browser tab B), run STEP 1 below.
--   4) Go back to tab A, complete the PayPal sandbox checkout.
--   5) Expected: buyer sees the yellow "So sorry — refund being processed" card.
--   6) Open /admin/orders — expect red oversell banner + the row.
--   7) Click "Open in PayPal Dashboard" + "Marked refunded" to test that path.
--   8) Run STEP 2 below to clean up the fake winner row + any test order rows.
--
-- The fake winner row stays only as long as you need it for the test.
-- =====================================================================


-- =====================================================================
-- STEP 1 — Pre-insert a fake "winner" captured row for r-01.
-- =====================================================================
-- This row makes the partial unique index reject any subsequent attempt to
-- mark a different paypal_orders row as captured for product_id='r-01' —
-- which is exactly the same DB error PostgreSQL would raise in a real
-- two-buyer race.
--
-- Change 'r-01' to whichever product you're testing against if needed.

INSERT INTO paypal_orders (
  id, product_id, amount_cents, currency, status,
  captured_at, capture_id, buyer_email, buyer_name
)
VALUES (
  'FAKE-WINNER-r01', 'r-01', 6800, 'USD', 'captured',
  NOW(), 'FAKE-CAP-r01', 'simulated-winner@test.local', 'Simulated Winner'
)
ON CONFLICT (id) DO UPDATE SET
  status = 'captured',
  captured_at = NOW();


-- =====================================================================
-- STEP 2 — Cleanup after the test.
-- =====================================================================
-- Removes the fake winner row AND any oversold/created rows from the
-- simulated race so the product is testable again.

DELETE FROM paypal_orders
WHERE id = 'FAKE-WINNER-r01'
   OR id LIKE 'FAKE-%'
   OR (product_id = 'r-01' AND status IN ('oversold', 'created'));

-- (Optional, if you want a fully fresh slate including your real captured
-- sandbox order — uncomment to also delete that. Do NOT run this against
-- a live database with real orders.)
-- DELETE FROM paypal_orders WHERE product_id = 'r-01';
