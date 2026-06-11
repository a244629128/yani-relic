"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetAllAnalytics } from "@/lib/analytics-actions";

const CONFIRM = "reset all analytics";

export default function ResetAllAnalyticsButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [isPending, startTransition] = useTransition();

  const doReset = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await resetAllAnalytics(phrase.trim());
        if (res.ok) {
          setDone({ deleted: res.deleted });
          setConfirming(false);
          setPhrase("");
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
        All analytics cleared — {done.deleted} event{done.deleted === 1 ? "" : "s"} removed.
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-rose-300/80 hover:text-rose-300 text-xs uppercase tracking-[0.22em]"
      >
        Reset all analytics…
      </button>
    );
  }

  return (
    <div className="bg-rose-900/15 border border-rose-300/30 rounded-md p-3 max-w-md">
      <p className="text-rose-100 text-sm mb-2">
        This permanently deletes <strong>every</strong> recorded event across
        all relics. The product catalog is not affected.
      </p>
      <p className="text-cream-dim/80 text-xs mb-2">
        Type <code className="bg-ink/40 px-1.5 py-0.5 rounded">{CONFIRM}</code> to confirm:
      </p>
      <input
        type="text"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={CONFIRM}
        className="w-full bg-forest/60 border border-rose-300/30 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-rose-300 mb-3"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={doReset}
          disabled={isPending || phrase.trim() !== CONFIRM}
          className="text-rose-100 bg-rose-700/40 hover:bg-rose-700/60 disabled:opacity-30 disabled:cursor-not-allowed text-xs uppercase tracking-[0.18em] px-3 py-1.5 rounded-full"
        >
          {isPending ? "Resetting…" : "Permanently reset all"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setPhrase("");
            setError("");
          }}
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
