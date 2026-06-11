"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markOrderSold } from "@/lib/paypal-actions";

export default function MarkSoldButton({ orderId, productName }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onClick = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await markOrderSold(orderId);
        if (res.ok) {
          setDone(true);
          router.refresh();
        } else {
          setError(res.error || "Failed to mark sold");
        }
      } catch (err) {
        setError(err.message || "Failed");
      }
    });
  };

  if (done) {
    return (
      <span className="text-labradorite-light text-[11px] uppercase tracking-[0.18em]">
        ✓ Marked sold
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        title={`Mark "${productName}" as sold across the site`}
        className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full bg-labradorite/30 hover:bg-labradorite/50 border border-labradorite-light/40 text-cream disabled:opacity-50"
      >
        {isPending ? "Marking…" : "Mark sold"}
      </button>
      {error && <p className="text-rose-300 text-[10px] italic">{error}</p>}
    </div>
  );
}
