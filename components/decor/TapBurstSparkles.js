"use client";

import { useEffect, useRef, useState } from "react";

const MAX_PARTICLES = 20;
const TTL_MS = 700;
const PARTICLES_PER_TAP = 7;

/**
 * Tap-burst sparkles. On touch-primary devices, listens for pointerdown
 * events globally. On each tap (excluding taps on interactive elements
 * like buttons/links/inputs), emits a small burst of stars from the tap
 * point that fan outward and fade. Respects prefers-reduced-motion.
 */
export default function TapBurstSparkles() {
  const [particles, setParticles] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isCoarse || reducedMotion) return;

    const onPointerDown = (e) => {
      if (e.pointerType === "mouse") return;
      if (e.target.closest("button, a, input, select, textarea, [role='button'], [contenteditable]")) return;

      const burst = Array.from({ length: PARTICLES_PER_TAP }).map((_, i) => {
        const id = ++idRef.current;
        const angle = (-90 + (i / (PARTICLES_PER_TAP - 1) - 0.5) * 60) * (Math.PI / 180);
        const distance = 35 + Math.random() * 25;
        return {
          id,
          x: e.clientX,
          y: e.clientY,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          isStar: Math.random() > 0.4,
          size: 4 + Math.random() * 4,
        };
      });

      setParticles((prev) => {
        const next = [...prev, ...burst];
        if (next.length > MAX_PARTICLES) {
          return next.slice(next.length - MAX_PARTICLES);
        }
        return next;
      });

      window.setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !burst.find((b) => b.id === p.id)));
      }, TTL_MS);
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
            willChange: "transform",
          }}
        >
          <span
            className="block"
            style={{
              animation: `tap-burst ${TTL_MS}ms ease-out forwards`,
              ["--dx"]: `${p.dx}px`,
              ["--dy"]: `${p.dy}px`,
            }}
          >
            {p.isStar ? <StarSVG size={p.size} /> : <Dot size={p.size} />}
          </span>
        </span>
      ))}
    </div>
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
      aria-hidden
    >
      <path
        d="M10 0 L12.2 7.3 L20 7.3 L13.9 11.7 L16.2 19 L10 14.6 L3.8 19 L6.1 11.7 L0 7.3 L7.8 7.3 Z"
        fill="rgba(232, 230, 210, 0.95)"
      />
    </svg>
  );
}

function Dot({ size }) {
  return (
    <span
      className="block rounded-full"
      style={{
        width: size,
        height: size,
        background: "rgba(232, 230, 210, 0.95)",
        boxShadow: "0 0 6px 1px rgba(111, 198, 200, 0.7)",
      }}
    />
  );
}
