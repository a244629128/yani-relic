"use client";

import { useEffect, useRef, useState } from "react";

const EMIT_INTERVAL_MS = 45; // throttle: max ~22 sparkles/sec
const MIN_PIXEL_GAP = 14; // skip if cursor barely moved
const PARTICLE_TTL_MS = 1100; // total visible lifetime
const MAX_CONCURRENT = 28; // safety cap
const STAR_CHANCE = 0.55; // rest are round twinkles

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export default function CursorSparkleTrail() {
  const [particles, setParticles] = useState([]);
  const idRef = useRef(0);
  const lastEmitRef = useRef(0);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const isCoarseRef = useRef(false);

  useEffect(() => {
    // No-op on touch-primary devices (no real cursor)
    if (typeof window === "undefined") return;
    isCoarseRef.current =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (isCoarseRef.current) return;

    const onMove = (e) => {
      const now = performance.now();
      if (now - lastEmitRef.current < EMIT_INTERVAL_MS) return;
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      if (dx * dx + dy * dy < MIN_PIXEL_GAP * MIN_PIXEL_GAP) return;

      lastEmitRef.current = now;
      lastPosRef.current = { x: e.clientX, y: e.clientY };

      const id = ++idRef.current;
      const newP = {
        id,
        x: e.clientX + rand(-4, 4),
        y: e.clientY + rand(-4, 4),
        size: rand(5, 11),
        rotate: rand(-30, 30),
        drift: rand(-12, 12),
        rise: rand(8, 22),
        isStar: Math.random() < STAR_CHANCE,
        bornAt: now,
      };

      setParticles((prev) => {
        const next = prev.concat(newP);
        if (next.length > MAX_CONCURRENT) {
          return next.slice(next.length - MAX_CONCURRENT);
        }
        return next;
      });

      // Schedule removal
      window.setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
      }, PARTICLE_TTL_MS);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <CursorSparkle key={p.id} p={p} />
      ))}
    </div>
  );
}

function CursorSparkle({ p }) {
  return (
    <span
      className="absolute will-change-transform"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
      }}
    >
      <span
        className="block"
        style={{
          animation: `cursor-spark ${PARTICLE_TTL_MS}ms ease-out forwards`,
          transform: `translate(${p.drift}px, -${p.rise}px) rotate(${p.rotate}deg)`,
        }}
      >
        {p.isStar ? <StarSVG size={p.size} /> : <TwinkleDot size={p.size} />}
      </span>
    </span>
  );
}

function StarSVG({ size }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      style={{
        filter:
          "drop-shadow(0 0 4px rgba(111, 198, 200, 0.9)) drop-shadow(0 0 1px rgba(232, 230, 210, 1))",
      }}
    >
      <path
        d="M10 0 L12.2 7.3 L20 7.3 L13.9 11.7 L16.2 19 L10 14.6 L3.8 19 L6.1 11.7 L0 7.3 L7.8 7.3 Z"
        fill="rgba(232, 230, 210, 0.95)"
      />
    </svg>
  );
}

function TwinkleDot({ size }) {
  return (
    <span
      className="block rounded-full"
      style={{
        width: `${size * 0.55}px`,
        height: `${size * 0.55}px`,
        background: "rgba(232, 230, 210, 0.95)",
        boxShadow: "0 0 6px 1px rgba(111, 198, 200, 0.7)",
      }}
    />
  );
}
