"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { BLUR_DATA_URL } from "@/data/products";
import { uploadFileDirect } from "@/lib/client-upload";

export default function ImageList({ value = [], onChange }) {
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

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

  const uploadFiles = async (files) => {
    setError("");
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setError("Only image files (JPG / PNG / WebP / AVIF) can be added here");
      return;
    }
    setUploading(true);
    const uploaded = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const url = await uploadFileDirect(list[i], {
          onProgress: (label) =>
            setProgressLabel(`${i + 1} of ${list.length} · ${label}`),
        });
        uploaded.push(url);
      } catch (err) {
        setError(`${list[i].name}: ${err.message || "Upload failed"}`);
      }
    }
    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
    }
    setUploading(false);
    setProgressLabel("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
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

      {/* Drag-drop + pick zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-md border-2 border-dashed px-4 py-5 text-center transition-colors ${
          dragOver
            ? "border-labradorite-light bg-labradorite/10"
            : "border-parchment/30 hover:border-parchment/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          hidden
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        <p className="text-cream-dim text-sm">
          {uploading ? progressLabel : "Drag photos here, or tap to choose files"}
        </p>
        <p className="text-cream-dim/60 text-xs mt-1">
          JPG / PNG / WebP · auto-resized to 1600px · 5MB max each
        </p>
      </div>

      {/* Optional: paste a URL for an externally-hosted image */}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          placeholder="Or paste a URL / path: /relics/your-photo.jpg"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
        <button type="button" onClick={add} className="btn-relic !py-2 !px-4 !text-[11px]">
          Add
        </button>
      </div>

      {error && <p className="text-rose-300 text-xs italic mt-1">{error}</p>}
      {value.length < 3 && (
        <p className="text-yellow-200/70 text-xs italic mt-1">
          Recommended: at least 3 images per product.
        </p>
      )}
    </div>
  );
}
