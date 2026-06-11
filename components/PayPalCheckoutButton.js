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
export default function PayPalCheckoutButton({ product, clientId, onSuccess }) {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | working | redirecting | manual_review | error
  const [error, setError] = useState("");
  const [targetUrl, setTargetUrl] = useState(null);
  const [manualReviewOrderId, setManualReviewOrderId] = useState(null);

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
            setError("PayPal hit an error. Please try again.");
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
