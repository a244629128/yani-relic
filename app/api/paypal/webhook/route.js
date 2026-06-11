// PayPal webhook receiver. Defense-in-depth: even if the synchronous capture
// path fails to update our DB, PayPal eventually posts here with the final
// state of every order. We verify the signature, then update paypal_orders.

import { NextResponse } from "next/server";
import { paypalRequest } from "@/lib/paypal";
import { createAdminSupabase } from "@/lib/supabase";

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
    .select("status, captured_at, capture_id")
    .eq("id", orderId)
    .maybeSingle();

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

  const { error: updateErr } = await sb
    .from("paypal_orders")
    .update(updates)
    .eq("id", orderId);

  if (updateErr) {
    console.error("[paypal-webhook] update failed:", updateErr);
    // 500 → PayPal will retry. That's what we want for transient DB failure.
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
