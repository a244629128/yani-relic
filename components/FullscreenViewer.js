"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-screen media lightbox for mobile.
 *
 *   - Renders above any modal at z-[70]
 *   - Pinch (two-finger) zoom 1x..4x on images
 *   - Double-tap to toggle 1x ↔ 2x
 *   - Pan when zoomed
 *   - Horizontal swipe between images (when zoom === 1)
 *   - Vertical swipe-down to dismiss (drag the image down past threshold)
 *   - × button in top-right + Escape key
 *   - Videos: autoplay muted with native HTML5 controls (pinch zoom disabled)
 *
 * Props:
 *   media: { type, src, poster? }[]
 *   startIndex: number (which media slot to open at)
 *   alt: string (accessible name)
 *   onClose: () => void
 */
export default function FullscreenViewer({ media = [], startIndex = 0, alt = "", onClose }) {
  const items = media.filter(Boolean);
  const [active, setActive] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragY, setDragY] = useState(0);

  const touchStart = useRef(null);
  const lastTap = useRef(0);
  const isPinching = useRef(false);
  const isPanning = useRef(false);
  const isHorizontalSwipe = useRef(false);
  const lastPanStart = useRef(null);

  const current = items[active];

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragY(0);
  }, [active]);

  // Body scroll lock — ProductDetail may also have one set. Save and restore.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowLeft" && zoom === 1) goPrev();
      else if (e.key === "ArrowRight" && zoom === 1) goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, onClose]);

  const goPrev = () => setActive((i) => (i - 1 + items.length) % items.length);
  const goNext = () => setActive((i) => (i + 1) % items.length);

  const getDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      isPinching.current = true;
      touchStart.current = { distance: getDist(e.touches), zoom };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      if (zoom > 1) {
        isPanning.current = true;
        lastPanStart.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
      } else {
        touchStart.current = { x: t.clientX, y: t.clientY };
        isHorizontalSwipe.current = false;
      }
    }
  };

  const onTouchMove = (e) => {
    if (isPinching.current && e.touches.length === 2) {
      const newDist = getDist(e.touches);
      const ratio = newDist / touchStart.current.distance;
      const newZoom = Math.max(1, Math.min(4, touchStart.current.zoom * ratio));
      setZoom(newZoom);
    } else if (isPanning.current && e.touches.length === 1) {
      const t = e.touches[0];
      setPan({ x: t.clientX - lastPanStart.current.x, y: t.clientY - lastPanStart.current.y });
    } else if (touchStart.current && e.touches.length === 1 && zoom === 1) {
      const t = e.touches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      // Lock direction once we cross a small threshold
      if (!isHorizontalSwipe.current && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        // vertical drag → dismiss preview
        if (dy > 0) setDragY(dy);
      } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isHorizontalSwipe.current = true;
      }
    }
  };

  const onTouchEnd = (e) => {
    if (isPinching.current) {
      isPinching.current = false;
      if (zoom < 1.1) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      return;
    }
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    if (touchStart.current && zoom === 1) {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      const SWIPE = 50;
      // Swipe-down to dismiss
      if (dy > 100 && Math.abs(dy) > Math.abs(dx)) {
        onClose?.();
        return;
      }
      // Horizontal nav
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE && items.length > 1) {
        if (dx > 0) goPrev();
        else goNext();
      }
      setDragY(0);
      touchStart.current = null;
    }
  };

  // Single tap vs double tap (only for images; video has its own controls)
  const onClick = () => {
    if (current?.type === "video") return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double-tap → toggle zoom
      setZoom((z) => (z === 1 ? 2 : 1));
      setPan({ x: 0, y: 0 });
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  if (items.length === 0 || !current) return null;

  const opacity = Math.max(0.2, 1 - dragY / 600);
  const moving = isPinching.current || isPanning.current || dragY !== 0;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black select-none"
      style={{ opacity }}
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen media viewer"
    >
      <button
        onClick={onClose}
        aria-label="Close fullscreen"
        className="absolute right-3 z-10 w-11 h-11 rounded-full bg-forest/85 border border-parchment/30 text-parchment flex items-center justify-center backdrop-blur-sm"
        style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClick}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y + dragY}px) scale(${zoom})`,
            transformOrigin: "center",
            transition: moving ? "none" : "transform 220ms ease-out",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {current.type === "video" ? (
            <video
              key={current.src}
              src={current.src}
              poster={current.poster}
              autoPlay
              muted
              playsInline
              loop
              controls
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          ) : (
            // Plain <img> instead of next/image — we want native object-fit:contain
            // behavior and avoid Next's wrapping layout that fights with our transform.
            <img
              src={current.src}
              alt={alt}
              draggable={false}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                userSelect: "none",
                WebkitUserDrag: "none",
              }}
            />
          )}
        </div>
      </div>

      {/* Dot indicators */}
      {items.length > 1 && (
        <div
          className="absolute left-0 right-0 flex justify-center gap-2 pointer-events-none"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          {items.map((_, i) => (
            <span
              key={i}
              className={`block h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-labradorite-light" : "w-1.5 bg-parchment/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* Hint text — fades when user starts interacting */}
      {items.length > 1 && zoom === 1 && dragY === 0 && (
        <p
          className="absolute left-0 right-0 text-center text-[10px] uppercase tracking-[0.22em] text-parchment/40 pointer-events-none"
          style={{ bottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
        >
          swipe · pinch · swipe down to close
        </p>
      )}
    </div>
  );
}
