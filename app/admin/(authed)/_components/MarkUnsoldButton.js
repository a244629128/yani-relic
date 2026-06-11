"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markOrderUnsold } from "@/lib/paypal-actions";

/**
 * Inverse of MarkSoldButton. Shown when an order's product is currently
 * marked sold=true. Clicking it flips the product back to available
 * (and clears the order's sold_marked tracker). Useful when an order
 * was refunded / cancelled and the relic should re-list.
 *
 * Confirmation step prevents accidentally relisting a piece that was
 * actually shipped.
 */
export default function MarkUnsoldButton({ orderId, productName }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onClick = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await markOrderUnsold(orderId);
        if (res.ok) {
          setDone(true);
          router.refresh();
        } else {
          setError(res.error || "Failed to mark unsold");
        }
      } catch (err) {
        setError(err.message || "Failed");
      }
    });
  };

  if (done) {
    return (
      <span className="text-yellow-200 text-[11px] uppercase tracking-[0.18em]">
        ✓ Re-listed as available
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={`Re-list "${productName}" as available`}
        className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full bg-yellow-700/30 hover:bg-yellow-700/50 border border-yellow-200/40 text-yellow-100 disabled:opacity-50"
      >
        Mark unsold
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <p className="text-cream-dim/80 text-[11px] italic">
        Re-list <strong>{productName}</strong> as available? Make sure you&apos;ve
        refunded the buyer in PayPal first.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={isPending}
          className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full bg-yellow-700/50 hover:bg-yellow-700/70 border border-yellow-200/40 text-yellow-100 disabled:opacity-50"
        >
          {isPending ? "Updating…" : "Yes, re-list"}
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
