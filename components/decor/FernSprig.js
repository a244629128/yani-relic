export default function FernSprig({ className = "", flip = false }) {
  return (
    <svg
      viewBox="0 0 120 200"
      className={className}
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M60 10 Q 60 100 60 190" />
      {Array.from({ length: 9 }).map((_, i) => {
        const y = 25 + i * 18;
        const len = 38 - i * 3;
        return (
          <g key={i}>
            <path d={`M60 ${y} Q ${60 + len * 0.6} ${y - 6}, ${60 + len} ${y - 2}`} />
            <path d={`M60 ${y} Q ${60 - len * 0.6} ${y - 6}, ${60 - len} ${y - 2}`} />
          </g>
        );
      })}
    </svg>
  );
}
