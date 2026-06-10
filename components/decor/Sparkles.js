// Decorative twinkling sparkles. Count + intensity tunable.
export default function Sparkles({ count = 14, intensity = "subtle", className = "" }) {
  // Pseudo-random but deterministic positions (no Math.random — SSR-safe and stable).
  const seed = (i) => {
    const x = Math.sin(i * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };
  const opacityScale = intensity === "magical" ? 1 : intensity === "subtle" ? 0.6 : 0;
  if (opacityScale === 0) return null;
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        // Fixed precision to avoid float-rounding hydration mismatches.
        const top = (seed(i * 2) * 100).toFixed(2);
        const left = (seed(i * 2 + 1) * 100).toFixed(2);
        const size = (2 + seed(i * 3) * 4).toFixed(2);
        const delay = (seed(i * 5) * 4).toFixed(2);
        const duration = (2.5 + seed(i * 7) * 3).toFixed(2);
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: "rgba(232, 230, 210, 0.85)",
              boxShadow: "0 0 6px 1px rgba(111, 198, 200, 0.55)",
              opacity: opacityScale,
              animation: `sparkle ${duration}s ease-in-out ${delay}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}
