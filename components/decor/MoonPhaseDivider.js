export default function MoonPhaseDivider({ className = "" }) {
  const phases = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className={`flex items-center justify-center gap-6 py-2 text-brass ${className}`} aria-hidden>
      <span className="hairline flex-1 max-w-[160px]" />
      <div className="flex items-center gap-3">
        {phases.map((p, i) => (
          <svg key={i} width="14" height="14" viewBox="0 0 24 24" className="opacity-80">
            <defs>
              <clipPath id={`mp-${i}`}>
                <rect x="0" y="0" width={24 * p} height="24" />
              </clipPath>
            </defs>
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="12" cy="12" r="10" fill="currentColor" clipPath={`url(#mp-${i})`} />
          </svg>
        ))}
      </div>
      <span className="hairline flex-1 max-w-[160px]" />
    </div>
  );
}
