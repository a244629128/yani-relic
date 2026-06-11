"use client";

import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import {
  createPayPalOrder,
  capturePayPalOrder,
  voidPayPalOrder,
} from "@/lib/paypal-actions";

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
  const [status, setStatus] = useState("idle"); // idle | working | success | error
  const [error, setError] = useState("");
  const [captureId, setCaptureId] = useState(null);

  if (!clientId) {
    // Owner hasn't configured PayPal yet — silently hide.
    return null;
  }

  if (status === "success") {
    return (
      <div className="rounded-md border border-labradorite-light/40 bg-labradorite/10 p-4 text-center">
        <p className="font-chancery text-2xl text-labradorite-glow mb-2">
          Thank you.
        </p>
        <p className="text-cream/90 text-sm leading-relaxed">
          Your order is recorded — PayPal will email a receipt. I&apos;ll be in
          touch within a day or two with shipping details.
        </p>
        {captureId && (
          <p className="text-cream-dim/60 text-[10px] uppercase tracking-[0.18em] mt-3">
            Confirmation: {captureId}
          </p>
        )}
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
        }}
      >
        <PayPalButtons
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
            const res = await createPayPalOrder(product.id);
            if (!res.ok) {
              setStatus("error");
              setError(res.error || "Could not start checkout");
              throw new Error(res.error || "createOrder failed");
            }
            return res.paypalOrderId;
          }}
          onApprove={async (data) => {
            setStatus("working");
            const res = await capturePayPalOrder(data.orderID);
            if (!res.ok) {
              setStatus("error");
              setError(res.error || "Capture failed");
              return;
            }
            setCaptureId(res.captureId);
            setStatus("success");
            onSuccess?.(res);
          }}
          onError={(err) => {
            console.error("[PayPal] onError:", err);
            setStatus("error");
            setError("PayPal hit an error. Please try again.");
            // Best-effort: free the slot so a retry isn't blocked.
            if (err?.orderID || err?.order_id) {
              voidPayPalOrder(err.orderID || err.order_id).catch(() => {});
            }
          }}
          onCancel={(data) => {
            setStatus("idle");
            // User closed the popup without paying — free the slot.
            if (data?.orderID) {
              voidPayPalOrder(data.orderID).catch(() => {});
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
