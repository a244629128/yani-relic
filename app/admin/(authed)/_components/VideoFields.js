"use client";

import { useRef, useState } from "react";
import { uploadMediaFile } from "@/lib/products-actions";

export default function VideoFields({ value, onChange }) {
  const v = value || { src: "", poster: "" };
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const videoInputRef = useRef(null);
  const posterInputRef = useRef(null);

  const update = (patch) => onChange({ ...v, ...patch });
  const remove = () => {
    onChange(null);
    setError("");
  };

  const uploadVideo = async (file) => {
    if (!file) return;
    setError("");
    setUploading(true);
    setProgressLabel("Uploading video…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadMediaFile(fd);
      if (res.ok) update({ src: res.url });
      else setError(res.error || "Upload failed");
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgressLabel("");
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const uploadPoster = async (file) => {
    if (!file) return;
    setError("");
    setUploading(true);
    setProgressLabel("Uploading poster…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadMediaFile(fd);
      if (res.ok) update({ poster: res.url });
      else setError(res.error || "Upload failed");
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgressLabel("");
      if (posterInputRef.current) posterInputRef.current.value = "";
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
    <div className="space-y-4 bg-forest/40 border border-parchment/15 rounded-md p-3">
      {/* Video source */}
      <div>
        <label className="block text-cream-dim text-[10px] uppercase tracking-[0.18em] mb-1">
          Video file (MP4 / MOV / WebM · 20MB max)
        </label>
        {v.src && (
          <div className="mb-2 flex items-center gap-2 text-xs text-cream-dim/80">
            <span className="text-labradorite-light">✓</span>
            <span className="truncate flex-1">{v.src}</span>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading}
            className="btn-relic !py-2 !px-4 !text-[11px] disabled:opacity-50"
          >
            {uploading && progressLabel.includes("video") ? progressLabel : v.src ? "Replace" : "Upload video"}
          </button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            hidden
            onChange={(e) => uploadVideo(e.target.files?.[0])}
          />
        </div>
        <input
          type="text"
          value={v.src}
          onChange={(e) => update({ src: e.target.value })}
          placeholder="Or paste URL / path"
          className="w-full mt-2 bg-forest/50 border border-parchment/25 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
      </div>

      {/* Poster */}
      <div>
        <label className="block text-cream-dim text-[10px] uppercase tracking-[0.18em] mb-1">
          Poster (still frame shown before play · 5MB max · defaults to first image)
        </label>
        {v.poster && (
          <div className="mb-2 flex items-center gap-2 text-xs text-cream-dim/80">
            <span className="text-labradorite-light">✓</span>
            <span className="truncate flex-1">{v.poster}</span>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => posterInputRef.current?.click()}
            disabled={uploading}
            className="btn-relic !py-2 !px-4 !text-[11px] disabled:opacity-50"
          >
            {uploading && progressLabel.includes("poster") ? progressLabel : v.poster ? "Replace" : "Upload poster"}
          </button>
          <input
            ref={posterInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            hidden
            onChange={(e) => uploadPoster(e.target.files?.[0])}
          />
        </div>
        <input
          type="text"
          value={v.poster || ""}
          onChange={(e) => update({ poster: e.target.value })}
          placeholder="Or paste URL / path"
          className="w-full mt-2 bg-forest/50 border border-parchment/25 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
      </div>

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
