"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ImageList from "./ImageList";
import VideoFields from "./VideoFields";
import { saveProduct } from "@/lib/products-actions";

const EMPTY = {
  id: "",
  name: "",
  price: 0,
  currency: "USD",
  stone: "Labradorite",
  description: "",
  fieldNote: "",
  cordType: "",
  aspectRatio: 1.0,
  sold: false,
  featured: false,
  images: [],
  video: null,
};

export default function ProductForm({ initial, isNew }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    startTransition(async () => {
      try {
        const res = await saveProduct(form);
        if (res.ok) {
          // Return to /admin after save
          router.push("/admin");
          router.refresh();
        } else {
          setError(res.error || "Save failed");
        }
      } catch (err) {
        setError(err.message || "Save failed");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-3xl">
      <Field label="ID">
        <input
          type="text"
          value={form.id}
          onChange={(e) => update({ id: e.target.value })}
          disabled={!isNew}
          placeholder="r-09"
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream disabled:opacity-50"
        />
      </Field>

      <Field label="Name">
        <input
          type="text"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          required
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price (USD)">
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => update({ price: Number(e.target.value) })}
            required
            className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
          />
        </Field>
        <Field label="Stone">
          <input
            type="text"
            value={form.stone}
            onChange={(e) => update({ stone: e.target.value })}
            className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          required
          rows={4}
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <Field label="Field note (personal 1-2 sentence)">
        <textarea
          value={form.fieldNote}
          onChange={(e) => update({ fieldNote: e.target.value })}
          rows={2}
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-cream cursor-pointer">
          <input
            type="checkbox"
            checked={form.sold}
            onChange={(e) => update({ sold: e.target.checked })}
            className="w-4 h-4"
          />
          Sold
        </label>
        <label className="flex items-center gap-2 text-cream cursor-pointer">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => update({ featured: e.target.checked })}
            className="w-4 h-4"
          />
          Featured
          <span className="text-cream-dim/60 text-[10px] italic">(reserved — not user-visible yet)</span>
        </label>
      </div>

      <Field label="Images (3-5 recommended)">
        <ImageList value={form.images} onChange={(images) => update({ images })} />
      </Field>

      <Field label="Video (optional)">
        <VideoFields value={form.video} onChange={(video) => update({ video })} />
      </Field>

      <div
        className="sticky bottom-0 -mx-4 sm:-mx-6 mt-8 px-4 sm:px-6 py-3 bg-forest/95 border-t border-parchment/15 backdrop-blur-sm flex items-center justify-between gap-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {error && <span className="text-rose-300 text-xs flex-1">{error}</span>}
        {success && (
          <span className="text-labradorite-glow text-xs flex-1">Saved ✓</span>
        )}
        {!error && !success && <span className="flex-1" />}
        <button
          type="submit"
          disabled={isPending}
          className="btn-relic disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-cream-dim text-[10px] uppercase tracking-[0.22em] mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
