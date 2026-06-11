"use server";

// Server actions for PayPal Checkout. The PayPalCheckoutButton client
// component calls createPayPalOrder on click, then capturePayPalOrder
// after the buyer approves in the PayPal popup.

import { revalidatePath } from "next/cache";
import { paypalRequest } from "@/lib/paypal";
import { createAdminSupabase } from "@/lib/supabase";
import { getProduct } from "@/lib/products-db";

// How long an unfinished checkout (status='created' or 'approved') blocks
// other buyers for the same one-of-one piece. Captured orders block forever.
// 5 min is generous — PayPal's hosted popup checkout is rarely slower.
const PENDING_WINDOW_MIN = 5;

/**
 * Returns { ok, paypalOrderId } or { ok: false, error }.
 *
 * Oversell guard: rejects if the product is already sold, or if another
 * PayPal order for the same product is in 'created' / 'approved' / 'captured'
 * status within the last 15 minutes.
 */
export async function createPayPalOrder(productId) {
  if (!productId || typeof productId !== "string") {
    return { ok: false, error: "Invalid product id" };
  }
  const product = await getProduct(productId);
  if (!product) return { ok: false, error: "Product not found" };
  if (product.sold) return { ok: false, error: "This piece has found her person." };
  if (!(product.price > 0)) {
    return { ok: false, error: "Product price is not set" };
  }

  const sb = createAdminSupabase();

  // Oversell check — block parallel checkouts on the same one-of-one piece.
  //   captured: permanent block (until refund or admin clears)
  //   created/approved: only block if recent (within PENDING_WINDOW_MIN);
  //     older rows are treated as abandoned and don't block.
  const { data: existing, error: lookupErr } = await sb
    .from("paypal_orders")
    .select("status, created_at")
    .eq("product_id", productId)
    .in("status", ["created", "approved", "captured"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (lookupErr) {
    console.error("[createPayPalOrder] lookup error:", lookupErr);
    return { ok: false, error: "Could not start checkout. Try again in a moment." };
  }
  if (existing && existing.length > 0) {
    const captured = existing.find((r) => r.status === "captured");
    if (captured) {
      return { ok: false, error: "This piece has just been claimed by another buyer." };
    }
    const cutoff = Date.now() - PENDING_WINDOW_MIN * 60 * 1000;
    const pending = existing.find(
      (r) =>
        (r.status === "created" || r.status === "approved") &&
        new Date(r.created_at).getTime() > cutoff
    );
    if (pending) {
      return {
        ok: false,
        error: "Another buyer is checking out. Try again in a few minutes.",
      };
    }
  }

  // Create the order at PayPal.
  let paypalOrder;
  try {
    paypalOrder = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: productId,
            description: `${product.name} — Yani Relics`,
            amount: {
              currency_code: product.currency || "USD",
              value: Number(product.price).toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "Yani Relics",
          shipping_preference: "GET_FROM_FILE",
          user_action: "PAY_NOW",
        },
      },
    });
  } catch (err) {
    console.error("[createPayPalOrder] PayPal API error:", err);
    return { ok: false, error: "PayPal could not start the order. Try again." };
  }

  if (!paypalOrder?.id) {
    return { ok: false, error: "PayPal did not return an order id." };
  }

  // Persist a placeholder row so the oversell check sees this in-flight order.
  const { error: insertErr } = await sb.from("paypal_orders").insert({
    id: paypalOrder.id,
    product_id: productId,
    amount_cents: Math.round(Number(product.price) * 100),
    currency: product.currency || "USD",
    status: "created",
  });
  if (insertErr) {
    console.error("[createPayPalOrder] insert error:", insertErr);
    // Don't fail the buyer here — PayPal already has the order, and the webhook
    // will eventually catch capture. Surface a soft warning.
  }

  return { ok: true, paypalOrderId: paypalOrder.id };
}

/**
 * Captures an approved PayPal order. Called from PayPalCheckoutButton's
 * onApprove handler. Returns { ok, captureId, productId } or { ok: false, error }.
 */
export async function capturePayPalOrder(paypalOrderId) {
  if (!paypalOrderId || typeof paypalOrderId !== "string") {
    return { ok: false, error: "Invalid order id" };
  }

  let capture;
  try {
    capture = await paypalRequest(
      `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      { method: "POST", body: {} }
    );
  } catch (err) {
    console.error("[capturePayPalOrder] PayPal capture failed:", err);
    return { ok: false, error: "Payment could not be captured. Contact us." };
  }

  if (capture?.status !== "COMPLETED") {
    console.error("[capturePayPalOrder] unexpected status:", capture?.status);
    return { ok: false, error: `PayPal returned status: ${capture?.status || "unknown"}` };
  }

  const unit = capture.purchase_units?.[0];
  const captureRec = unit?.payments?.captures?.[0];
  const productId = unit?.reference_id;
  const shipping = unit?.shipping;
  const payer = capture.payer || {};

  const sb = createAdminSupabase();
  const { error: updateErr } = await sb
    .from("paypal_orders")
    .update({
      status: "captured",
      buyer_email: payer.email_address || null,
      buyer_name:
        [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" ") ||
        null,
      shipping_address: shipping || null,
      payer_id: payer.payer_id || null,
      capture_id: captureRec?.id || null,
      raw_payload: capture,
      captured_at: new Date().toISOString(),
    })
    .eq("id", paypalOrderId);

  if (updateErr) {
    console.error("[capturePayPalOrder] DB update error:", updateErr);
    // PayPal has the money — fail soft, log, and the webhook will re-sync.
  }

  revalidatePath("/admin/orders");
  return {
    ok: true,
    captureId: captureRec?.id || null,
    productId: productId || null,
  };
}

/**
 * Mark a 'created' or 'approved' order as voided so it stops blocking
 * future checkouts. Called from PayPalCheckoutButton's onCancel and
 * onError handlers — no auth required because we identify the order
 * by its PayPal-generated id (unguessable) and only update non-final
 * rows. Returns silently on any anomaly so it never affects the UX.
 */
export async function voidPayPalOrder(paypalOrderId) {
  if (!paypalOrderId || typeof paypalOrderId !== "string") return { ok: false };
  const sb = createAdminSupabase();
  // Only void rows we created ourselves and that aren't yet captured.
  const { error } = await sb
    .from("paypal_orders")
    .update({ status: "voided" })
    .eq("id", paypalOrderId)
    .in("status", ["created", "approved"]);
  if (error) console.error("[voidPayPalOrder] error:", error);
  return { ok: true };
}

/**
 * Admin helper: flips a product to sold=true and marks the originating
 * PayPal order as sold_marked. Atomically-ish (sequential calls; we accept
 * the small window since auto-sold is deliberately deferred).
 */
export async function markOrderSold(orderId) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (!orderId || typeof orderId !== "string") {
    return { ok: false, error: "Invalid order id" };
  }

  const sb = createAdminSupabase();

  const { data: order, error: lookupErr } = await sb
    .from("paypal_orders")
    .select("product_id, sold_marked")
    .eq("id", orderId)
    .single();
  if (lookupErr || !order) {
    return { ok: false, error: lookupErr?.message || "Order not found" };
  }
  if (order.sold_marked) {
    return { ok: true, alreadyMarked: true };
  }

  const { error: prodErr } = await sb
    .from("products")
    .update({ sold: true })
    .eq("id", order.product_id);
  if (prodErr) {
    console.error("[markOrderSold] product update error:", prodErr);
    return { ok: false, error: prodErr.message };
  }

  const { error: orderErr } = await sb
    .from("paypal_orders")
    .update({ sold_marked: true })
    .eq("id", orderId);
  if (orderErr) {
    console.error("[markOrderSold] order update error:", orderErr);
  }

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  return { ok: true };
}
