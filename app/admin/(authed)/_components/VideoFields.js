"use client";

import { useRef, useState } from "react";
import { uploadFileDirect } from "@/lib/client-upload";

export default function VideoFields({ value, onChange }) {
  const v = value || { src: "", poster: "" };
  const [uploading, setUploading] = useState(null); // "video" | "poster" | null
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");

  const update = (patch) => onChange({ ...v, ...patch });
  const remove = () => {
    onChange(null);
    setError("");
  };

  const doUpload = async (kind, file) => {
    if (!file) return;
    setError("");
    setUploading(kind);
    try {
      const url = await uploadFileDirect(file, {
        onProgress: (label) => setProgressLabel(label),
      });
      update(kind === "video" ? { src: url } : { poster: url });
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(null);
      setProgressLabel("");
    }
  };

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange({ src: "", poster: "" })}
        className="btn-relic !py-2 !px-4 !text-[11px]"
      >
        + Add video
      </button>
    );
  }

  return (
    <div className="space-y-5 bg-forest/40 border border-parchment/15 rounded-md p-3">
      <DropZone
        kind="video"
        label="Video file (MP4 / MOV / WebM · 50MB max)"
        accept="video/mp4,video/quicktime,video/webm"
        currentUrl={v.src}
        onUrlChange={(src) => update({ src })}
        onUpload={(file) => doUpload("video", file)}
        uploading={uploading === "video"}
        progressLabel={progressLabel}
      />

      <DropZone
        kind="poster"
        label="Poster (still frame shown before play · defaults to first image)"
        accept="image/jpeg,image/png,image/webp,image/avif"
        currentUrl={v.poster}
        onUrlChange={(poster) => update({ poster })}
        onUpload={(file) => doUpload("poster", file)}
        uploading={uploading === "poster"}
        progressLabel={progressLabel}
      />

      {error && <p className="text-rose-300 text-xs italic">{error}</p>}

      <button
        type="button"
        onClick={remove}
        className="text-rose-300/80 hover:text-rose-300 text-xs uppercase tracking-[0.18em]"
      >
        Remove video
      </button>
    </div>
  );
}

function DropZone({
  kind,
  label,
  accept,
  currentUrl,
  onUrlChange,
  onUpload,
  uploading,
  progressLabel,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div>
      <label className="block text-cream-dim text-[10px] uppercase tracking-[0.18em] mb-1">
        {label}
      </label>
      {currentUrl && (
        <div className="mb-2 flex items-center gap-2 text-xs text-cream-dim/80">
          <span className="text-labradorite-light">✓</span>
          <span className="truncate flex-1">{currentUrl}</span>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-md border-2 border-dashed px-4 py-4 text-center transition-colors ${
          dragOver
            ? "border-labradorite-light bg-labradorite/10"
            : "border-parchment/30 hover:border-parchment/60"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
        <p className="text-cream-dim text-sm">
          {uploading
            ? progressLabel || "Uploading…"
            : currentUrl
            ? `Drag a new ${kind} here, or click to replace`
            : `Drag ${kind === "video" ? "video" : "image"} here, or click to choose`}
        </p>
      </div>
      <input
        type="text"
        value={currentUrl || ""}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="Or paste URL / path"
        className="w-full mt-2 bg-forest/50 border border-parchment/25 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
      />
    </div>
  );
}
