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

  // Fetch line items for bundle orders (product_id IS NULL). One query
  // covering all bundle orders in the page — small dataset, batch it.
  const bundleIds = (data || [])
    .filter((o) => o.product_id === null)
    .map((o) => o.id);
  const itemsByOrderId = new Map();
  if (bundleIds.length > 0) {
    const { data: items } = await sb
      .from("paypal_order_items")
      .select("order_id, product_id, price_cents")
      .in("order_id", bundleIds);
    for (const it of items || []) {
      if (!itemsByOrderId.has(it.order_id)) itemsByOrderId.set(it.order_id, []);
      itemsByOrderId.get(it.order_id).push({
        productId: it.product_id,
        priceCents: it.price_cents,
        productName: byId.get(it.product_id)?.name || it.product_id,
        productSold: byId.get(it.product_id)?.sold ?? null,
      });
    }
  }

  return (data || []).map((o) => {
    if (o.product_id === null) {
      // Bundle row.
      const items = itemsByOrderId.get(o.id) || [];
      // "All items sold" is the bundle's sold-marked state — used to decide
      // whether to surface any of the "not yet marked" nags.
      const allItemsSold =
        items.length > 0 && items.every((it) => it.productSold === true);
      return {
        ...o,
        isBundle: true,
        productName: `Bundle · ${items.length} ${items.length === 1 ? "piece" : "pieces"}`,
        productSold: allItemsSold,
        items,
      };
    }
    return {
      ...o,
      isBundle: false,
      productName: byId.get(o.product_id)?.name || o.product_id,
      productSold: byId.get(o.product_id)?.sold ?? null,
      items: null,
    };
  });
}

export async function getOrderCounts() {
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("paypal_orders")
    .select("id, status, product_id");
  if (error) {
    console.error("getOrderCounts error:", error);
    return { captured: 0, needsMarkSold: 0, refunded: 0, total: 0, oversold: 0 };
  }

  const products = await getProducts();
  const soldByProductId = new Map(products.map((p) => [p.id, !!p.sold]));

  const rows = data || [];
  const capturedRows = rows.filter((r) => r.status === "captured");

  // needsMarkSold: single-item captured rows where the product isn't sold
  // yet. Bundle captures do an atomic all-or-none flip, so we assume they
  // don't produce partial-sold states in practice. If a bundle capture
  // was interrupted mid-flip somehow, the products.sold field is still
  // the source of truth and admin can reconcile manually via PayPal
  // Dashboard.
  const singleNeedsMark = capturedRows.filter(
    (r) => r.product_id && !soldByProductId.get(r.product_id)
  );

  return {
    total: rows.length,
    captured: capturedRows.length,
    needsMarkSold: singleNeedsMark.length,
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
