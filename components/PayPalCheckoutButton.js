"use client";

import { useState } from "react";
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
  const [status, setStatus] = useState("idle"); // idle | working | success | error | oversold
  const [error, setError] = useState("");
  const [captureId, setCaptureId] = useState(null);

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
              setCaptureId(res.captureId);
              setStatus("redirecting");
              onSuccess?.(res);
              // Off to the rich thank-you page. The page itself re-fetches
              // the order via session-bound server action and handles the
              // small lag between client redirect and DB write via polling.
              router.push(`/orders/thanks?o=${encodeURIComponent(data.orderID)}`);
              return;
            }
            // Oversold: buyer's money is at PayPal but our system can't
            // allocate it. Owner will refund manually. Still navigate to
            // the thanks page — it surfaces the oversold-specific copy.
            if (res.oversold || res.manualReview) {
              setStatus("redirecting");
              router.push(`/orders/thanks?o=${encodeURIComponent(data.orderID)}`);
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
