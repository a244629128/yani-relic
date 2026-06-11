"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markOrderManuallyRefunded } from "@/lib/paypal-actions";

/**
 * Shown next to an 'oversold' row in /admin/orders. After the owner
 * manually refunds the buyer in PayPal Dashboard, they click this to
 * flip the row from 'oversold' to 'refunded' — clearing it from the
 * "needs review" banner count.
 */
export default function MarkedRefundedButton({ orderId, buyerName }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onClick = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await markOrderManuallyRefunded(orderId);
        if (res.ok) {
          setDone(true);
          router.refresh();
        } else {
          setError(res.error || "Failed");
        }
      } catch (err) {
        setError(err.message || "Failed");
      }
    });
  };

  if (done) {
    return (
      <span className="text-labradorite-light text-[11px] uppercase tracking-[0.18em]">
        ✓ Marked refunded
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={`Mark this order as manually refunded${buyerName ? ` (${buyerName})` : ""}`}
        className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border border-rose-300/40 text-rose-200 hover:bg-rose-900/20 transition-colors"
      >
        Marked refunded
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <p className="text-cream-dim/80 text-[11px] italic">
        Confirm you refunded {buyerName || "this buyer"} in PayPal?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={isPending}
          className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full bg-rose-900/40 hover:bg-rose-900/60 border border-rose-300/40 text-rose-100 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Yes, refunded"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-[11px] uppercase tracking-[0.18em] text-cream-dim px-2"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-rose-300 text-[10px] italic">{error}</p>}
    </div>
  );
}
