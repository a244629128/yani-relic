"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalScriptProvider, PayPalButtons, FUNDING } from "@paypal/react-paypal-js";
import {
  createPayPalOrder,
  capturePayPalOrder,
  voidPayPalOrder,
} from "@/lib/paypal-actions";
import { getSessionId } from "@/lib/analytics";

/**
 * PayPal Smart Button. Renders a PayPal-branded checkout button that
 * opens a PayPal popup. On approve, captures server-side and shows a
 * success screen. On failure, surfaces the error inline.
 *
 * Props:
 *   product: { id, name, price, currency }
 *   clientId: PayPal publishable client id (server-injected)
 *   onSuccess?: optional callback for parent to react (e.g. show thanks)
 */
// iOS Safari ONLY (not macOS Safari, not Chrome on iOS, not other
// browsers). iOS Safari has the strictest user-activation policy: it
// revokes the gesture token while we await our async createPayPalOrder,
// so window.open() inside the SDK gets silently blocked. macOS Safari
// preserves the token across the same await. Touch-capability is the
// cleanest separator — macOS Safari has 0 touch points, iOS/iPadOS
// Safari has > 0.
function isTouchSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  return isSafari && hasTouch;
}

export default function PayPalCheckoutButton({ product, clientId, onSuccess }) {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | working | redirecting | manual_review | error
  const [error, setError] = useState("");
  const [targetUrl, setTargetUrl] = useState(null);
  const [manualReviewOrderId, setManualReviewOrderId] = useState(null);
  const [useSafariRedirect, setUseSafariRedirect] = useState(false);

  // Detect iOS Safari client-side only (SSR is uniform, JS lights up
  // after hydration). Avoid render mismatch by starting `false` and
  // flipping. macOS Safari + Chrome / Firefox / Edge get the SDK popup.
  useEffect(() => {
    if (isTouchSafari()) setUseSafariRedirect(true);
  }, []);

  // Q3 (Codex re-review): if client navigation hangs, fall back to hard
  // navigation. Using a useEffect with cleanup is more robust than a
  // pathname check — if the component unmounts (= navigation succeeded
  // and we left the page), the cleanup cancels the timer. If we're still
  // mounted in 'redirecting' state after 3s, client nav didn't complete
  // (whether URL changed or not), so we hard-navigate.
  useEffect(() => {
    if (status !== "redirecting" || !targetUrl) return;
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.assign(targetUrl);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [status, targetUrl]);

  const redirectToThanks = (paypalOrderId) => {
    const url = `/orders/thanks?o=${encodeURIComponent(paypalOrderId)}`;
    setTargetUrl(url);
    router.push(url);
  };

  if (!clientId) {
    // Owner hasn't configured PayPal yet — silently hide.
    return null;
  }

  // Brief "redirecting" state — shown for the moment between PayPal
  // capture success and router.push to /orders/thanks completing.
  // Doesn't ever display for long; fallback for slow connections.
  if (status === "redirecting") {
    return (
      <div className="rounded-md border border-labradorite-light/40 bg-labradorite/10 p-4 text-center">
        <p className="font-chancery text-xl text-labradorite-glow">
          Taking you to your confirmation…
        </p>
      </div>
    );
  }

  // Manual-review state: PayPal captured the money but our DB couldn't
  // record the order cleanly (both the captured + oversold UPDATEs
  // failed). Buyer's money is safe at PayPal; the owner needs to
  // reconcile manually. Don't redirect — buyer needs the clear support
  // ask in front of them.
  if (status === "manual_review") {
    return (
      <div className="rounded-md border border-yellow-200/40 bg-yellow-200/10 p-4 text-center">
        <p className="font-chancery text-2xl text-yellow-100 mb-2">
          Payment captured — please contact us
        </p>
        <p className="text-cream/90 text-sm leading-relaxed">
          {error ||
            "Your payment was taken by PayPal, but our system needs to reconcile."}
        </p>
        {manualReviewOrderId && (
          <p className="text-cream-dim/80 text-[11px] uppercase tracking-[0.18em] mt-3">
            Order ID:{" "}
            <code className="font-mono text-cream-dim normal-case tracking-normal">
              {manualReviewOrderId}
            </code>
          </p>
        )}
        <p className="text-cream-dim/80 text-xs italic mt-2">
          Write to{" "}
          <a
            href={`mailto:yanirelics@gmail.com?subject=${encodeURIComponent(`Order needs reconciliation: ${manualReviewOrderId || ""}`)}`}
            className="text-labradorite-light hover:text-labradorite-glow underline underline-offset-2"
          >
            yanirelics@gmail.com
          </a>{" "}
          with the order ID above and we&apos;ll confirm or refund within a day.
          Your money is safe.
        </p>
      </div>
    );
  }

  if (useSafariRedirect) {
    return (
      <SafariRedirectButton
        product={product}
        onError={(msg) => {
          setStatus("error");
          setError(msg);
        }}
      />
    );
  }

  return (
    <div className="w-full">
      <PayPalScriptProvider
        options={{
          "client-id": clientId,
          currency: product.currency || "USD",
          intent: "capture",
          // Show only the main PayPal button. PayPal SDK otherwise renders
          // additional rows for Pay Later, Debit/Credit Card, Venmo, etc.
          // (and a "Powered by PayPal" line beneath the card button).
          "disable-funding": "paylater,card,credit,venmo,bancontact,blik,eps,giropay,ideal,mercadopago,mybank,p24,sepa,sofort",
        }}
      >
        <PayPalButtons
          // Force ONLY the PayPal button — no Pay Later, no Debit/Credit
          // Card row, no Venmo, no regional alternates. Per Codex: more
          // robust than maintaining an exclusion list, since available
          // funding varies by country. disable-funding above is defense
          // in depth in case PayPal ever ships a new source.
          fundingSource={FUNDING.PAYPAL}
          style={{
            layout: "vertical",
            color: "gold",
            shape: "pill",
            label: "paypal",
            height: 48,
          }}
          disabled={status === "working"}
          forceReRender={[product.id, product.price]}
          createOrder={async () => {
            setError("");
            setStatus("working");
            const sessionId = getSessionId();
            const res = await createPayPalOrder(product.id, sessionId);
            if (!res.ok) {
              setStatus("error");
              setError(res.error || "Could not start checkout");
              // Structured flag (Codex MED) — server tells us explicitly
              // whether the rejection means "this piece is gone now". Refresh
              // the page so the UI updates to 'Found Home' parchment + hides
              // the buy button. Buyer sees the error briefly first.
              if (res.soldOut) {
                setTimeout(() => router.refresh(), 1800);
              }
              throw new Error(res.error || "createOrder failed");
            }
            return res.paypalOrderId;
          }}
          onApprove={async (data, actions) => {
            setStatus("working");
            const res = await capturePayPalOrder(data.orderID);
            if (res.ok) {
              setStatus("redirecting");
              onSuccess?.(res);
              redirectToThanks(data.orderID);
              return;
            }
            // Oversold (DB durably set status='oversold'): redirect to
            // thanks page where the order's status drives the copy.
            if (res.oversold) {
              setStatus("redirecting");
              redirectToThanks(data.orderID);
              return;
            }
            // Q6: manualReview means PayPal captured BUT our oversold-
            // marking ALSO failed. Order row is still 'created' in DB —
            // redirecting to thanks would just show generic "still
            // processing." Keep the buyer here with explicit copy + an
            // unambiguous support ask.
            if (res.manualReview) {
              setStatus("manual_review");
              setManualReviewOrderId(data.orderID);
              setError(res.error || "Captured at PayPal — please contact us.");
              return;
            }
            // Recoverable failure (e.g. INSTRUMENT_DECLINED): take the buyer
            // back to PayPal's funding-source selection so they can pick a
            // different card without restarting our flow.
            if (res.recoverable && typeof actions?.restart === "function") {
              setStatus("idle");
              setError(res.error || "Try a different payment method.");
              return actions.restart();
            }
            setStatus("error");
            setError(res.error || "Capture failed");
          }}
          onError={(err) => {
            console.error("[PayPal] onError:", err);
            setStatus("error");
            // Don't clobber a more-specific error already set by createOrder
            // (e.g. "Another buyer is checking out"). The SDK fires onError
            // whenever createOrder throws, but our throw already set the
            // useful message just before. Only use the generic line if
            // nothing more specific is showing.
            setError((prev) => prev || "PayPal hit an error. Please try again.");
            // Best-effort: free the slot so a retry isn't blocked. Server
            // verifies our session id before honoring the void.
            const orderId = err?.orderID || err?.order_id;
            const sessionId = getSessionId();
            if (orderId && sessionId) {
              voidPayPalOrder(orderId, sessionId).catch(() => {});
            }
          }}
          onCancel={(data) => {
            setStatus("idle");
            // User closed the popup without paying — free the slot. Server
            // only voids if the buyer_session_id matches what we stored at
            // create-time, so an attacker who learns the order id alone
            // cannot weaken the oversell guard.
            const sessionId = getSessionId();
            if (data?.orderID && sessionId) {
              voidPayPalOrder(data.orderID, sessionId).catch(() => {});
            }
          }}
        />
      </PayPalScriptProvider>

      {error && (
        <p className="text-rose-300 text-xs italic mt-2 text-center">{error}</p>
      )}
    </div>
  );
}

/**
 * Safari fallback: a PayPal-branded button that, when clicked, hits our
 * server action to create the order, then does a FULL PAGE REDIRECT to
 * PayPal's approve URL. No popup, no user-gesture-token requirement.
 *
 * PayPal redirects back to /paypal/return after approval, where we
 * capture server-side and forward to /orders/thanks.
 *
 * Visual approximation of the official PayPal button — PayPal Yellow
 * (#FFC439) pill with the "PayPal" wordmark in PayPal Blue (#003087).
 */
function SafariRedirectButton({ product, onError }) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    const sessionId = getSessionId();
    const res = await createPayPalOrder(product.id, sessionId);
    if (!res.ok) {
      setBusy(false);
      onError?.(res.error || "Could not start checkout");
      return;
    }
    if (!res.approveUrl) {
      setBusy(false);
      onError?.("PayPal did not return an approval URL — please try again.");
      return;
    }
    // Full-page redirect to PayPal. The browser keeps the user-gesture
    // intact for navigation (unlike window.open which needs the gesture
    // token Safari already revoked).
    window.location.href = res.approveUrl;
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="w-full h-12 rounded-full bg-[#FFC439] hover:bg-[#FFCF1F] active:bg-[#F2BB30] disabled:opacity-60 flex items-center justify-center gap-1 font-semibold text-[#003087] shadow-sm transition-colors"
      aria-label="Pay with PayPal"
    >
      {busy ? (
        <span className="text-sm">Connecting to PayPal…</span>
      ) : (
        <>
          {/* PayPal-style wordmark — two overlapping "P" letterforms in
              their canonical colors, then "Pay" + "Pal" wordmark text. */}
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#003087"
              d="M7.4 21.5h2.7c.4 0 .7-.3.8-.7l.7-3.7c.1-.4.4-.7.8-.7h1.7c3.5 0 6.2-1.7 6.9-5.4.5-2.6-.4-4.4-2.3-5.3-.3-.1-.6-.2-1-.3-.7-.2-1.5-.3-2.5-.3H10.4c-.4 0-.8.3-.9.7L7.4 21.5z"
            />
            <path
              fill="#009CDE"
              d="M19.7 9.3c-.3 2.1-1.9 3.4-4.3 3.4h-1.5c-.3 0-.5.2-.6.5l-.7 4.3-.2 1.1c0 .2.1.4.4.4h2.3c.3 0 .6-.2.6-.5l.6-3.6c0-.3.3-.5.6-.5h.4c2.8 0 5-1.6 5.6-4.8.3-1.3.1-2.4-.5-3.2-.6-.8-.4-.6-.4-.6-.1.2-.2.3-.3 1.5z"
            />
          </svg>
          <span className="text-base">
            Pay with{" "}
            <span className="italic font-bold">
              <span className="text-[#003087]">Pay</span>
              <span className="text-[#009CDE]">Pal</span>
            </span>
          </span>
        </>
      )}
    </button>
  );
}
