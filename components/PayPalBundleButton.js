"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalScriptProvider, PayPalButtons, FUNDING } from "@paypal/react-paypal-js";
import {
  createPayPalBundleOrder,
  capturePayPalBundleOrder,
  voidPayPalOrder,
} from "@/lib/paypal-actions";
import { getSessionId } from "@/lib/analytics";
import { useSelection } from "@/hooks/useSelection";

/**
 * PayPal Smart Button variant for the bundle-checkout flow. Modelled on
 * PayPalCheckoutButton but calls the bundle server actions and drives its
 * state off an array of product IDs.
 *
 * Difference from single-item flow:
 *   - No "locked" state — the bundle create action returns a list of
 *     unavailableIds so we can silently remove them from selection and
 *     let the buyer retry (per Q4 spec).
 *   - Removes captured items from localStorage on success (so the buyer's
 *     next visit doesn't try to re-checkout already-purchased pieces).
 *
 * Safari fallback uses the same window.location.href redirect pattern
 * as the single-item button.
 */
const PAYPAL_CURRENCY = "USD";

function isTouchSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  return isSafari && hasTouch;
}

export default function PayPalBundleButton({ productIds, clientId }) {
  const router = useRouter();
  const { remove, clear } = useSelection();
  const [status, setStatus] = useState("idle"); // idle | working | redirecting | error
  const [error, setError] = useState("");
  const [targetUrl, setTargetUrl] = useState(null);
  const [useSafariRedirect, setUseSafariRedirect] = useState(false);

  useEffect(() => {
    if (isTouchSafari()) setUseSafariRedirect(true);
  }, []);

  // Fallback hard-navigation if client router hangs (mirrors single-item).
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

  // Handle server-reported unavailability by dropping the offending IDs
  // from local selection so the /checkout page re-renders without them.
  const handleUnavailability = (unavailableIds, message) => {
    if (Array.isArray(unavailableIds) && unavailableIds.length > 0) {
      for (const id of unavailableIds) remove(id);
    }
    setStatus("error");
    setError(message || "One or more pieces became unavailable. Review your selection.");
  };

  if (!clientId) return null;

  if (status === "redirecting") {
    return (
      <div className="rounded-md border border-labradorite-light/40 bg-labradorite/10 p-4 text-center">
        <p className="font-chancery text-xl text-labradorite-glow">
          Taking you to your confirmation…
        </p>
      </div>
    );
  }

  if (useSafariRedirect) {
    return (
      <div className="w-full">
        <SafariBundleRedirectButton
          productIds={productIds}
          onError={(msg) => {
            setStatus("error");
            setError(msg);
          }}
          onUnavailable={handleUnavailability}
        />
        {error && (
          <p className="text-rose-300 text-xs italic mt-2 text-center">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <PayPalScriptProvider
        options={{
          "client-id": clientId,
          currency: PAYPAL_CURRENCY,
          intent: "capture",
          "disable-funding":
            "paylater,card,credit,venmo,bancontact,blik,eps,giropay,ideal,mercadopago,mybank,p24,sepa,sofort",
        }}
      >
        <PayPalButtons
          fundingSource={FUNDING.PAYPAL}
          style={{
            layout: "vertical",
            color: "gold",
            shape: "pill",
            label: "paypal",
            height: 48,
          }}
          disabled={status === "working" || productIds.length === 0}
          // Re-render when the list changes so PayPal doesn't cache stale order data.
          forceReRender={[productIds.join(",")]}
          createOrder={async () => {
            setError("");
            setStatus("working");
            const sessionId = getSessionId();
            const res = await createPayPalBundleOrder(productIds, sessionId);
            if (!res.ok) {
              handleUnavailability(res.unavailableIds, res.error);
              throw new Error(res.error || "createBundleOrder failed");
            }
            return res.paypalOrderId;
          }}
          onApprove={async (data) => {
            setStatus("working");
            const res = await capturePayPalBundleOrder(data.orderID);
            if (res.ok) {
              // Clear the selection so a return visit to /checkout doesn't
              // try to buy the same pieces again.
              clear();
              setStatus("redirecting");
              redirectToThanks(data.orderID);
              return;
            }
            if (res.oversold) {
              // Refund happened (or is pending admin review). Redirect to
              // the thanks page — the order status will drive the copy.
              setStatus("redirecting");
              redirectToThanks(data.orderID);
              return;
            }
            setStatus("error");
            setError(res.error || "Capture failed");
          }}
          onError={(err) => {
            console.error("[PayPalBundleButton] onError:", err);
            setStatus("error");
            setError((prev) => prev || "PayPal hit an error. Please try again.");
            const orderId = err?.orderID || err?.order_id;
            const sessionId = getSessionId();
            if (orderId && sessionId) {
              voidPayPalOrder(orderId, sessionId).catch(() => {});
            }
          }}
          onCancel={(data) => {
            setStatus("idle");
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
 * iOS Safari fallback — full-page redirect. Same pattern as
 * SafariRedirectButton in the single-item flow.
 */
function SafariBundleRedirectButton({ productIds, onError, onUnavailable }) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const onClick = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const sessionId = getSessionId();
      const res = await createPayPalBundleOrder(productIds, sessionId);
      if (!res.ok) {
        onUnavailable?.(res.unavailableIds, res.error);
        return;
      }
      if (!res.approveUrl) {
        onError?.("PayPal did not return an approval URL — please try again.");
        return;
      }
      window.location.href = res.approveUrl;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || productIds.length === 0}
      className="w-full h-12 rounded-full bg-[#FFC439] hover:bg-[#FFCF1F] active:bg-[#F2BB30] disabled:opacity-60 flex items-center justify-center gap-1 font-semibold text-[#003087] shadow-sm transition-colors"
      aria-label="Pay with PayPal"
    >
      {busy ? (
        <span className="text-sm">Connecting to PayPal…</span>
      ) : (
        <>
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
