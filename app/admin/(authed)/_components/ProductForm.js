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
  salePrice: "",
  currency: "USD",
  stone: "Labradorite",
  description: "",
  fieldNote: "",
  cordType: "",
  depopUrl: "",
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

      <Field label='Cord / chain type (optional — defaults to: Adjustable cord, 17-19")'>
        <input
          type="text"
          value={form.cordType}
          onChange={(e) => update({ cordType: e.target.value })}
          placeholder='e.g. Waxed cotton cord, adjustable to 24"'
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <Field label="Sale price (optional — leave blank for no sale)">
        <div className="flex items-center gap-3">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.salePrice ?? ""}
            onChange={(e) => update({ salePrice: e.target.value })}
            placeholder={`< ${form.price || 0}`}
            className="flex-1 bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
          />
          <SalePreview price={form.price} salePrice={form.salePrice} />
        </div>
      </Field>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          required
          rows={10}
          placeholder={`A pale labradorite, wrapped in antique brass wire.\n\n- Hand-wrapped pendant\n- Antique copper-tone wire\n- Blue-green flash under direct light\n- Comes on a black cord`}
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream font-sans text-sm leading-relaxed"
        />
        <p className="text-cream-dim/60 text-[11px] italic mt-1 leading-snug">
          Formatting tips: blank line = new paragraph. Lines starting with{" "}
          <code className="bg-forest/60 px-1 rounded">-</code> become bullet
          points. Paragraphs + bullets can be mixed.
        </p>
      </Field>

      <Field label="Field note (personal 1-2 sentence)">
        <textarea
          value={form.fieldNote}
          onChange={(e) => update({ fieldNote: e.target.value })}
          rows={2}
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <Field label="Depop URL for this relic (optional)">
        <input
          type="url"
          value={form.depopUrl ?? ""}
          onChange={(e) => update({ depopUrl: e.target.value })}
          placeholder="https://www.depop.com/products/glitchydollhaus-…/"
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream text-sm"
        />
        <div className="flex items-center gap-3 mt-1">
          <p className="text-cream-dim/60 text-[11px] italic leading-snug flex-1">
            If left blank, the &quot;Shop on Depop&quot; button on the
            product page falls back to your shop-wide Depop URL.
          </p>
          {form.depopUrl && /^https:\/\/(www\.)?depop\.com\//i.test(form.depopUrl) && (
            <a
              href={form.depopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-labradorite-light hover:text-labradorite-glow shrink-0"
            >
              Open ↗
            </a>
          )}
        </div>
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

function SalePreview({ price, salePrice }) {
  const p = Number(price);
  const s = Number(salePrice);
  if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(p) || p <= 0) {
    return <span className="text-cream-dim/50 text-xs italic">no sale</span>;
  }
  if (s >= p) {
    return (
      <span className="text-rose-300 text-xs italic">
        must be &lt; ${p}
      </span>
    );
  }
  const pct = Math.round((1 - s / p) * 100);
  return (
    <span className="text-xs flex items-center gap-2 whitespace-nowrap">
      <span className="line-through text-cream-dim/60">${p.toFixed(2)}</span>
      <span className="text-rose-400 font-medium">${s.toFixed(2)}</span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-rose-300 border border-rose-300/40 px-1.5 py-0.5 rounded-full">
        {pct}% off
      </span>
    </span>
  );
}
