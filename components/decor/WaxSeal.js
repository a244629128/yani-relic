export default function WaxSeal({ label = "One of One", className = "" }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center w-16 h-16 rounded-full ${className}`}
      aria-label={label}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #6a3a2c 0%, #4a2419 55%, #2a1108 100%)",
          boxShadow:
            "inset 2px 3px 6px rgba(255,255,255,0.18), inset -3px -4px 8px rgba(0,0,0,0.55), 0 4px 10px -2px rgba(0,0,0,0.55)",
        }}
      />
      <div
        className="absolute inset-1 rounded-full border border-dashed"
        style={{ borderColor: "rgba(232, 207, 178, 0.35)" }}
      />
      <span
        className="relative text-[9px] uppercase tracking-[0.18em] text-center font-serif italic leading-[1.05] px-2"
        style={{ color: "#f0d9b8" }}
      >
        {label}
      </span>
    </div>
  );
}
