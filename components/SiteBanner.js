"use client";

import { useEffect, useState } from "react";

// Two short single-line messages that crossfade every 4s. Both messages
// occupy the same fixed-height slot to prevent CLS. Pauses on
// pointer/touch. Respects prefers-reduced-motion (no auto-rotate; first
// message stays visible).
const MESSAGES = [
  { label: "Free shipping on orders", emphasis: "$45+" },
  { label: "Ships within", emphasis: "24 hours" },
];

const ROTATE_MS = 4000;

export default function SiteBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused || MESSAGES.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <div
      className="sticky top-0 z-[45] w-full h-11 sm:h-14"
      style={{
        background:
          "linear-gradient(180deg, #101714 0%, #0d1611 100%)",
        borderBottom: "1px solid rgba(216, 199, 170, 0.12)",
      }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4 h-full flex items-center justify-center gap-3 sm:gap-4">
        <SparkleMark />
        <div className="relative h-full flex items-center" style={{ minWidth: 0 }}>
          {MESSAGES.map((m, i) => (
            <p
              key={i}
              className="absolute inset-0 flex items-center justify-center gap-2 sm:gap-2.5 text-parchment uppercase font-serif transition-opacity duration-500"
              style={{
                fontSize: "clamp(11px, 0.95vw, 15px)",
                letterSpacing: "0.18em",
                fontWeight: 500,
                whiteSpace: "nowrap",
                opacity: i === index ? 1 : 0,
              }}
              aria-hidden={i !== index}
            >
              <span>{m.label}</span>
              <span
                className="font-chancery"
                style={{
                  color: "#b59a68",
                  fontSize: "clamp(22px, 2vw, 30px)",
                  letterSpacing: "0",
                  textTransform: "none",
                  lineHeight: 1,
                }}
              >
                {m.emphasis}
              </span>
            </p>
          ))}
        </div>
        <SparkleMark />
      </div>
    </div>
  );
}

function SparkleMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0">
      <path
        d="M5 0 L 6 4 L 10 5 L 6 6 L 5 10 L 4 6 L 0 5 L 4 4 Z"
        fill="rgba(181, 154, 104, 0.8)"
      />
    </svg>
  );
}
