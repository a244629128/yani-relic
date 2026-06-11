"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Full-screen media lightbox — works on both mobile and desktop.
 *
 * Mobile:
 *   - Pinch (two-finger) zoom 1x..4x on images
 *   - Double-tap to toggle 1x ↔ 2x
 *   - Single-finger pan when zoomed
 *   - Horizontal swipe between items (when zoom === 1)
 *   - Vertical swipe-down to dismiss
 *
 * Desktop:
 *   - Mouse wheel (or trackpad scroll) → zoom in/out at cursor
 *   - Click-drag to pan when zoomed
 *   - Double-click to toggle 1x ↔ 2x
 *   - + / - / 0 keys → zoom in / out / reset
 *   - ← / → arrows → previous / next (when zoom === 1)
 *   - Esc to close
 *   - Visible zoom controls (+ − ⟳) in top-left for discoverability
 *
 * Videos always render with native HTML5 controls (zoom is suppressed for them).
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
  const [isDragging, setIsDragging] = useState(false);

  // Touch refs
  const touchStart = useRef(null);
  const lastTap = useRef(0);
  const isPinching = useRef(false);
  const isPanning = useRef(false);
  const isHorizontalSwipe = useRef(false);
  const lastPanStart = useRef(null);

  // Mouse refs
  const mouseDown = useRef(null);
  const lastClickTime = useRef(0);

  const current = items[active];
  const isVideo = current?.type === "video";

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragY(0);
  }, [active]);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const goPrev = useCallback(
    () => setActive((i) => (i - 1 + items.length) % items.length),
    [items.length]
  );
  const goNext = useCallback(
    () => setActive((i) => (i + 1) % items.length),
    [items.length]
  );

  const zoomBy = useCallback((delta) => {
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowLeft" && zoom === 1) goPrev();
      else if (e.key === "ArrowRight" && zoom === 1) goNext();
      else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(0.5);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(-0.5);
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, onClose, goPrev, goNext, zoomBy, resetZoom]);

  // ============ TOUCH ============
  const getDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e) => {
    if (isVideo) return;
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
    if (isVideo) return;
    if (isPinching.current && e.touches.length === 2) {
      const newDist = getDist(e.touches);
      const ratio = newDist / touchStart.current.distance;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchStart.current.zoom * ratio));
      setZoom(newZoom);
    } else if (isPanning.current && e.touches.length === 1) {
      const t = e.touches[0];
      setPan({ x: t.clientX - lastPanStart.current.x, y: t.clientY - lastPanStart.current.y });
    } else if (touchStart.current && e.touches.length === 1 && zoom === 1) {
      const t = e.touches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      if (!isHorizontalSwipe.current && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
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
      if (dy > 100 && Math.abs(dy) > Math.abs(dx)) {
        onClose?.();
        return;
      }
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE && items.length > 1) {
        if (dx > 0) goPrev();
        else goNext();
      }
      setDragY(0);
      touchStart.current = null;
    }
  };

  // ============ MOUSE (desktop) ============
  const onMouseDown = (e) => {
    if (isVideo) return;
    // Only react to primary mouse button
    if (e.button !== 0) return;
    if (zoom > 1) {
      // Start pan
      mouseDown.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
      };
      setIsDragging(true);
      e.preventDefault();
    } else {
      // Track for click vs. drag (in case user tries to drag without zoom)
      mouseDown.current = { startX: e.clientX, startY: e.clientY, moved: false };
    }
  };

  const onMouseMove = (e) => {
    if (!mouseDown.current) return;
    const dx = e.clientX - mouseDown.current.startX;
    const dy = e.clientY - mouseDown.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mouseDown.current.moved = true;
    if (zoom > 1 && mouseDown.current.panX !== undefined) {
      setPan({
        x: mouseDown.current.panX + dx,
        y: mouseDown.current.panY + dy,
      });
    }
  };

  const onMouseUp = (e) => {
    if (!mouseDown.current) return;
    const moved = mouseDown.current.moved;
    mouseDown.current = null;
    setIsDragging(false);
    // If user didn't drag (clean click), handle as click for double-click zoom toggle
    if (!moved && !isVideo) {
      const now = Date.now();
      if (now - lastClickTime.current < 300) {
        // Double-click → toggle zoom (centered on cursor on zoom-in)
        if (zoom === 1) {
          setZoom(2);
          // Center the cursor location
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = e.clientX - rect.left - rect.width / 2;
          const cy = e.clientY - rect.top - rect.height / 2;
          setPan({ x: -cx, y: -cy });
        } else {
          resetZoom();
        }
        lastClickTime.current = 0;
      } else {
        lastClickTime.current = now;
      }
    }
  };

  const onWheel = (e) => {
    if (isVideo) return;
    e.preventDefault();
    // Negative deltaY = scroll up = zoom in
    const factor = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + factor));
      if (next <= 1.001) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  };

  // Attach a non-passive wheel listener so preventDefault works.
  const surfaceRef = useRef(null);
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const handler = (e) => onWheel(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideo]);

  if (items.length === 0 || !current) return null;

  const opacity = Math.max(0.2, 1 - dragY / 600);
  const moving = isPinching.current || isPanning.current || isDragging || dragY !== 0;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black select-none"
      style={{ opacity }}
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen media viewer"
    >
      {/* Close — top-right */}
      <button
        onClick={onClose}
        aria-label="Close fullscreen"
        className="absolute right-3 z-20 w-11 h-11 rounded-full bg-forest/85 border border-parchment/30 text-parchment hover:text-labradorite-light hover:border-parchment/60 flex items-center justify-center backdrop-blur-sm transition-colors"
        style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
        </svg>
      </button>

      {/* Desktop zoom controls — top-left, hidden on touch-only devices via media query */}
      {!isVideo && (
        <div
          className="absolute left-3 z-20 hidden md:flex items-center gap-1 bg-forest/85 border border-parchment/30 rounded-full backdrop-blur-sm p-1"
          style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            onClick={() => zoomBy(-0.5)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="w-9 h-9 rounded-full text-parchment hover:text-labradorite-light disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <line x1="3" y1="8" x2="13" y2="8" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-parchment/80 text-[11px] tabular-nums px-1 min-w-[36px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(0.5)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="w-9 h-9 rounded-full text-parchment hover:text-labradorite-light disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <line x1="3" y1="8" x2="13" y2="8" strokeLinecap="round" />
              <line x1="8" y1="3" x2="8" y2="13" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={resetZoom}
            disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
            aria-label="Reset zoom"
            className="w-9 h-9 rounded-full text-parchment hover:text-labradorite-light disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 4 A 5 5 0 1 1 2 9" strokeLinecap="round" />
              <path d="M2 1 L 2 4 L 5 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Desktop prev/next arrows — visible only on md+ */}
      {items.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Previous"
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-forest/85 border border-parchment/30 text-parchment hover:text-labradorite-light hover:border-parchment/60 backdrop-blur-sm items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M9 2 L 4 7 L 9 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={goNext}
            aria-label="Next"
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-forest/85 border border-parchment/30 text-parchment hover:text-labradorite-light hover:border-parchment/60 backdrop-blur-sm items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M5 2 L 10 7 L 5 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}

      <div
        ref={surfaceRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{
          touchAction: "none",
          cursor: isVideo
            ? "default"
            : zoom > 1
            ? isDragging
              ? "grabbing"
              : "grab"
            : "zoom-in",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
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
            willChange: "transform",
          }}
        >
          {isVideo ? (
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
          className="absolute left-0 right-0 flex justify-center gap-2 pointer-events-none z-10"
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

      {/* Hint text */}
      {items.length > 1 && zoom === 1 && dragY === 0 && (
        <p
          className="absolute left-0 right-0 text-center text-[10px] uppercase tracking-[0.22em] text-parchment/40 pointer-events-none z-10"
          style={{ bottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
        >
          <span className="md:hidden">swipe · pinch · swipe down to close</span>
          <span className="hidden md:inline">
            scroll to zoom · drag to pan · ← → to navigate · esc to close
          </span>
        </p>
      )}
    </div>
  );
}
