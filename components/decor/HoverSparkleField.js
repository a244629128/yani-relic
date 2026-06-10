// Renders a field of tiny stars + glow dots that twinkle into existence on
// parent .group hover. Each sparkle is positioned deterministically from
// seed, so a given card always has the same constellation — but every
// card looks different.
//
// Stays inside the card (overflow-hidden on parent recommended).
// Does not block clicks (pointer-events-none).

function StarSVG({ size = 12 }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden
      style={{
        filter:
          "drop-shadow(0 0 4px rgba(111, 198, 200, 0.85)) drop-shadow(0 0 1px rgba(232, 230, 210, 1))",
      }}
    >
      <path
        d="M10 0 L12.2 7.3 L20 7.3 L13.9 11.7 L16.2 19 L10 14.6 L3.8 19 L6.1 11.7 L0 7.3 L7.8 7.3 Z"
        fill="rgba(232, 230, 210, 0.95)"
      />
    </svg>
  );
}

export default function HoverSparkleField({ cardId = "x", count = 8 }) {
  const seed = (i) => {
    const x = Math.sin(i * 9301 + 49297 + hashString(cardId) * 73) * 233280;
    return x - Math.floor(x);
  };

  const sparkles = Array.from({ length: count }).map((_, i) => {
    const top = (seed(i * 2) * 100).toFixed(2);
    const left = (seed(i * 2 + 1) * 100).toFixed(2);
    const size = (4 + seed(i * 3) * 8).toFixed(2); // 4–12 px
    const delay = (seed(i * 5) * 0.4).toFixed(3); // 0–0.4s
    const isStar = seed(i * 7) > 0.45;
    const duration = (1.4 + seed(i * 9) * 1.2).toFixed(2);
    return { top, left, size: parseFloat(size), delay, isStar, duration, key: `${cardId}-${i}` };
  });

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-20"
      aria-hidden
    >
      {sparkles.map((s) => (
        <span
          key={s.key}
          className="absolute opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            transitionDuration: `${s.duration}s`,
            transitionDelay: `${s.delay}s`,
            transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          {s.isStar ? (
            <span
              className="block animate-[sparkle_2.4s_ease-in-out_infinite]"
              style={{ animationDelay: `${s.delay}s` }}
            >
              <StarSVG size={s.size} />
            </span>
          ) : (
            <span
              className="block rounded-full animate-[sparkle_2s_ease-in-out_infinite]"
              style={{
                width: `${s.size * 0.6}px`,
                height: `${s.size * 0.6}px`,
                background: "rgba(232, 230, 210, 0.9)",
                boxShadow: "0 0 6px 1px rgba(111, 198, 200, 0.7)",
                animationDelay: `${s.delay}s`,
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
