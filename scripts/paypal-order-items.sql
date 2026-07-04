-- =====================================================================
-- paypal_order_items  —  line items for bundle (multi-piece) PayPal orders
-- =====================================================================
-- Introduced with the bundle-checkout feature. A single-item PayPal order
-- continues to use paypal_orders.product_id as before; bundle orders set
-- paypal_orders.product_id = NULL and record their line items here.
--
-- Run this in the Supabase SQL editor once. Idempotent — safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS paypal_order_items (
  order_id    TEXT NOT NULL
              REFERENCES paypal_orders(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  -- Snapshot the item price at time of order so historical accounting is
  -- correct even if the product's price changes later.
  price_cents INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, product_id),
  CONSTRAINT poi_price_positive
    CHECK (price_cents > 0),
  CONSTRAINT poi_product_id_len
    CHECK (char_length(product_id) <= 64)
);

-- Reverse lookup: "which orders included product X" — used by admin views,
-- oversell-check queries, and product-timeline pages.
CREATE INDEX IF NOT EXISTS idx_poi_product_id
  ON paypal_order_items (product_id);

-- Note on oversell protection: Postgres partial indexes cannot reference
-- another table, so we can't put a "unique product_id when parent is
-- captured" index on paypal_order_items directly. Instead, oversell
-- prevention relies on the products.sold column as the atomic gate:
-- capturePayPalBundleOrder does UPDATE products SET sold=true WHERE id
-- = ANY($1) AND sold=false RETURNING id; if the RETURNING count is less
-- than the bundle size, some other flow already flipped one of the
-- pieces, and we refund the entire PayPal order. The single-item
-- unique index (uq_po_one_captured_per_product) still catches the
-- same-flow-twice case. Together products.sold + the single-item unique
-- index cover cross-flow oversell.

-- =====================================================================
-- Row-Level Security
-- =====================================================================
-- Same posture as paypal_orders: service-role only. Public cannot see
-- other buyers' orders.
-- =====================================================================

ALTER TABLE paypal_order_items ENABLE ROW LEVEL SECURITY;

-- No CREATE POLICY: anon + authenticated have no access.

-- =====================================================================
-- Relax paypal_orders.product_id NOT NULL so bundle rows can have NULL
-- =====================================================================
-- Existing single-item flow still sets product_id. Bundle orders set it
-- NULL and rely on paypal_order_items instead. Admin reads should join
-- both to build the full picture.
-- =====================================================================

ALTER TABLE paypal_orders ALTER COLUMN product_id DROP NOT NULL;
