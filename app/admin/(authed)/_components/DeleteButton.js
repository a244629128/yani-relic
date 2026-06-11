"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/lib/products-actions";

export default function DeleteButton({ id, name }) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    setError("");
    if (typed.trim() !== name) {
      setError(`Type "${name}" exactly to confirm`);
      return;
    }
    startTransition(async () => {
      try {
        const res = await deleteProduct(id);
        if (res.ok) {
          router.push("/admin");
          router.refresh();
        } else {
          setError(res.error || "Delete failed");
        }
      } catch (err) {
        setError(err.message || "Delete failed");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDialog(true)}
        className="text-rose-300/80 hover:text-rose-300 text-xs uppercase tracking-[0.22em] underline-offset-4 hover:underline"
      >
        Delete this relic
      </button>

      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-ink/80 backdrop-blur-sm"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="card-relic p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-chancery text-cream text-3xl mb-3">
              Delete {name}?
            </h2>
            <p className="text-cream-dim text-sm mb-4">
              This permanently removes this relic. Type the relic&apos;s name to confirm.
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              autoFocus
              className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream mb-2"
            />
            {error && <p className="text-rose-300 text-xs mb-2">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="flex-1 text-cream-dim hover:text-cream border border-parchment/35 rounded-md px-4 py-2 text-xs uppercase tracking-[0.18em]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 text-cream bg-rose-700/80 hover:bg-rose-700 rounded-md px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
