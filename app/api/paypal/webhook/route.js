// PayPal webhook receiver. Defense-in-depth: even if the synchronous capture
// path fails to update our DB, PayPal eventually posts here with the final
// state of every order. We verify the signature, then update paypal_orders.

import { NextResponse } from "next/server";
import { paypalRequest } from "@/lib/paypal";
import { createAdminSupabase } from "@/lib/supabase";
import { markProductSold } from "@/lib/products-db";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

// Webhook events we care about. PayPal sends many more; we ignore the rest.
const STATUS_BY_EVENT = {
  "PAYMENT.CAPTURE.COMPLETED": "captured",
  "PAYMENT.CAPTURE.DENIED": "failed",
  "PAYMENT.CAPTURE.REFUNDED": "refunded",
  "PAYMENT.CAPTURE.REVERSED": "refunded",
  "CHECKOUT.ORDER.APPROVED": "approved",
  "CHECKOUT.ORDER.VOIDED": "voided",
};

export async function POST(req) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("[paypal-webhook] PAYPAL_WEBHOOK_ID is not set");
    return new NextResponse(null, { status: 503 });
  }

  // Read raw body for signature verification.
  const rawBody = await req.text();
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Verify signature with PayPal.
  const verifyPayload = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: event,
  };
  if (
    !verifyPayload.auth_algo ||
    !verifyPayload.cert_url ||
    !verifyPayload.transmission_id ||
    !verifyPayload.transmission_sig ||
    !verifyPayload.transmission_time
  ) {
    console.warn("[paypal-webhook] missing signature headers");
    return new NextResponse(null, { status: 400 });
  }

  let verification;
  try {
    verification = await paypalRequest(
      "/v1/notifications/verify-webhook-signature",
      { method: "POST", body: verifyPayload }
    );
  } catch (err) {
    console.error("[paypal-webhook] signature verify call failed:", err);
    return new NextResponse(null, { status: 500 });
  }
  if (verification?.verification_status !== "SUCCESS") {
    console.warn("[paypal-webhook] signature did not verify");
    return new NextResponse(null, { status: 401 });
  }

  // Map event → order status update.
  const eventType = event.event_type;
  const targetStatus = STATUS_BY_EVENT[eventType];
  if (!targetStatus) {
    // Not an event we track. Acknowledge so PayPal doesn't retry.
    return new NextResponse(null, { status: 204 });
  }

  // Find the paypal_orders row. Event resource shape differs by event type:
  //   - PAYMENT.CAPTURE.*    : resource is a Capture; resource.supplementary_data.related_ids.order_id
  //                            or resource.custom_id (we don't set custom_id)
  //   - CHECKOUT.ORDER.*     : resource is the Order; resource.id IS the order id
  const resource = event.resource || {};
  let orderId = null;
  if (eventType.startsWith("CHECKOUT.ORDER.")) {
    orderId = resource.id;
  } else if (eventType.startsWith("PAYMENT.CAPTURE.")) {
    orderId =
      resource.supplementary_data?.related_ids?.order_id ||
      resource.invoice_id ||
      null;
  }
  if (!orderId) {
    console.warn("[paypal-webhook] could not locate order id for event", eventType);
    return new NextResponse(null, { status: 204 });
  }

  const sb = createAdminSupabase();

  // Idempotency: only overwrite to "stronger" statuses. e.g. don't downgrade
  // a captured order back to 'approved' just because a stale event arrives.
  const STATUS_RANK = {
    created: 0,
    approved: 1,
    captured: 2,
    voided: 3,
    failed: 3,
    refunded: 4,
  };

  const { data: existing } = await sb
    .from("paypal_orders")
    .select("status, captured_at, capture_id, product_id, sold_marked")
    .eq("id", orderId)
    .maybeSingle();

  // Bundle marker: paypal_orders.product_id IS NULL means this row was
  // created via the bundle-checkout flow. Bundles need special handling
  // because markProductSold applies to a single product; a bundle
  // capture requires an atomic all-or-none flip across all line items.
  const isBundle = existing ? existing.product_id === null : false;

  // Decide whether to update the status field. We keep status monotonic so
  // a stale event can't downgrade a row past its final state. Capture
  // metadata (capture_id / captured_at), however, lands regardless of rank
  // — even out-of-order events should backfill those fields if missing.
  let shouldUpdateStatus = true;
  if (existing) {
    const currentRank = STATUS_RANK[existing.status] ?? 0;
    const incomingRank = STATUS_RANK[targetStatus] ?? 0;
    if (incomingRank < currentRank) {
      shouldUpdateStatus = false;
    }
  }

  // Extract capture metadata from the payload regardless of event type.
  // PAYMENT.CAPTURE.* events: resource.id IS the capture id, captured at = resource.create_time.
  // CHECKOUT.ORDER.* events: capture data nested under purchase_units.
  let capturePayloadId = null;
  let capturePayloadAt = null;
  if (eventType.startsWith("PAYMENT.CAPTURE.")) {
    capturePayloadId = resource.id || null;
    capturePayloadAt = resource.create_time || null;
  } else if (eventType.startsWith("CHECKOUT.ORDER.")) {
    const cap = resource.purchase_units?.[0]?.payments?.captures?.[0];
    capturePayloadId = cap?.id || null;
    capturePayloadAt = cap?.create_time || null;
  }

  const updates = { raw_payload: event };
  if (shouldUpdateStatus) {
    updates.status = targetStatus;
    // Bundle sold_marked into the same UPDATE so the admin tracker stays
    // consistent with products.sold (Phase 2B auto-mark). Only set on
    // transitions to captured — refunds/voids deliberately don't touch
    // sold_marked so an oversold/refunded row still shows historically.
    if (targetStatus === "captured") {
      updates.sold_marked = true;
    }
  }
  if (capturePayloadId && !existing?.capture_id) {
    updates.capture_id = capturePayloadId;
  }
  if (capturePayloadAt && !existing?.captured_at) {
    updates.captured_at = capturePayloadAt;
  } else if (targetStatus === "captured" && !existing?.captured_at) {
    // Fallback if PayPal didn't include create_time for some reason.
    updates.captured_at = new Date().toISOString();
  }

  // Codex BLOCKER: bundle rows require the same atomic all-or-none products
  // flip that capturePayPalBundleOrder does synchronously — the webhook
  // must NOT just set status='captured' without flipping inventory, or
  // admin sees a "captured" bundle with unsold products (inventory limbo).
  //
  // Idempotency: if sold_marked is already true, the sync capture path
  // has already run; we only need to make sure raw_payload / capture_id
  // land here without touching products or triggering a spurious oversell.
  if (isBundle && updates.status === "captured" && !existing?.sold_marked) {
    return await handleBundleWebhookCapture({
      sb,
      orderId,
      updates,
      capturePayload: event,
    });
  }

  const { error: updateErr } = await sb
    .from("paypal_orders")
    .update(updates)
    .eq("id", orderId);

  if (!updateErr) {
    // Phase 2B: auto-mark product sold when the webhook confirms capture.
    // Idempotent with the synchronous capture path — both call the same
    // helper with WHERE sold=false guard, so a second invocation no-ops.
    // The webhook is the durability backstop in case the synchronous
    // capture's auto-mark call ran into transient error.
    //
    // Bundle rows skip this — bundles were handled above (or the sync
    // capture already ran; in either case markProductSold with a NULL
    // product_id would silently no-op).
    if (updates.status === "captured" && !isBundle) {
      const productId = existing?.product_id || extractProductIdFromEvent(event);
      if (productId) {
        try {
          await markProductSold(productId);
        } catch (err) {
          console.error("[paypal-webhook] auto-mark sold failed:", err);
        }
      }
    }
    return new NextResponse(null, { status: 204 });
  }

  // OVERSELL DETECTION at the webhook path. Same race window as the
  // synchronous capture in lib/paypal-actions.js — if PayPal redelivers
  // a PAYMENT.CAPTURE.COMPLETED here for a product that already has
  // another captured row, the unique index rejects this UPDATE.
  const isOversold =
    updates.status === "captured" &&
    (updateErr.code === "23505" ||
      (typeof updateErr.message === "string" &&
        updateErr.message.includes("uq_po_one_captured_per_product")));

  if (isOversold) {
    console.warn(
      `[paypal-webhook] OVERSOLD: order ${orderId} blocked by unique index. Flipping to 'oversold' for admin review.`
    );
    // Reset sold_marked when overriding to 'oversold' — the bundled
    // sold_marked=true from the captured-attempt updates object would
    // otherwise carry over, but an oversold row was never allocated to
    // this buyer's product (the other captured row got it).
    const oversoldUpdates = { ...updates, status: "oversold", sold_marked: false };
    const { error: oversoldErr } = await sb
      .from("paypal_orders")
      .update(oversoldUpdates)
      .eq("id", orderId)
      // Codex MED: narrow the guard. .neq('refunded') would clobber a
      // 'voided' or 'failed' row to 'oversold'. Only flip in-flight rows.
      .in("status", ["created", "approved"]);
    if (oversoldErr) {
      console.error(
        "[paypal-webhook] CRITICAL: failed to mark oversold:",
        oversoldErr
      );
      // 500 → PayPal retries. Webhook is our durability backstop here.
      return new NextResponse(null, { status: 500 });
    }
    return new NextResponse(null, { status: 204 });
  }

  console.error("[paypal-webhook] update failed:", updateErr);
  // 500 → PayPal will retry. That's what we want for transient DB failure.
  return new NextResponse(null, { status: 500 });
}

/**
 * Bundle-specific capture path from the webhook. Mirrors the atomic
 * all-or-none logic in capturePayPalBundleOrder (lib/paypal-actions.js):
 *   1. Fetch the bundle's line items.
 *   2. Atomic flip products SET sold=true WHERE id IN (items) AND sold=false.
 *   3. If all flipped → persist captured status + sold_marked=true.
 *   4. If not all flipped → refund PayPal + mark oversold (or refunded
 *      if PayPal accepted the refund), roll back the products we flipped.
 *
 * Called from POST handler above when the webhook says a bundle became
 * captured AND the sync path hasn't already recorded sold_marked (an
 * idempotency guard for redelivered webhooks).
 */
async function handleBundleWebhookCapture({ sb, orderId, updates, capturePayload }) {
  const { data: itemRows, error: itemsErr } = await sb
    .from("paypal_order_items")
    .select("product_id")
    .eq("order_id", orderId);
  if (itemsErr || !itemRows || itemRows.length === 0) {
    console.error(
      "[paypal-webhook] bundle capture: items lookup failed for", orderId, itemsErr
    );
    // 500 → PayPal retries. If items are truly missing this will keep
    // failing, but that's a data corruption issue that needs admin.
    return new NextResponse(null, { status: 500 });
  }
  const bundleProductIds = itemRows.map((r) => r.product_id);

  // Atomic all-or-none flip.
  const { data: flipped, error: flipErr } = await sb
    .from("products")
    .update({ sold: true })
    .in("id", bundleProductIds)
    .eq("sold", false)
    .select("id");
  const flippedCount = flipped?.length || 0;
  const allFlipped = !flipErr && flippedCount === bundleProductIds.length;

  if (allFlipped) {
    const { data: capturedRow, error: updateErr } = await sb
      .from("paypal_orders")
      .update(updates)
      .eq("id", orderId)
      .in("status", ["created", "approved"])
      .select("id");

    if (updateErr || (capturedRow?.length || 0) === 0) {
      console.error(
        "[paypal-webhook] bundle capture: could not persist captured status after flip. Rolling back products.",
        updateErr || "row already in terminal status"
      );
      await sb
        .from("products")
        .update({ sold: false })
        .in("id", bundleProductIds)
        .eq("sold", true);
      // 500 → PayPal retries. That's what we want for transient DB failure.
      return new NextResponse(null, { status: 500 });
    }

    try {
      for (const id of bundleProductIds) revalidatePath(`/shop/${id}`);
      revalidatePath("/");
      revalidatePath("/shop");
      revalidatePath("/admin/orders");
    } catch (err) {
      console.error("[paypal-webhook] bundle capture revalidate error:", err);
    }
    return new NextResponse(null, { status: 204 });
  }

  // Oversell: some items were already sold by another flow before we got
  // here. Roll back the ones we DID just flip, then attempt a PayPal
  // refund. If refund succeeds → mark 'refunded'; if not → 'oversold' for
  // manual admin action.
  console.warn(
    `[paypal-webhook] OVERSOLD bundle ${orderId}: flipped ${flippedCount}/${bundleProductIds.length}. Attempting refund.`
  );
  const flippedIds = new Set((flipped || []).map((r) => r.id));
  if (flippedIds.size > 0) {
    await sb
      .from("products")
      .update({ sold: false })
      .in("id", Array.from(flippedIds));
  }

  // Extract capture_id from the webhook payload — needed for the refund API.
  const resource = capturePayload?.resource || {};
  let refundCaptureId = null;
  if (capturePayload?.event_type?.startsWith("PAYMENT.CAPTURE.")) {
    refundCaptureId = resource.id || null;
  } else if (capturePayload?.event_type?.startsWith("CHECKOUT.ORDER.")) {
    refundCaptureId = resource.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
  }

  let refundOk = false;
  if (refundCaptureId) {
    try {
      await paypalRequest(
        `/v2/payments/captures/${encodeURIComponent(refundCaptureId)}/refund`,
        { method: "POST", body: {} }
      );
      refundOk = true;
    } catch (refundErr) {
      console.error(
        "[paypal-webhook] bundle oversold refund failed:", refundErr?.message
      );
    }
  }

  const oversoldUpdates = {
    ...updates,
    status: refundOk ? "refunded" : "oversold",
    sold_marked: false,
  };
  const { error: markErr } = await sb
    .from("paypal_orders")
    .update(oversoldUpdates)
    .eq("id", orderId)
    .in("status", ["created", "approved"]);

  if (markErr) {
    console.error(
      "[paypal-webhook] CRITICAL: bundle oversold-mark failed:", markErr
    );
    // 500 → PayPal will retry. That's what we want for transient DB failure.
    return new NextResponse(null, { status: 500 });
  }

  try {
    revalidatePath("/admin/orders");
  } catch (err) {
    console.error("[paypal-webhook] bundle oversold revalidate error:", err);
  }
  return new NextResponse(null, { status: 204 });
}

// Fallback for the rare case where our paypal_orders row is missing
// product_id (e.g. the webhook arrives before createPayPalOrder's insert
// landed). PayPal includes reference_id on CHECKOUT.ORDER.* events; for
// PAYMENT.CAPTURE.* the most reliable field is invoice_id (which we don't
// set) or supplementary_data.related_ids.order_id (then re-fetch).
function extractProductIdFromEvent(event) {
  try {
    const eventType = event?.event_type || "";
    const resource = event?.resource || {};
    if (eventType.startsWith("CHECKOUT.ORDER.")) {
      return resource.purchase_units?.[0]?.reference_id || null;
    }
    if (eventType.startsWith("PAYMENT.CAPTURE.")) {
      // CAPTURE events don't typically include reference_id at top level.
      // Try the supplementary related_ids structure as best-effort.
      return resource.supplementary_data?.related_ids?.reference_id || null;
    }
    return null;
  } catch {
    return null;
  }
}
