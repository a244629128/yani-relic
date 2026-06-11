"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkApplyDiscount, clearAllSales } from "@/lib/products-actions";

/**
 * Shown at the top of /admin (the relics list). Lets the owner apply a
 * single % discount across every available relic in one click, or clear
 * all sales in one click.
 *
 * Bulk apply OVERWRITES individual per-product sale prices (per user's
 * choice). Sold items are not touched in either direction — sale_price
 * on a sold item is preserved as a historical record.
 */
export default function BulkSalePanel({ activeSalesCount = 0 }) {
  const router = useRouter();
  const [percent, setPercent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState(null); // 'apply' | 'clear' | null
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setError("");
    setSuccess("");
    setConfirming(null);
  };

  const handleApply = () => {
    reset();
    const p = Number(percent);
    if (!Number.isInteger(p) || p < 1 || p > 99) {
      setError("Enter a whole number between 1 and 99.");
      return;
    }
    setConfirming("apply");
  };

  const doApply = () => {
    startTransition(async () => {
      try {
        const res = await bulkApplyDiscount(Number(percent));
        if (res.ok) {
          setSuccess(`Applied ${percent}% off to ${res.updated} relic${res.updated === 1 ? "" : "s"}.`);
          setPercent("");
          setConfirming(null);
          router.refresh();
        } else {
          setError(res.error || "Bulk apply failed");
          setConfirming(null);
        }
      } catch (err) {
        setError(err.message || "Bulk apply failed");
        setConfirming(null);
      }
    });
  };

  const handleClear = () => {
    reset();
    setConfirming("clear");
  };

  const doClear = () => {
    startTransition(async () => {
      try {
        const res = await clearAllSales();
        if (res.ok) {
          setSuccess(
            res.cleared === 0
              ? "Nothing to clear — no relics were on sale."
              : `Cleared sale prices on ${res.cleared} relic${res.cleared === 1 ? "" : "s"}.`
          );
          setConfirming(null);
          router.refresh();
        } else {
          setError(res.error || "Clear failed");
          setConfirming(null);
        }
      } catch (err) {
        setError(err.message || "Clear failed");
        setConfirming(null);
      }
    });
  };

  return (
    <div className="mb-6 rounded-md border border-rose-300/30 bg-rose-900/10 p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-chancery text-cream text-2xl">Bulk sale</h2>
        {activeSalesCount > 0 && (
          <span className="text-[11px] uppercase tracking-[0.18em] text-rose-300">
            {activeSalesCount} relic{activeSalesCount === 1 ? "" : "s"} on sale
          </span>
        )}
      </div>

      {confirming === "apply" ? (
        <div>
          <p className="text-cream/90 text-sm mb-3">
            Apply <strong className="text-rose-300">{percent}% off</strong> to every available
            relic? This overwrites any individual sale prices already set.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doApply}
              disabled={isPending}
              className="text-[11px] uppercase tracking-[0.18em] px-4 py-2 rounded-full bg-rose-700/50 hover:bg-rose-700/70 border border-rose-300/40 text-cream disabled:opacity-50"
            >
              {isPending ? "Applying…" : "Yes, apply"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={isPending}
              className="text-[11px] uppercase tracking-[0.18em] text-cream-dim px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : confirming === "clear" ? (
        <div>
          <p className="text-cream/90 text-sm mb-3">
            Remove sale prices on <strong>all relics</strong>? Strikethrough
            prices + sale badges will disappear from the site. (Original prices
            stay unchanged.)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doClear}
              disabled={isPending}
              className="text-[11px] uppercase tracking-[0.18em] px-4 py-2 rounded-full bg-rose-700/50 hover:bg-rose-700/70 border border-rose-300/40 text-cream disabled:opacity-50"
            >
              {isPending ? "Clearing…" : "Yes, clear all sales"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={isPending}
              className="text-[11px] uppercase tracking-[0.18em] text-cream-dim px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="1–99"
              className="w-24 bg-forest/50 border border-parchment/30 rounded-md pl-3 pr-7 py-2 text-cream focus:outline-none focus:border-rose-300"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-dim text-sm pointer-events-none">
              %
            </span>
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={isPending}
            className="text-[11px] uppercase tracking-[0.18em] px-4 py-2 rounded-full bg-rose-700/40 hover:bg-rose-700/60 border border-rose-300/40 text-cream disabled:opacity-50"
          >
            Apply % off to all available
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="text-[11px] uppercase tracking-[0.18em] px-4 py-2 rounded-full border border-cream-dim/30 text-cream-dim hover:text-cream hover:border-cream-dim/60 disabled:opacity-50"
          >
            Clear all sales
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-rose-300 text-xs italic">{error}</p>}
      {success && <p className="mt-3 text-labradorite-light text-xs italic">{success}</p>}
    </div>
  );
}
