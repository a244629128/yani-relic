"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetProductAnalytics } from "@/lib/analytics-actions";

export default function ResetProductAnalyticsButton({ id, name }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { deleted: number }
  const [isPending, startTransition] = useTransition();

  const doReset = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await resetProductAnalytics(id);
        if (res.ok) {
          setDone({ deleted: res.deleted });
          setConfirming(false);
          router.refresh();
        } else {
          setError(res.error || "Reset failed");
        }
      } catch (err) {
        setError(err.message || "Reset failed");
      }
    });
  };

  if (done) {
    return (
      <p className="text-cream-dim text-xs italic">
        Reset complete — {done.deleted} event{done.deleted === 1 ? "" : "s"} cleared.
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-yellow-200/80 hover:text-yellow-200 text-xs uppercase tracking-[0.22em]"
      >
        Reset analytics for this relic
      </button>
    );
  }

  return (
    <div className="bg-yellow-900/15 border border-yellow-200/30 rounded-md p-3">
      <p className="text-yellow-100 text-sm mb-2">
        Delete all view + click + zoom events recorded for <strong>{name}</strong>?
      </p>
      <p className="text-cream-dim/70 text-xs italic mb-3">
        This only clears analytics data — the product itself is not affected.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={doReset}
          disabled={isPending}
          className="text-yellow-100 bg-yellow-700/40 hover:bg-yellow-700/60 disabled:opacity-50 text-xs uppercase tracking-[0.18em] px-3 py-1.5 rounded-full"
        >
          {isPending ? "Resetting…" : "Yes, reset"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-cream-dim text-xs uppercase tracking-[0.18em] px-3 py-1.5"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-rose-300 text-xs mt-2">{error}</p>}
    </div>
  );
}
