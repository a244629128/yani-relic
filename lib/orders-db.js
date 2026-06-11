// Server-side queries against paypal_orders for the admin dashboard.
// Uses service-role client (RLS denies anon access).

import { createAdminSupabase } from "@/lib/supabase";
import { getProducts } from "@/lib/products-db";

// Only the columns the admin UI actually renders. Skips raw_payload (the
// full PayPal capture response — heavy and contains PII we never display).
const ORDER_COLUMNS = [
  "id",
  "product_id",
  "amount_cents",
  "currency",
  "status",
  "buyer_email",
  "buyer_name",
  "shipping_address",
  "capture_id",
  "sold_marked",
  "created_at",
  "captured_at",
].join(", ");

export async function getRecentOrders({ limit = 100 } = {}) {
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("paypal_orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRecentOrders error:", error);
    return [];
  }

  // Join product name in JS (small product set, no need for SQL join).
  const products = await getProducts();
  const byId = new Map(products.map((p) => [p.id, p]));

  return (data || []).map((o) => ({
    ...o,
    productName: byId.get(o.product_id)?.name || o.product_id,
    productSold: byId.get(o.product_id)?.sold ?? null,
  }));
}

export async function getOrderCounts() {
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("paypal_orders")
    .select("status, product_id");
  if (error) {
    console.error("getOrderCounts error:", error);
    return { captured: 0, needsMarkSold: 0, refunded: 0, total: 0, oversold: 0 };
  }

  // Join with products to use the actual sold flag (Phase 2B auto-marks
  // it; sold_marked column on paypal_orders is now legacy admin tracking).
  const products = await getProducts();
  const soldByProductId = new Map(products.map((p) => [p.id, !!p.sold]));

  const rows = data || [];
  const capturedRows = rows.filter((r) => r.status === "captured");
  return {
    total: rows.length,
    captured: capturedRows.length,
    needsMarkSold: capturedRows.filter((r) => !soldByProductId.get(r.product_id)).length,
    refunded: rows.filter((r) => r.status === "refunded").length,
    oversold: rows.filter((r) => r.status === "oversold").length,
  };
}

export function formatAmount(cents, currency = "USD") {
  if (typeof cents !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatShippingAddress(addr) {
  if (!addr || typeof addr !== "object") return null;
  const a = addr.address || addr;
  const recipient = addr.name?.full_name || null;
  const lines = [
    a.address_line_1,
    a.address_line_2,
    [a.admin_area_2, a.admin_area_1, a.postal_code].filter(Boolean).join(", "),
    a.country_code,
  ].filter(Boolean);
  return { recipient, lines };
}
