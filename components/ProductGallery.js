"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

/**
 * Product image + video gallery.
 *
 * Desktop  → big main media + thumbnail strip below. Click a thumb to switch.
 * Mobile   → swipe left/right on the main media. Prev/next arrows + dot
 *            indicators visible on both.
 * Keyboard → ← / → cycles when the gallery has focus.
 *
 * Videos use the VideoPlayer subcomponent (custom controls: progress bar,
 * time, mute, click-anywhere play/pause). Each video pauses + resets when
 * its slide becomes inactive.
 *
 * Props:
 *   media: { type: "image" | "video", src, poster? }[]
 *   images: legacy fallback if `media` not provided
 *   alt: accessible name for the active item
 */
export default function ProductGallery({ media, images = [], alt = "" }) {
  const items =
    Array.isArray(media) && media.length > 0
      ? media
      : images.map((src) => ({ type: "image", src }));

  const [active, setActive] = useState(0);
  const startX = useRef(null);
  const deltaX = useRef(0);

  // === Zoom state (touch devices) ===
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const pinchStart = useRef(null);
  const lastPan = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (active >= items.length) setActive(0);
  }, [items.length, active]);

  // Reset zoom when slide changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [active]);

  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setZoom((z) => (z === 1 ? 2 : 1));
      setPan({ x: 0, y: 0 });
    }
    lastTap.current = now;
  };

  const onZoomTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchStart.current = {
        distance: getTouchDistance(e.touches),
        zoom,
      };
    } else if (e.touches.length === 1 && zoom > 1) {
      lastPan.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    }
  };

  const onZoomTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const newDist = getTouchDistance(e.touches);
      const ratio = newDist / pinchStart.current.distance;
      const newZoom = Math.max(1, Math.min(3, pinchStart.current.zoom * ratio));
      setZoom(newZoom);
    } else if (e.touches.length === 1 && zoom > 1) {
      setPan({
        x: e.touches[0].clientX - lastPan.current.x,
        y: e.touches[0].clientY - lastPan.current.y,
      });
    }
  };

  const onZoomTouchEnd = () => {
    pinchStart.current = null;
    if (zoom < 1.1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const goPrev = () => setActive((i) => (i - 1 + items.length) % items.length);
  const goNext = () => setActive((i) => (i + 1) % items.length);

  useEffect(() => {
    if (items.length < 2) return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    deltaX.current = 0;
  };
  const onTouchMove = (e) => {
    if (startX.current === null) return;
    deltaX.current = e.touches[0].clientX - startX.current;
  };
  const onTouchEnd = () => {
    if (startX.current === null) return;
    const SWIPE = 40;
    if (deltaX.current > SWIPE) goPrev();
    else if (deltaX.current < -SWIPE) goNext();
    startX.current = null;
    deltaX.current = 0;
  };

  if (items.length === 0) {
    return (
      <div className="relative aspect-square bg-ink/40 flex items-center justify-center text-cream-dim italic font-serif">
        No media.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* === MAIN MEDIA === */}
      <div
        className="relative aspect-square overflow-hidden bg-ink/40 select-none"
        onTouchStart={(e) => {
          onZoomTouchStart(e);
          if (zoom === 1 && e.touches.length === 1) onTouchStart(e);
        }}
        onTouchMove={(e) => {
          onZoomTouchMove(e);
          if (zoom === 1 && e.touches.length === 1) onTouchMove(e);
        }}
        onTouchEnd={() => {
          onZoomTouchEnd();
          if (zoom === 1) onTouchEnd();
        }}
        onClick={handleDoubleTap}
      >
        {items.map((item, i) => (
          <div
            key={item.src + i}
            className={`absolute inset-0 transition-opacity duration-500 ${
              i === active ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-hidden={i !== active}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                transform:
                  i === active && (zoom !== 1 || pan.x !== 0 || pan.y !== 0)
                    ? `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`
                    : undefined,
                transformOrigin: "center",
                transition: pinchStart.current ? "none" : "transform 200ms ease-out",
              }}
            >
              {item.type === "video" ? (
                <VideoPlayer
                  src={item.src}
                  poster={item.poster}
                  isActive={i === active}
                />
              ) : (
                <Image
                  src={item.src}
                  alt={i === active ? alt : ""}
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 50vw, 100vw"
                  priority={i === 0}
                />
              )}
            </div>
          </div>
        ))}

        {items.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-forest/70 border border-parchment/30 text-parchment hover:text-labradorite-light hover:border-parchment/60 backdrop-blur-sm flex items-center justify-center transition-colors z-20"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 2 L 4 7 L 9 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={goNext}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-forest/70 border border-parchment/30 text-parchment hover:text-labradorite-light hover:border-parchment/60 backdrop-blur-sm flex items-center justify-center transition-colors z-20"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 2 L 10 7 L 5 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {/* Slide dots — moved above video controls strip so they don't clash */}
        {items.length > 1 && (
          <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-2 pointer-events-none z-10">
            {items.map((_, i) => (
              <span
                key={i}
                className={`block w-1.5 h-1.5 rounded-full transition-all ${
                  i === active ? "bg-labradorite-light w-5" : "bg-parchment/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* === THUMBNAIL STRIP (desktop) === */}
      {items.length > 1 && (
        <div className="hidden md:flex gap-2 mt-3 px-1">
          {items.map((item, i) => (
            <button
              key={item.src + i}
              onClick={() => setActive(i)}
              aria-label={`Show ${item.type} ${i + 1}`}
              aria-current={i === active}
              className={`relative w-16 h-16 lg:w-20 lg:h-20 overflow-hidden rounded-sm transition-all ${
                i === active
                  ? "ring-1 ring-labradorite-light brightness-100"
                  : "ring-1 ring-parchment/15 brightness-75 hover:brightness-100 hover:ring-parchment/40"
              }`}
            >
              <Image
                src={item.type === "video" ? item.poster || item.src : item.src}
                alt=""
                fill
                className="object-cover"
                sizes="80px"
              />
              {item.type === "video" && (
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center bg-ink/40"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="rgba(232,230,210,0.95)">
                    <path d="M5 3 L 17 10 L 5 17 Z" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * VideoPlayer — bare <video> + custom controls strip.
 *
 *   - Click anywhere on the video → toggle play / pause
 *   - Center play button overlay when paused
 *   - Always-visible bottom strip: progress bar (clickable to seek),
 *     play/pause button, time (mm:ss / mm:ss), mute toggle
 *   - Auto-plays muted when slide becomes active; pauses + rewinds on leave
 * ============================================================ */
function VideoPlayer({ src, poster, isActive }) {
  const ref = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sync playback to slide active state
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isActive) {
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive]);

  // Wire video events → React state
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onLoad = () => setDuration(v.duration || 0);
    const onVol = () => setIsMuted(v.muted);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onLoad);
    v.addEventListener("durationchange", onLoad);
    v.addEventListener("volumechange", onVol);
    if (v.readyState >= 1 && v.duration) setDuration(v.duration);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onLoad);
      v.removeEventListener("durationchange", onLoad);
      v.removeEventListener("volumechange", onVol);
    };
  }, []);

  const togglePlay = (e) => {
    e?.stopPropagation();
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const seek = (e) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative w-full h-full">
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        onClick={togglePlay}
        className="w-full h-full object-cover bg-ink/40 cursor-pointer"
      />

      {/* Center play button — only when paused */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center bg-ink/30 backdrop-blur-[1px] transition-opacity"
        >
          <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-forest/85 border border-parchment/50 backdrop-blur-sm flex items-center justify-center shadow-[0_0_24px_rgba(0,0,0,0.5)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(232,230,210,0.95)">
              <path d="M6 4 L 20 12 L 6 20 Z" />
            </svg>
          </span>
        </button>
      )}

      {/* Bottom controls strip — always visible */}
      <div
        className="absolute left-0 right-0 bottom-0 px-3 pb-2 pt-8 z-10"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(13, 22, 17, 0.65) 55%, rgba(13, 22, 17, 0.92) 100%)",
          pointerEvents: "none",
        }}
      >
        {/* Progress bar */}
        <div
          onClick={seek}
          className="relative h-1.5 bg-parchment/20 rounded-full cursor-pointer group/seek mb-2"
          style={{ pointerEvents: "auto" }}
          aria-label="Seek"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(currentTime)}
        >
          <div
            className="h-full bg-labradorite-light rounded-full transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-labradorite-light opacity-0 group-hover/seek:opacity-100 transition-opacity shadow-[0_0_6px_rgba(63,143,145,0.6)]"
            style={{ left: `calc(${pct}% - 6px)` }}
          />
        </div>

        {/* Play + time + mute */}
        <div
          className="flex items-center justify-between text-parchment"
          style={{ pointerEvents: "auto" }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="hover:text-labradorite-light transition-colors p-0.5"
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="3" y="2" width="3" height="10" />
                  <rect x="8" y="2" width="3" height="10" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M3 2 L 12 7 L 3 12 Z" />
                </svg>
              )}
            </button>
            <span
              className="tabular-nums text-[11px] text-parchment/80"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="hover:text-labradorite-light transition-colors p-1"
          >
            {isMuted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9 L 3 15 L 7 15 L 12 20 L 12 4 L 7 9 Z" />
                <line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9 L 3 15 L 7 15 L 12 20 L 12 4 L 7 9 Z" />
                <path d="M 16 8 Q 19 12 16 16" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path d="M 18 5 Q 23 12 18 19" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
