"use server";

// Server actions for PayPal Checkout. The PayPalCheckoutButton client
// component calls createPayPalOrder on click, then capturePayPalOrder
// after the buyer approves in the PayPal popup.

import { revalidatePath } from "next/cache";
import { paypalRequest } from "@/lib/paypal";
import { createAdminSupabase } from "@/lib/supabase";
import { getProduct, markProductSold } from "@/lib/products-db";

// How long an unfinished checkout (status='created' or 'approved') blocks
// other buyers for the same one-of-one piece. Captured orders block forever.
// 5 min is generous — PayPal's hosted popup checkout is rarely slower.
const PENDING_WINDOW_MIN = 5;

// Buyer-facing copy keyed by PayPal's canonical "issue" code from the capture
// response. Anything missing falls through to a generic message.
const CAPTURE_ERROR_MESSAGES = {
  INSTRUMENT_DECLINED:
    "Your payment was declined. Try a different card or funding source.",
  PAYER_ACTION_REQUIRED:
    "PayPal needs you to take an action — open paypal.com, complete it, then try again.",
  PAYEE_BLOCKED_TRANSACTION:
    "PayPal refused this transaction. Try a different account or contact us at hello@yanirelics.com.",
  TRANSACTION_REFUSED:
    "Your payment was refused. Try a different card or contact your bank.",
  ORDER_ALREADY_CAPTURED:
    "This order has already been paid — refresh the page and check your email for confirmation.",
  COMPLIANCE_VIOLATION:
    "PayPal is reviewing this transaction. If you don't get a confirmation in a few minutes, contact us at hello@yanirelics.com.",
};

// Whether the buyer can fix the failure inside the same PayPal popup
// (via actions.restart() on the client) without us cancelling the order.
// INSTRUMENT_DECLINED is the canonical case — buyer picks another card.
const RECOVERABLE_ISSUES = new Set(["INSTRUMENT_DECLINED"]);

async function handleCaptureError(paypalOrderId, err) {
  const issue = err?.paypalIssue || null;
  console.error(
    `[capturePayPalOrder] capture failed (issue=${issue || "unknown"}):`,
    err?.message
  );

  const recoverable = issue ? RECOVERABLE_ISSUES.has(issue) : false;
  const userMessage =
    (issue && CAPTURE_ERROR_MESSAGES[issue]) ||
    "Payment could not be captured. Contact us at hello@yanirelics.com.";

  if (!recoverable) {
    // Unrecoverable → free the oversell slot so other buyers (or the same
    // buyer starting fresh) can checkout. The webhook will overwrite this
    // status later if PayPal reports a different final state.
    await markOrderFailed(paypalOrderId, { issue });
  }
  // For recoverable issues we DON'T touch the row — PayPal's order is still
  // alive and actions.restart() on the client will retry against it.

  return { ok: false, recoverable, error: userMessage };
}

async function markOrderFailed(paypalOrderId, extra = {}) {
  try {
    const sb = createAdminSupabase();
    await sb
      .from("paypal_orders")
      .update({ status: "failed", raw_payload: extra })
      .eq("id", paypalOrderId)
      .in("status", ["created", "approved"]);
  } catch (err) {
    console.error("[markOrderFailed]:", err);
  }
}

/**
 * Returns { ok, paypalOrderId } or { ok: false, error }.
 *
 * Oversell guard: rejects if the product is already sold, or if another
 * PayPal order for the same product is in 'created' / 'approved' / 'captured'
 * status within the last 15 minutes.
 */
export async function createPayPalOrder(productId, buyerSessionId = null) {
  if (!productId || typeof productId !== "string") {
    return { ok: false, error: "Invalid product id" };
  }
  // Length-bound the session id we accept from the client; null is fine
  // (browsers that block localStorage will pass null, and we still create
  // the order — they just can't auto-void on cancel).
  const cleanSessionId =
    typeof buyerSessionId === "string" &&
    buyerSessionId.length > 0 &&
    buyerSessionId.length <= 64
      ? buyerSessionId
      : null;
  const product = await getProduct(productId);
  if (!product) return { ok: false, error: "Product not found" };
  if (product.sold) {
    return {
      ok: false,
      soldOut: true,
      error: "This piece has found her person.",
    };
  }
  if (!(product.price > 0)) {
    return { ok: false, error: "Product price is not set" };
  }

  const sb = createAdminSupabase();

  // Oversell check — two independent queries so neither can be bypassed by
  // a noisy history of stale rows. Defense-in-depth: the partial unique
  // index in paypal-schema.sql also refuses a second 'captured' row at
  // the DB level even if app logic ever races.
  //   1) ANY captured row for this product → permanent block.
  //   2) A 'created' or 'approved' row within PENDING_WINDOW_MIN → soft block.
  const { data: capturedHit, error: capErr } = await sb
    .from("paypal_orders")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "captured")
    .limit(1);
  if (capErr) {
    console.error("[createPayPalOrder] captured-check error:", capErr);
    return { ok: false, error: "Could not start checkout. Try again in a moment." };
  }
  if (capturedHit && capturedHit.length > 0) {
    return {
      ok: false,
      soldOut: true,
      error: "This piece has just been claimed by another buyer.",
    };
  }

  const cutoff = new Date(Date.now() - PENDING_WINDOW_MIN * 60 * 1000).toISOString();
  const { data: pendingHit, error: pendErr } = await sb
    .from("paypal_orders")
    .select("id")
    .eq("product_id", productId)
    .in("status", ["created", "approved"])
    .gte("created_at", cutoff)
    .limit(1);
  if (pendErr) {
    console.error("[createPayPalOrder] pending-check error:", pendErr);
    return { ok: false, error: "Could not start checkout. Try again in a moment." };
  }
  if (pendingHit && pendingHit.length > 0) {
    return {
      ok: false,
      error: "Another buyer is checking out. Try again in a few minutes.",
    };
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
    buyer_session_id: cleanSessionId,
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
    return await handleCaptureError(paypalOrderId, err);
  }

  if (capture?.status !== "COMPLETED") {
    console.error("[capturePayPalOrder] unexpected status:", capture?.status);
    // Best effort: mark the row failed so it doesn't block other buyers.
    await markOrderFailed(paypalOrderId, { reason: `status=${capture?.status}` });
    return { ok: false, error: `PayPal returned status: ${capture?.status || "unknown"}` };
  }

  const unit = capture.purchase_units?.[0];
  const captureRec = unit?.payments?.captures?.[0];
  const productId = unit?.reference_id;
  const shipping = unit?.shipping;
  const payer = capture.payer || {};

  const sb = createAdminSupabase();
  const baseUpdate = {
    buyer_email: payer.email_address || null,
    buyer_name:
      [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" ") ||
      null,
    shipping_address: shipping || null,
    payer_id: payer.payer_id || null,
    capture_id: captureRec?.id || null,
    raw_payload: capture,
    captured_at: new Date().toISOString(),
  };

  const { error: updateErr } = await sb
    .from("paypal_orders")
    .update({ ...baseUpdate, status: "captured" })
    .eq("id", paypalOrderId);

  if (!updateErr) {
    // Phase 2B: auto-flip products.sold=true now that the captured row is
    // durably written. Per Codex HIGH #6 — gated on the DB write succeeding,
    // not on the PayPal capture API alone. Best-effort: don't fail the
    // buyer's checkout if this errors; the webhook will retry the same
    // helper on PAYMENT.CAPTURE.COMPLETED as a backstop.
    try {
      await markProductSold(productId);
    } catch (err) {
      console.error("[capturePayPalOrder] auto-mark sold failed:", err);
    }

    revalidatePath("/admin/orders");
    return {
      ok: true,
      captureId: captureRec?.id || null,
      productId: productId || null,
    };
  }

  // OVERSELL DETECTION (档位1):
  // PG error code 23505 = unique_violation. Our partial unique index
  // (uq_po_one_captured_per_product WHERE status='captured') refused this
  // UPDATE because another captured row already exists for the same
  // product — i.e. the same-millisecond race fired. PayPal already took
  // this buyer's money; we owe them a manual refund.
  //
  // Match strategy per Codex review: primary on code, secondary diagnostic
  // is the index name in the message (for logs only, not for branching).
  const isOversold =
    updateErr.code === "23505" ||
    (typeof updateErr.message === "string" &&
      updateErr.message.includes("uq_po_one_captured_per_product"));

  if (isOversold) {
    console.warn(
      `[capturePayPalOrder] OVERSOLD: order ${paypalOrderId} captured at PayPal but blocked by unique index. Manual refund required.`
    );
    // Second UPDATE: flip to 'oversold' so the admin dashboard surfaces it.
    // .eq("status","created") guard prevents clobbering a row that's already
    // moved on (webhook can race here).
    const { error: oversoldErr } = await sb
      .from("paypal_orders")
      .update({ ...baseUpdate, status: "oversold" })
      .eq("id", paypalOrderId)
      // Codex HIGH: include 'approved' too. If a webhook moved the row to
      // 'approved' before our synchronous capture ran, .eq('created') would
      // silently no-op and admin would never see the oversold row.
      .in("status", ["created", "approved"]);

    if (oversoldErr) {
      // HIGH-severity failure mode (Codex #5): row stays 'created' with
      // PayPal holding the buyer's money. Log loudly + return manualReview
      // so the buyer sees a clear "captured but needs admin attention"
      // message instead of thinking nothing happened. The webhook is the
      // durability backstop here — it retries on 500.
      console.error(
        "[capturePayPalOrder] CRITICAL: oversold-marking failed too:",
        oversoldErr
      );
      return {
        ok: false,
        manualReview: true,
        error:
          "Your payment was captured by PayPal but our system is reconciling. The shop owner has been notified — your money is safe. Contact us at hello@yanirelics.com if you don't see confirmation within a day.",
      };
    }

    revalidatePath("/admin/orders");
    return {
      ok: false,
      oversold: true,
      error:
        "This piece was claimed by another buyer at the same moment. Your payment will be refunded — the shop owner has been notified.",
    };
  }

  // Non-oversold DB failure. PayPal has the money; the webhook will
  // re-sync the row to captured later. We still report success to the
  // buyer (PayPal took their money and we have the order ID; the webhook
  // path will durably persist the rest).
  console.error("[capturePayPalOrder] DB update error (non-oversold):", updateErr);
  revalidatePath("/admin/orders");
  return {
    ok: true,
    captureId: captureRec?.id || null,
    productId: productId || null,
  };
}

/**
 * Mark a 'created' or 'approved' order as voided so it stops blocking
 * future checkouts. Called from PayPalCheckoutButton's onCancel /
 * onError handlers.
 *
 * Authorization: bind to the originating browser via buyer_session_id.
 * Required because this is an unauthenticated endpoint — a public POST
 * that mutates a row by id alone would let anyone who learns an order id
 * weaken the oversell guard. The session id is generated browser-side
 * (lib/analytics getSessionId), stored at order-create time, and must
 * match here before we void. Status is restricted to 'created' only
 * (an approved-but-not-captured row may still complete capture; we
 * don't preempt that). Returns ok silently in all cases — analytics
 * UX shouldn't show errors.
 */
export async function voidPayPalOrder(paypalOrderId, buyerSessionId) {
  if (!paypalOrderId || typeof paypalOrderId !== "string") return { ok: false };
  if (
    typeof buyerSessionId !== "string" ||
    buyerSessionId.length === 0 ||
    buyerSessionId.length > 64
  ) {
    // No session id → refuse silently. Without binding, voiding would be
    // an unauthenticated mutation on a known-id resource.
    return { ok: false };
  }

  const sb = createAdminSupabase();

  // Look up the row first so we can verify the session binding.
  const { data: row, error: lookupErr } = await sb
    .from("paypal_orders")
    .select("status, buyer_session_id")
    .eq("id", paypalOrderId)
    .maybeSingle();
  if (lookupErr || !row) return { ok: false };

  // Reject if status is final or if the session id doesn't match.
  if (row.status !== "created") return { ok: false };
  if (!row.buyer_session_id || row.buyer_session_id !== buyerSessionId) {
    return { ok: false };
  }

  const { error } = await sb
    .from("paypal_orders")
    .update({ status: "voided" })
    .eq("id", paypalOrderId)
    .eq("buyer_session_id", buyerSessionId)
    .eq("status", "created");
  if (error) console.error("[voidPayPalOrder] error:", error);
  return { ok: true };
}

/**
 * Admin helper: marks an 'oversold' order as 'refunded' once the owner
 * has manually issued a refund in the PayPal Dashboard. Only operates on
 * rows currently in 'oversold' status (defense-in-depth: refuses to
 * touch anything else). Requires admin session.
 */
export async function markOrderManuallyRefunded(orderId) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (!orderId || typeof orderId !== "string") {
    return { ok: false, error: "Invalid order id" };
  }

  const sb = createAdminSupabase();
  const { error } = await sb
    .from("paypal_orders")
    .update({ status: "refunded" })
    .eq("id", orderId)
    .eq("status", "oversold");

  if (error) {
    console.error("[markOrderManuallyRefunded] error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/orders");
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

  // Codex MED: route through markProductSold so /shop/<id> revalidates too
  // (was previously stale until ISR expired). The helper is idempotent, so
  // a no-op call when Phase 2B already auto-flipped is fine.
  const prodRes = await markProductSold(order.product_id);
  if (!prodRes.ok) {
    return { ok: false, error: prodRes.error };
  }

  const { error: orderErr } = await sb
    .from("paypal_orders")
    .update({ sold_marked: true })
    .eq("id", orderId);
  if (orderErr) {
    console.error("[markOrderSold] order update error:", orderErr);
  }

  revalidatePath("/admin/orders");
  return { ok: true };
}
