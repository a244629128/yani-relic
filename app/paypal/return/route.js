// PayPal redirects here after the buyer approves on PayPal.com (Safari
// redirect flow). Query: ?token=ORDER_ID&PayerID=...
//
// Route Handler (not a page) — cleaner pattern for "do a server-side
// side-effect then redirect" than a Server Component render that mixes
// Server Action calls + redirect(). The previous page.js version was
// throwing "Application error: a server-side exception" because of how
// Next.js 15 handles server-action calls + revalidatePath + redirect()
// during render.

import { NextResponse } from "next/server";
import { capturePayPalOrder, capturePayPalBundleOrder } from "@/lib/paypal-actions";
import { createAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/shop", url));
  }

  // Best-effort capture. If anything throws, log + still redirect to
  // /orders/thanks. The thanks page polls for the order via session-bound
  // auth and gracefully handles "not paid yet" / "wrong session" /
  // "not found" cases. The webhook is the durability backstop if our
  // synchronous capture failed.
  //
  // Bundle detection: paypal_orders.product_id IS NULL marks a bundle row
  // (see paypal-order-items.sql migration). Single-item rows keep the
  // per-product id + use capturePayPalOrder; bundles use the bundle
  // capture path which flips all pieces atomically.
  try {
    let isBundle = false;
    try {
      const sb = createAdminSupabase();
      const { data } = await sb
        .from("paypal_orders")
        .select("product_id")
        .eq("id", token)
        .maybeSingle();
      isBundle = data ? data.product_id === null : false;
    } catch (err) {
      console.error("[paypal/return] bundle detection lookup failed:", err);
    }
    if (isBundle) {
      await capturePayPalBundleOrder(token);
    } else {
      await capturePayPalOrder(token);
    }
  } catch (err) {
    console.error("[paypal/return] capture threw:", err);
  }

  return NextResponse.redirect(
    new URL(`/orders/thanks?o=${encodeURIComponent(token)}`, url)
  );
}
