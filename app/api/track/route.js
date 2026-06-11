// POST /api/track  —  anonymous engagement-event ingestion.
//
// Designed to be called with navigator.sendBeacon() from the browser. Accepts
// JSON or text/plain bodies (sendBeacon defaults to text/plain when given a
// string). Inserts into product_events via the anon key (RLS-enforced).
//
// No rate limiting at this scale — Codex flagged in-memory limits as
// unreliable across Vercel isolates. The DB CHECK constraints already
// reject anything malformed, and the schema caps row size + dwell time.

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set([
  "view",
  "depop_click",
  "depop_click_general",
  "mailto_click",
  "mailto_click_general",
  "image_zoom",
  "flip_deck_claim",
]);
const GENERAL_EVENTS = new Set(["depop_click_general", "mailto_click_general"]);
const MAX_DURATION = 5 * 60 * 1000; // 5 minutes; matches DB constraint

export async function POST(req) {
  let body;
  try {
    const text = await req.text();
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { productId, eventType, durationMs, sessionId, referrer } = body || {};

  // Light validation — anything wrong, drop silently with 204 so the browser
  // doesn't retry. We don't want failed analytics to look like errors.
  if (!ALLOWED_EVENTS.has(eventType)) {
    return new NextResponse(null, { status: 204 });
  }
  // Per-product events require a product_id; general clicks must NOT have one.
  if (GENERAL_EVENTS.has(eventType)) {
    if (productId !== undefined && productId !== null) {
      return new NextResponse(null, { status: 204 });
    }
  } else {
    if (typeof productId !== "string" || productId.length === 0 || productId.length > 64) {
      return new NextResponse(null, { status: 204 });
    }
  }

  let cleanDuration = null;
  if (eventType === "view") {
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
      return new NextResponse(null, { status: 204 });
    }
    if (durationMs < 500) {
      // Codex: drop accidental taps / scanner noise here, not in client.
      return new NextResponse(null, { status: 204 });
    }
    cleanDuration = Math.max(0, Math.min(MAX_DURATION, Math.round(durationMs)));
  }

  const cleanSession =
    typeof sessionId === "string" && sessionId.length > 0 && sessionId.length <= 64
      ? sessionId
      : null;
  const cleanReferrer =
    typeof referrer === "string" && referrer.length > 0
      ? referrer.slice(0, 512)
      : null;

  const sb = createServerSupabase();
  const { error } = await sb.from("product_events").insert({
    product_id: GENERAL_EVENTS.has(eventType) ? null : productId,
    event_type: eventType,
    duration_ms: cleanDuration,
    session_id: cleanSession,
    referrer: cleanReferrer,
  });

  if (error) {
    // Log server-side; don't surface to client (analytics failures shouldn't
    // affect the user's experience).
    console.error("[/api/track] insert error:", error.message);
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, { status: 204 });
}
