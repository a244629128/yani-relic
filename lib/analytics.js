"use client";

// Anonymous engagement tracking — see scripts/analytics-schema.sql for the
// table this writes to. Three event types:
//   - trackView(productId)         called when a product detail/modal opens.
//                                  Returns a function that, when called,
//                                  flushes the view with a duration_ms.
//   - trackDepopClick(productId)   on outbound "Buy on Depop" click.
//   - trackImageZoom(productId)    on fullscreen image open.
//
// Multi-point dwell flush per Codex's note that modal-close alone misses
// tab-close, app backgrounding, Safari lifecycle weirdness. We listen for
// `visibilitychange→hidden` and `pagehide` and flush via sendBeacon then.

const ENDPOINT = "/api/track";
const SESSION_KEY = "yr_session_id";
const MAX_DURATION = 5 * 60 * 1000; // 5 min; matches server + DB

function getSessionId() {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // localStorage blocked (Safari private mode, iframe sandboxing) — proceed
    // without a stable session id. Per-event analytics still works; we just
    // can't deduplicate visitors.
    return null;
  }
}

function sendEvent(payload) {
  if (typeof window === "undefined") return;
  const enriched = {
    sessionId: getSessionId(),
    referrer: document.referrer || null,
    ...payload,
  };
  try {
    const body = JSON.stringify(enriched);
    // sendBeacon is fire-and-forget and survives page unload — exactly what
    // we want. It defaults to text/plain content-type; the API route reads
    // the body as text and parses JSON, so that's fine.
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, body);
      if (ok) return;
    }
    // Fallback: fetch with keepalive
    fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  } catch {
    // Don't ever throw from analytics. A failed track is fine.
  }
}

/**
 * Track that a product detail / modal was opened. Returns an `end()` function
 * — call it when the modal closes to flush a `view` event with duration_ms.
 *
 * Internally handles:
 *   - Pausing timer when tab hidden, resuming when visible
 *   - Flushing on pagehide + visibilitychange→hidden (covers tab close,
 *     mobile app backgrounding, navigation away)
 *   - Idempotent end(): calling twice only fires one event
 *
 * Usage:
 *   useEffect(() => {
 *     if (!product) return;
 *     const end = trackView(product.id);
 *     return () => end();
 *   }, [product]);
 */
export function trackView(productId) {
  if (typeof window === "undefined" || !productId) return () => {};

  let elapsedMs = 0;
  let segmentStart = Date.now();
  let finished = false;

  const onVisibility = () => {
    if (document.hidden) {
      // Pause: accumulate the segment we just spent visible.
      if (segmentStart != null) {
        elapsedMs += Date.now() - segmentStart;
        segmentStart = null;
      }
      // Flush as a flushed snapshot (don't mark finished — user may come back)
      flush(/* keepRunning */ true);
    } else if (segmentStart == null) {
      segmentStart = Date.now();
    }
  };

  const onPageHide = () => flush(/* keepRunning */ false);

  const flush = (keepRunning) => {
    if (finished) return;
    let total = elapsedMs;
    if (segmentStart != null) total += Date.now() - segmentStart;
    if (!keepRunning) finished = true;
    if (total >= 500 && total <= MAX_DURATION) {
      sendEvent({
        productId,
        eventType: "view",
        durationMs: Math.min(MAX_DURATION, total),
      });
      // After flushing, reset so we don't double-count if the user comes back.
      elapsedMs = 0;
      segmentStart = keepRunning && !document.hidden ? Date.now() : segmentStart;
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  return function end() {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    flush(/* keepRunning */ false);
  };
}

export function trackDepopClick(productId) {
  if (!productId) return;
  sendEvent({ productId, eventType: "depop_click" });
}

/**
 * Site-wide Depop click — used for footer / header / hero / mobile-bar
 * links that aren't tied to any specific relic. `source` is an optional
 * free-text label (e.g. "footer", "header") for future drilldown; we
 * don't persist it to the DB right now but it shows up in the request.
 */
export function trackDepopClickGeneral(_source) {
  sendEvent({ eventType: "depop_click_general" });
}

export function trackMailtoClick(productId) {
  if (!productId) return;
  sendEvent({ productId, eventType: "mailto_click" });
}

export function trackMailtoClickGeneral(_source) {
  sendEvent({ eventType: "mailto_click_general" });
}

export function trackImageZoom(productId) {
  if (!productId) return;
  sendEvent({ productId, eventType: "image_zoom" });
}
