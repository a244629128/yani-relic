"use server";

// Server actions for PayPal Checkout. The PayPalCheckoutButton client
// component calls createPayPalOrder on click, then capturePayPalOrder
// after the buyer approves in the PayPal popup.

import { revalidatePath } from "next/cache";
import { paypalRequest } from "@/lib/paypal";
import { createAdminSupabase } from "@/lib/supabase";
import {
  getProduct,
  getProductsByIds,
  markProductSold,
  markProductAvailable,
} from "@/lib/products-db";
import { SHIPPING_FEE_USD, calculateShipping } from "@/data/products";

// How long an unfinished checkout (status='created' or 'approved') blocks
// other buyers for the same one-of-one piece. Captured orders block forever.
// 3 min: balances "give the real buyer enough time to finish PayPal" with
// "if they abandon, don't make other buyers wait too long." The buyer who
// hits the lock sees a live countdown so they know exactly how long to wait.
const PENDING_WINDOW_MIN = 3;

function siteOrigin() {
  // NEXT_PUBLIC_SITE_URL is the source of truth (set in Vercel env vars).
  // Fallback is the custom domain. The previous .vercel.app fallback was
  // for pre-custom-domain testing.
  return process.env.NEXT_PUBLIC_SITE_URL || "https://yanirelics.com";
}

// Buyer-facing copy keyed by PayPal's canonical "issue" code from the capture
// response. Anything missing falls through to a generic message.
const CAPTURE_ERROR_MESSAGES = {
  INSTRUMENT_DECLINED:
    "Your payment was declined. Try a different card or funding source.",
  PAYER_ACTION_REQUIRED:
    "PayPal needs you to take an action — open paypal.com, complete it, then try again.",
  PAYEE_BLOCKED_TRANSACTION:
    "PayPal refused this transaction. Try a different account or contact us at yanirelics@gmail.com.",
  TRANSACTION_REFUSED:
    "Your payment was refused. Try a different card or contact your bank.",
  ORDER_ALREADY_CAPTURED:
    "This order has already been paid — refresh the page and check your email for confirmation.",
  COMPLIANCE_VIOLATION:
    "PayPal is reviewing this transaction. If you don't get a confirmation in a few minutes, contact us at yanirelics@gmail.com.",
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
    "Payment could not be captured. Contact us at yanirelics@gmail.com.";

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

  // STEP 1: does THIS browser session already have an order for this
  // product? If captured/oversold/refunded, the buyer thinks they're
  // making a new purchase but they're really revisiting an existing
  // one. Route them to their thanks page instead of trying to charge
  // them again.
  if (cleanSessionId) {
    const { data: mySessionRecent } = await sb
      .from("paypal_orders")
      .select("id, status")
      .eq("product_id", productId)
      .eq("buyer_session_id", cleanSessionId)
      .in("status", ["captured", "oversold", "refunded"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (mySessionRecent && mySessionRecent.length > 0) {
      return {
        ok: false,
        alreadyBought: true,
        orderId: mySessionRecent[0].id,
        error: "You already paid for this relic. Taking you to your confirmation…",
      };
    }
  }

  // STEP 2: ANY captured row for this product (by someone else) →
  // permanent block. The DB unique index also prevents two captured
  // rows from existing simultaneously as a safety net.
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
    .select("id, buyer_session_id, status, created_at")
    .eq("product_id", productId)
    .in("status", ["created", "approved"])
    .gte("created_at", cutoff)
    .limit(1);
  if (pendErr) {
    console.error("[createPayPalOrder] pending-check error:", pendErr);
    return { ok: false, error: "Could not start checkout. Try again in a moment." };
  }
  if (pendingHit && pendingHit.length > 0) {
    const pending = pendingHit[0];
    // Same buyer retrying after bailing from PayPal (e.g., clicked PayPal
    // → opened approval page → hit Back → refreshed → clicked PayPal
    // again). The stale 'created' row would otherwise block them with a
    // confusing "another buyer is checking out" message. Detect same-
    // session ownership and void the stale row so they can continue.
    const isSameBuyer =
      !!cleanSessionId &&
      pending.buyer_session_id === cleanSessionId &&
      pending.status === "created";
    if (isSameBuyer) {
      await sb
        .from("paypal_orders")
        .update({ status: "voided" })
        .eq("id", pending.id)
        .eq("buyer_session_id", cleanSessionId)
        .eq("status", "created");
      // fall through to create a fresh order
    } else {
      // Compute seconds until the lock expires so the client can show
      // an honest countdown instead of a vague "try again later" message.
      const lockExpiresAt =
        new Date(pending.created_at).getTime() + PENDING_WINDOW_MIN * 60 * 1000;
      const secondsRemaining = Math.max(
        0,
        Math.ceil((lockExpiresAt - Date.now()) / 1000)
      );
      return {
        ok: false,
        locked: true,
        secondsRemaining,
        error: "Another buyer is checking out right now.",
      };
    }
  }

  // Create the order at PayPal.
  // Use sale price if set — the buyer pays the on-sale amount, not the
  // original list price. effectivePrice is computed in rowToProduct.
  const itemAmount = Number(product.effectivePrice || product.price);
  const shippingFee = calculateShipping(itemAmount);
  const chargeAmount = itemAmount + shippingFee;
  const currency = product.currency || "USD";
  const asciiName = product.name.replace(/[^\x20-\x7E]/g, "");

  let paypalOrder;
  try {
    paypalOrder = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: productId,
            // ASCII-safe description per Codex review — em-dash (—) is a
            // credible suspect for PayPal VALIDATION_ERROR. PayPal's field
            // character allowance for description isn't well-documented;
            // sticking to ASCII removes the variable.
            description: `${asciiName} - Yani Relics`,
            amount: {
              currency_code: currency,
              value: chargeAmount.toFixed(2),
              // Breakdown lets PayPal show buyers the item + shipping split
              // in its own checkout overlay. item_total + shipping must
              // equal the top-level value exactly, or PayPal 422s. When
              // shipping is free we still include it as "0.00" so PayPal
              // shows a clean "Shipping: $0.00" line in its overlay.
              breakdown: {
                item_total: { currency_code: currency, value: itemAmount.toFixed(2) },
                shipping:   { currency_code: currency, value: shippingFee.toFixed(2) },
              },
            },
            items: [
              {
                // PayPal caps item name at 127 chars; ours are much shorter
                // but slice defensively in case a future product is verbose.
                name: asciiName.slice(0, 127),
                quantity: "1",
                unit_amount: { currency_code: currency, value: itemAmount.toFixed(2) },
                category: "PHYSICAL_GOODS",
              },
            ],
          },
        ],
        application_context: {
          brand_name: "Yani Relics",
          shipping_preference: "GET_FROM_FILE",
          user_action: "PAY_NOW",
          // Used by the iOS Safari redirect flow (popup is blocked when
          // we awaited createPayPalOrder). Smart Button popup ignores
          // these. /paypal/return captures + redirects to /orders/thanks;
          // /paypal/cancel redirects back to the product page.
          return_url: `${siteOrigin()}/paypal/return`,
          cancel_url: `${siteOrigin()}/paypal/cancel?p=${encodeURIComponent(productId)}`,
        },
      },
    });
  } catch (err) {
    // Log everything PayPal told us so we can debug in server logs.
    console.error("[createPayPalOrder] PayPal API error:", {
      message: err?.message,
      paypalStatus: err?.paypalStatus,
      paypalIssue: err?.paypalIssue,
      paypalBody: err?.paypalBody,
    });
    // Surface a slightly more specific error to the buyer when we can
    // tell it's not a transient issue. Otherwise generic retry message.
    const issue = err?.paypalIssue;
    if (issue === "PERMISSION_DENIED" || err?.paypalStatus === 401) {
      return {
        ok: false,
        error: "Payment system is misconfigured. Please contact us at yanirelics@gmail.com.",
      };
    }
    if (issue === "VALIDATION_ERROR" || err?.paypalStatus === 400 || err?.paypalStatus === 422) {
      return {
        ok: false,
        error: "PayPal rejected the order details. Contact us at yanirelics@gmail.com.",
      };
    }
    return { ok: false, error: "PayPal could not start the order. Try again in a moment." };
  }

  if (!paypalOrder?.id) {
    return { ok: false, error: "PayPal did not return an order id." };
  }

  // approveUrl is the PayPal-hosted page where the buyer logs in + approves.
  // The popup SDK uses this internally; we surface it so the Safari redirect
  // flow can window.location.href = approveUrl directly (no popup needed,
  // no user-gesture-token-required).
  const approveUrl =
    Array.isArray(paypalOrder.links)
      ? paypalOrder.links.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href
      : null;

  // Persist a placeholder row so the oversell check sees this in-flight order.
  const { error: insertErr } = await sb.from("paypal_orders").insert({
    id: paypalOrder.id,
    product_id: productId,
    amount_cents: Math.round(chargeAmount * 100),
    currency: product.currency || "USD",
    status: "created",
    buyer_session_id: cleanSessionId,
  });
  if (insertErr) {
    console.error("[createPayPalOrder] insert error:", insertErr);
    // Don't fail the buyer here — PayPal already has the order, and the webhook
    // will eventually catch capture. Surface a soft warning.
  }

  return { ok: true, paypalOrderId: paypalOrder.id, approveUrl };
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
    // Codex: bundle sold_marked into the same UPDATE so the admin tracking
    // flag stays consistent with the product-side auto-mark in markProductSold.
    // Atomic with the status change; no separate query.
    .update({ ...baseUpdate, status: "captured", sold_marked: true })
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
          "Your payment was captured by PayPal but our system is reconciling. The shop owner has been notified — your money is safe. Contact us at yanirelics@gmail.com if you don't see confirmation within a day.",
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
 * Buyer-facing read of their own PayPal order. NOT admin-gated — auth
 * is by matching the buyer_session_id stored at create-time against the
 * sessionId the client passes from localStorage. Without a session
 * match, returns 'wrong_session' so the success page can show a
 * helpful message instead of leaking buyer info.
 *
 * Returns:
 *   { ok: true, order, product }
 *   { ok: false, error: 'missing' | 'not_found' | 'wrong_session' | 'not_paid' }
 */
export async function getOrderForBuyer(orderId, sessionId) {
  if (typeof orderId !== "string" || orderId.length === 0 || orderId.length > 64) {
    return { ok: false, error: "missing" };
  }
  if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 64) {
    return { ok: false, error: "missing" };
  }

  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("paypal_orders")
    .select(
      "id, product_id, amount_cents, currency, status, buyer_email, buyer_name, shipping_address, capture_id, captured_at, buyer_session_id, created_at"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[getOrderForBuyer] lookup error:", error);
    return { ok: false, error: "not_found" };
  }
  if (!data) return { ok: false, error: "not_found" };
  if (data.buyer_session_id !== sessionId) {
    return { ok: false, error: "wrong_session" };
  }
  // Only render the thanks page for terminal-positive states. Created /
  // approved / voided / failed don't deserve a celebration.
  if (!["captured", "oversold", "refunded"].includes(data.status)) {
    return { ok: false, error: "not_paid" };
  }

  // Resolve the products this order contained. Two shapes:
  //   - Single-item: paypal_orders.product_id is set → one product.
  //   - Bundle:      paypal_orders.product_id is NULL → paypal_order_items
  //                  holds the line items.
  let products = [];
  if (data.product_id) {
    const single = await getProduct(data.product_id);
    if (single) products = [single];
  } else {
    const itemIds = await getBundleProductIds(orderId);
    if (itemIds.length > 0) {
      products = await getProductsByIds(itemIds);
    }
  }

  // Strip the buyer_session_id before returning — client doesn't need it.
  const { buyer_session_id: _bs, ...orderOut } = data;
  return {
    ok: true,
    order: orderOut,
    // Back-compat for the existing single-item ThanksClient.SuccessView:
    // pass the first product as `product`. Bundle-aware UIs can iterate
    // `products` for the full list.
    product: products[0] || null,
    products,
    isBundle: !data.product_id,
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
 * Inverse of markOrderSold — admin clicks "Mark unsold" on an order when
 * they need to re-list the product (e.g. refund issued, fulfillment fell
 * through). Flips product.sold = false AND clears the order's sold_marked
 * flag. Auth-gated.
 */
export async function markOrderUnsold(orderId) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (!orderId || typeof orderId !== "string") {
    return { ok: false, error: "Invalid order id" };
  }

  const sb = createAdminSupabase();
  const { data: order, error: lookupErr } = await sb
    .from("paypal_orders")
    .select("product_id")
    .eq("id", orderId)
    .single();
  if (lookupErr || !order) {
    return { ok: false, error: lookupErr?.message || "Order not found" };
  }

  const prodRes = await markProductAvailable(order.product_id);
  if (!prodRes.ok) {
    return { ok: false, error: prodRes.error };
  }

  // Also clear the order's sold_marked tracking flag, if it was set.
  const { error: orderErr } = await sb
    .from("paypal_orders")
    .update({ sold_marked: false })
    .eq("id", orderId);
  if (orderErr) {
    console.error("[markOrderUnsold] order update error:", orderErr);
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

  // Defense-in-depth: only flip sold_marked when the order is actually
  // captured. The UI button gates this too, but the server enforces it
  // so a misclick on a refunded/oversold/voided row can't corrupt the
  // tracking flag.
  const { error: orderErr } = await sb
    .from("paypal_orders")
    .update({ sold_marked: true })
    .eq("id", orderId)
    .eq("status", "captured");
  if (orderErr) {
    console.error("[markOrderSold] order update error:", orderErr);
  }

  revalidatePath("/admin/orders");
  return { ok: true };
}

// ============================================================================
// BUNDLE CHECKOUT — multi-item PayPal orders
// ============================================================================
// A single-item purchase still uses createPayPalOrder + capturePayPalOrder
// above (unchanged). Bundles use the two functions below, plus the
// paypal_order_items table (see scripts/paypal-order-items.sql).
//
// Design invariants (per Codex review):
//   1. Bundle rows in paypal_orders have product_id = NULL. All line items
//      live in paypal_order_items, keyed by order_id.
//   2. Oversell is caught in three layers: page load, button click, capture.
//   3. Capture uses an atomic all-or-none products UPDATE (WHERE id=ANY AND
//      sold=false RETURNING id). If the RETURNING count < bundle size,
//      another flow already flipped a piece; we refund the ENTIRE PayPal
//      order (partial refund would be complex + user-hostile).
//   4. Bundle size is capped at MAX_BUNDLE_SIZE_SERVER (10).
// ============================================================================

const MAX_BUNDLE_SIZE_SERVER = 10;

/**
 * Creates a bundle PayPal order for N products. Returns:
 *   { ok: true, paypalOrderId, approveUrl }
 *   { ok: false, error, unavailableIds? }
 *
 * On unavailability (any product sold or blocked by pending window), returns
 * unavailableIds so the /checkout page can auto-remove those items and let
 * the buyer retry with the rest.
 */
export async function createPayPalBundleOrder(productIds, buyerSessionId = null) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { ok: false, error: "No pieces selected." };
  }
  if (productIds.length > MAX_BUNDLE_SIZE_SERVER) {
    return { ok: false, error: `Bundle size is capped at ${MAX_BUNDLE_SIZE_SERVER} pieces.` };
  }
  const cleanIds = Array.from(
    new Set(
      productIds.filter((v) => typeof v === "string" && v.length > 0 && v.length <= 64)
    )
  );
  if (cleanIds.length === 0) {
    return { ok: false, error: "Invalid product ids." };
  }

  const cleanSessionId =
    typeof buyerSessionId === "string" && buyerSessionId.length > 0 && buyerSessionId.length <= 64
      ? buyerSessionId
      : null;

  const sb = createAdminSupabase();

  // Fetch products, verify all present + all unsold.
  const { data: rows, error: fetchErr } = await sb
    .from("products")
    .select("id, name, price, sale_price, currency, sold")
    .in("id", cleanIds);

  if (fetchErr) {
    console.error("[createPayPalBundleOrder] product fetch error:", fetchErr);
    return { ok: false, error: "Could not verify the pieces you selected. Try again." };
  }

  const productsById = new Map((rows || []).map((r) => [r.id, r]));
  const missing = cleanIds.filter((id) => !productsById.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      error: "One or more pieces are no longer available. Review your selection.",
      unavailableIds: missing,
    };
  }
  const soldIds = cleanIds.filter((id) => productsById.get(id).sold);
  if (soldIds.length > 0) {
    return {
      ok: false,
      error:
        soldIds.length === 1
          ? "One piece was sold before checkout — please review your selection."
          : `${soldIds.length} pieces were sold before checkout — please review your selection.`,
      unavailableIds: soldIds,
    };
  }

  // Oversell check: are any of these pieces in an active pending order?
  // Look at both single-item flow (paypal_orders.product_id) and bundle
  // flow (paypal_order_items joined via order_id). We consider a row
  // "active" if it's in status created/approved AND its parent order was
  // created within the pending window.
  const pendingCutoff = new Date(
    Date.now() - PENDING_WINDOW_MIN * 60 * 1000
  ).toISOString();

  const { data: singlePending, error: singleErr } = await sb
    .from("paypal_orders")
    .select("product_id, buyer_session_id, status")
    .in("product_id", cleanIds)
    .in("status", ["created", "approved"])
    .gt("created_at", pendingCutoff);
  if (singleErr) {
    console.error("[createPayPalBundleOrder] single pending check error:", singleErr);
  }

  const { data: singleCaptured } = await sb
    .from("paypal_orders")
    .select("product_id")
    .in("product_id", cleanIds)
    .eq("status", "captured");

  // Bundle pending items blocking any of our targets. Two-step because
  // Supabase JS doesn't do JOINs — fetch active pending bundle orders
  // (with session id so we can distinguish this buyer from others),
  // then look up items whose order_id is in that set.
  const { data: pendingBundleOrders } = await sb
    .from("paypal_orders")
    .select("id, buyer_session_id, status")
    .is("product_id", null)
    .in("status", ["created", "approved"])
    .gt("created_at", pendingCutoff);

  // Split same-buyer (to void) from other-buyer (blocks us). Same-buyer
  // handling mirrors the single-item flow — a buyer clicking PayPal, bailing,
  // then retrying should NOT be blocked by their own stale pending row.
  const sameBuyerBundleIds = [];
  const otherBuyerBundleIds = [];
  for (const o of pendingBundleOrders || []) {
    if (
      cleanSessionId &&
      o.buyer_session_id === cleanSessionId &&
      o.status === "created"
    ) {
      sameBuyerBundleIds.push(o.id);
    } else {
      otherBuyerBundleIds.push(o.id);
    }
  }

  // Void the buyer's own stale pending bundles so they stop looking like
  // an active checkout. Items stay in paypal_order_items (their status is
  // implied by parent.status="voided", which our pending checks exclude).
  if (sameBuyerBundleIds.length > 0) {
    await sb
      .from("paypal_orders")
      .update({ status: "voided" })
      .in("id", sameBuyerBundleIds)
      .eq("status", "created");
  }

  let bundlePending = [];
  if (otherBuyerBundleIds.length > 0) {
    const { data: items } = await sb
      .from("paypal_order_items")
      .select("product_id, order_id")
      .in("order_id", otherBuyerBundleIds)
      .in("product_id", cleanIds);
    bundlePending = items || [];
  }

  const blockedIds = new Set([
    // Same buyer? Allow — they're re-entering their own checkout. Matches
    // the same-buyer-retry behavior in createPayPalOrder.
    ...(singlePending || [])
      .filter((row) => row.buyer_session_id !== cleanSessionId)
      .map((row) => row.product_id),
    ...(singleCaptured || []).map((row) => row.product_id),
    ...bundlePending.map((row) => row.product_id),
  ]);

  if (blockedIds.size > 0) {
    const blocked = Array.from(blockedIds);
    return {
      ok: false,
      error:
        blocked.length === 1
          ? "One piece is being checked out by another buyer right now — please retry in a few minutes or remove it."
          : `${blocked.length} pieces are being checked out by other buyers — please retry in a few minutes or remove them.`,
      unavailableIds: blocked,
    };
  }

  // Build the PayPal Orders v2 request.
  const currency = productsById.get(cleanIds[0]).currency || "USD";
  const items = cleanIds.map((id) => {
    const p = productsById.get(id);
    const effective = p.sale_price != null && Number(p.sale_price) < Number(p.price)
      ? Number(p.sale_price)
      : Number(p.price);
    return {
      id,
      name: (p.name || "").replace(/[^\x20-\x7E]/g, "").slice(0, 127),
      unitAmount: effective,
    };
  });
  const itemTotal = items.reduce((sum, it) => sum + it.unitAmount, 0);
  const bundleShipping = calculateShipping(itemTotal);
  const bundleTotal = itemTotal + bundleShipping;

  let paypalOrder;
  try {
    paypalOrder = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: `${cleanIds[0]}-bundle`,
            description: `Yani Relics - ${items.length} pieces`,
            amount: {
              currency_code: currency,
              value: bundleTotal.toFixed(2),
              breakdown: {
                item_total: { currency_code: currency, value: itemTotal.toFixed(2) },
                shipping:   { currency_code: currency, value: bundleShipping.toFixed(2) },
              },
            },
            items: items.map((it) => ({
              name: it.name,
              quantity: "1",
              unit_amount: { currency_code: currency, value: it.unitAmount.toFixed(2) },
              category: "PHYSICAL_GOODS",
              sku: it.id,
            })),
          },
        ],
        application_context: {
          brand_name: "Yani Relics",
          shipping_preference: "GET_FROM_FILE",
          user_action: "PAY_NOW",
          return_url: `${siteOrigin()}/paypal/return`,
          cancel_url: `${siteOrigin()}/paypal/cancel?p=bundle`,
        },
      },
    });
  } catch (err) {
    console.error("[createPayPalBundleOrder] PayPal API error:", {
      message: err?.message,
      paypalStatus: err?.paypalStatus,
      paypalIssue: err?.paypalIssue,
    });
    return { ok: false, error: "PayPal could not start the order. Try again in a moment." };
  }

  if (!paypalOrder?.id) {
    return { ok: false, error: "PayPal did not return an order id." };
  }

  const approveUrl = Array.isArray(paypalOrder.links)
    ? paypalOrder.links.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href
    : null;

  // Persist header + line items. Two-step insert. Header first (needed for
  // the FK). If line-item insert fails, delete the header to avoid dangling
  // rows that would confuse pending checks.
  const { error: insertErr } = await sb.from("paypal_orders").insert({
    id: paypalOrder.id,
    product_id: null, // bundle marker
    amount_cents: Math.round(bundleTotal * 100),
    currency,
    status: "created",
    buyer_session_id: cleanSessionId,
  });
  if (insertErr) {
    console.error("[createPayPalBundleOrder] header insert error:", insertErr);
    return { ok: false, error: "Could not record the order. Contact yanirelics@gmail.com." };
  }

  const itemRows = items.map((it) => ({
    order_id: paypalOrder.id,
    product_id: it.id,
    price_cents: Math.round(it.unitAmount * 100),
  }));
  const { error: itemsErr } = await sb.from("paypal_order_items").insert(itemRows);
  if (itemsErr) {
    console.error("[createPayPalBundleOrder] items insert error:", itemsErr);
    await sb.from("paypal_orders").delete().eq("id", paypalOrder.id);
    return { ok: false, error: "Could not record the order. Contact yanirelics@gmail.com." };
  }

  return { ok: true, paypalOrderId: paypalOrder.id, approveUrl };
}

/**
 * Captures a bundle PayPal order. Returns:
 *   { ok: true, captureId, productIds }
 *   { ok: false, error, oversold?: true, manualReview?: true }
 *
 * The atomic all-or-none products UPDATE is the source of truth for
 * oversell prevention: if fewer products were flipped to sold than we
 * expected, some other flow already took one, and we refund the entire
 * PayPal capture.
 */
export async function capturePayPalBundleOrder(paypalOrderId) {
  if (!paypalOrderId || typeof paypalOrderId !== "string") {
    return { ok: false, error: "Invalid order id" };
  }

  const sb = createAdminSupabase();

  const { data: itemRows, error: itemsErr } = await sb
    .from("paypal_order_items")
    .select("product_id")
    .eq("order_id", paypalOrderId);
  if (itemsErr || !itemRows || itemRows.length === 0) {
    console.error("[capturePayPalBundleOrder] items lookup failed:", itemsErr);
    return { ok: false, error: "Could not find the bundle's line items." };
  }
  const bundleProductIds = itemRows.map((r) => r.product_id);

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
    console.error("[capturePayPalBundleOrder] unexpected status:", capture?.status);
    await markOrderFailed(paypalOrderId, { reason: `status=${capture?.status}` });
    return { ok: false, error: `PayPal returned status: ${capture?.status || "unknown"}` };
  }

  const unit = capture.purchase_units?.[0];
  const captureRec = unit?.payments?.captures?.[0];
  const shipping = unit?.shipping;
  const payer = capture.payer || {};

  // Atomic all-or-none: flip all pieces to sold=true where sold=false.
  const { data: flipped, error: flipErr } = await sb
    .from("products")
    .update({ sold: true })
    .in("id", bundleProductIds)
    .eq("sold", false)
    .select("id");

  const flippedCount = flipped?.length || 0;
  const allFlipped = !flipErr && flippedCount === bundleProductIds.length;

  const captureId = captureRec?.id || null;
  const baseUpdate = {
    buyer_email: payer.email_address || null,
    buyer_name:
      [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" ") || null,
    shipping_address: shipping || null,
    payer_id: payer.payer_id || null,
    capture_id: captureId,
    raw_payload: capture,
    captured_at: new Date().toISOString(),
  };

  if (allFlipped) {
    // Codex HIGH #1: products.sold=true is now durably set. If the
    // subsequent paypal_orders UPDATE fails, we'd have sold inventory
    // with no captured order backing it — inventory limbo. Retry once
    // (transient DB blips clear on a second attempt), and if that fails
    // roll the products back to sold=false + surface an error to the
    // buyer so they know money moved but our record didn't land.
    //
    // Codex MED #1: also add a status filter — if the row was voided
    // out from under us (same-buyer retry created a NEW bundle order
    // via createPayPalBundleOrder while this capture was pending), we
    // do NOT want to blindly overwrite 'voided' → 'captured'. The .in
    // filter turns the second call into a no-op; the .select("id")
    // lets us detect that no rows matched and trigger the anomaly path.
    const bundleUpdate = { ...baseUpdate, status: "captured", sold_marked: true };
    let capturedRow;
    let updateErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await sb
        .from("paypal_orders")
        .update(bundleUpdate)
        .eq("id", paypalOrderId)
        .in("status", ["created", "approved"])
        .select("id");
      updateErr = res.error;
      capturedRow = res.data;
      if (!updateErr) break;
      // Small backoff before retry.
      await new Promise((r) => setTimeout(r, 200));
    }

    const wroteCapturedRow = !updateErr && (capturedRow?.length || 0) > 0;

    if (!wroteCapturedRow) {
      console.error(
        "[capturePayPalBundleOrder] CRITICAL: could not persist captured status after atomic products flip. Rolling back products.",
        updateErr || "row already in terminal status (voided/failed/etc.)"
      );
      // Roll back the products we flipped. Idempotent — .eq('sold', true)
      // ensures we only touch pieces WE just flipped, not any that were
      // already sold before we got here (we only flipped from false→true).
      await sb
        .from("products")
        .update({ sold: false })
        .in("id", bundleProductIds)
        .eq("sold", true);
      return {
        ok: false,
        manualReview: true,
        error:
          "Your payment was captured by PayPal but our system couldn't record the order. Please write to yanirelics@gmail.com with the order ID — the shop owner will refund or fulfill within a day. Your money is safe.",
      };
    }

    try {
      for (const id of bundleProductIds) revalidatePath(`/shop/${id}`);
      revalidatePath("/");
      revalidatePath("/shop");
      revalidatePath("/admin/orders");
    } catch (err) {
      console.error("[capturePayPalBundleOrder] revalidate error:", err);
    }

    return { ok: true, captureId, productIds: bundleProductIds };
  }

  // Oversell branch: at least one piece was already sold. Roll back the
  // ones we DID just flip (otherwise we'd have sold pieces with no captured
  // order matching them), then attempt a PayPal refund.
  console.warn(
    `[capturePayPalBundleOrder] OVERSOLD: order ${paypalOrderId} could not flip all pieces (got ${flippedCount}/${bundleProductIds.length}). Attempting full refund.`
  );

  const flippedIds = new Set((flipped || []).map((r) => r.id));
  if (flippedIds.size > 0) {
    await sb
      .from("products")
      .update({ sold: false })
      .in("id", Array.from(flippedIds));
  }

  let refundOk = false;
  if (captureId) {
    try {
      await paypalRequest(
        `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
        { method: "POST", body: {} }
      );
      refundOk = true;
    } catch (refundErr) {
      console.error("[capturePayPalBundleOrder] refund API error:", refundErr?.message);
    }
  }

  await sb
    .from("paypal_orders")
    .update({
      ...baseUpdate,
      status: refundOk ? "refunded" : "oversold",
    })
    .eq("id", paypalOrderId)
    .in("status", ["created", "approved"]);

  revalidatePath("/admin/orders");

  if (refundOk) {
    return {
      ok: false,
      oversold: true,
      error:
        "One of the pieces in your order was claimed by another buyer just now. Your payment has been refunded automatically — please try again with the remaining pieces.",
    };
  }
  return {
    ok: false,
    oversold: true,
    manualReview: true,
    error:
      "One of the pieces sold moments before your checkout, and the automatic refund failed. Your payment is being reviewed and will be returned — contact yanirelics@gmail.com if you don't see it in 24 hours.",
  };
}

/**
 * Client-facing server action: hydrate a set of product IDs into full
 * product records for the /checkout page. Thin wrapper over the DB helper
 * so the client component doesn't have to import Supabase directly.
 * Preserves order + drops unknowns (product deleted after selection).
 */
export async function fetchProductsForCheckout(productIds) {
  return await getProductsByIds(productIds);
}

/**
 * Fetches a bundle's line-item product IDs. Used by the /paypal/return
 * route to know which product pages to revalidate on capture success.
 */
export async function getBundleProductIds(paypalOrderId) {
  if (!paypalOrderId || typeof paypalOrderId !== "string") return [];
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("paypal_order_items")
    .select("product_id")
    .eq("order_id", paypalOrderId);
  if (error || !data) return [];
  return data.map((r) => r.product_id);
}
