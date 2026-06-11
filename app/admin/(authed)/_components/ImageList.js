"use client";

import Image from "next/image";
import { useState } from "react";
import { BLUR_DATA_URL } from "@/data/products";

export default function ImageList({ value = [], onChange }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    if (!draft.trim()) return;
    onChange([...value, draft.trim()]);
    setDraft("");
  };

  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));

  const move = (i, dir) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.map((src, i) => (
        <div
          key={i}
          className="flex items-center gap-2 bg-forest/40 border border-parchment/15 rounded-md p-2"
        >
          <div className="relative w-12 h-12 shrink-0 bg-ink/40 rounded-sm overflow-hidden">
            {src && (
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                unoptimized
              />
            )}
          </div>
          <input
            type="text"
            value={src}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="flex-1 bg-transparent text-cream text-sm border-none focus:outline-none min-w-0"
          />
          {i === 0 && (
            <span className="text-[9px] uppercase tracking-[0.18em] text-brass-light shrink-0">
              Hero
            </span>
          )}
          <button
            type="button"
            onClick={() => move(i, -1)}
            aria-label="Move up"
            className="text-cream-dim hover:text-labradorite-light px-1 disabled:opacity-30"
            disabled={i === 0}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(i, 1)}
            aria-label="Move down"
            className="text-cream-dim hover:text-labradorite-light px-1 disabled:opacity-30"
            disabled={i === value.length - 1}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove"
            className="text-rose-300/70 hover:text-rose-300 px-1"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          placeholder="/relics/your-photo.jpg"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
        <button type="button" onClick={add} className="btn-relic !py-2 !px-4 !text-[11px]">
          Add
        </button>
      </div>
      {value.length < 3 && (
        <p className="text-yellow-200/70 text-xs italic mt-1">
          Recommended: at least 3 images per product.
        </p>
      )}
    </div>
  );
}
