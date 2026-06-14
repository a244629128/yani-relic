/**
 * 3 ornate feature cards: HANDMADE / FOREST INSPIRED / ONE OF ONE.
 * 3-col grid at all sizes 360px+; single-column stack below 360px.
 *
 * Props:
 *   gap: tailwind gap class (defaults to "gap-4 sm:gap-5")
 *   variant: "tall" (3:5) | "square" (1:1) | "wide" (4:5)
 */
export default function FeatureCardsRow({ gap = "gap-4 sm:gap-5", variant = "wide" }) {
  const aspect = {
    tall: "aspect-[3/5]",
    wide: "aspect-[4/5]",
    square: "aspect-square",
  }[variant];

  const cards = [
    {
      title: "Handmade",
      body: "Wrapped by hand\nwith intention.",
      Icon: IconHand,
    },
    {
      title: "Forest Inspired",
      body: "Made for forest paths\nand moonlit nights.",
      Icon: IconHerb,
    },
    {
      title: "One of One",
      body: "Each piece is unique,\njust like you.",
      Icon: IconMoon,
    },
  ];

  // 3-col grid on phones (360px+) and desktop. Sub-360px (iPhone SE)
  // falls back to single-column vertical stack — Codex flagged that
  // 3-cols at 320px would cramp each card to ~96px.
  return (
    <div
      className={`grid grid-cols-3 max-[359px]:grid-cols-1 ${gap}`}
    >
      {cards.map((c, i) => (
        <FeatureCard
          key={i}
          card={c}
          aspect={`${aspect} max-[359px]:aspect-[5/3]`}
        />
      ))}
    </div>
  );
}

function FeatureCard({ card, aspect }) {
  const { title, body, Icon, cta } = card;
  return (
    <article
      className={`group relative ${aspect} rounded-[4px] bg-[#18241b]/82 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_24px_rgba(63,143,145,0.25)]`}
      style={{
        border: "1px solid rgba(216, 199, 170, 0.18)",
        boxShadow:
          "inset 0 0 30px rgba(0,0,0,0.45), 0 12px 30px rgba(0,0,0,0.4)",
      }}
    >
      {/* Ornate gold corner brackets */}
      <CornerOrnaments />

      {/* Inner content */}
      <div className="absolute inset-0 flex flex-col items-center justify-between px-3 sm:px-4 py-6 sm:py-7 text-center">
        <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-brass-light opacity-90" />

        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <h3
            className="font-chancery text-cream"
            style={{
              fontSize: "clamp(22px, 1.8vw, 30px)",
              letterSpacing: "0.02em",
              lineHeight: 1.05,
            }}
          >
            {title}
          </h3>
          <p
            className="text-cream-dim italic whitespace-pre-line"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(11px, 1vw, 13px)",
              lineHeight: 1.55,
              opacity: 0.78,
            }}
          >
            {body}
          </p>
        </div>

        {cta ? (
          <a
            href={cta.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-parchment border border-parchment/35 rounded-[10px] px-3 py-2 hover:border-labradorite-light hover:text-labradorite-light transition-colors backdrop-blur-sm"
          >
            {cta.label}
          </a>
        ) : (
          <span className="block h-px w-6 bg-brass-light/30" aria-hidden />
        )}
      </div>
    </article>
  );
}

/* ============================================================
 * Decorative SVG icons + corner brackets
 * ============================================================ */
function CornerOrnaments() {
  return (
    <>
      {/* Each corner bracket — small brass ornament */}
      {[
        { top: 6, left: 6, rotate: 0 },
        { top: 6, right: 6, rotate: 90 },
        { bottom: 6, right: 6, rotate: 180 },
        { bottom: 6, left: 6, rotate: 270 },
      ].map((pos, i) => (
        <svg
          key={i}
          width="22"
          height="22"
          viewBox="0 0 22 22"
          className="absolute"
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
            bottom: pos.bottom,
            transform: `rotate(${pos.rotate}deg)`,
          }}
          aria-hidden
        >
          <path
            d="M 2 6 L 2 2 L 6 2"
            stroke="rgba(181, 154, 104, 0.6)"
            strokeWidth="1"
            fill="none"
          />
          <circle cx="2" cy="2" r="1" fill="rgba(181, 154, 104, 0.5)" />
        </svg>
      ))}
    </>
  );
}

function IconHand({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M11 26 V 18 C 11 16 13 16 13 18 V 13 C 13 11 15 11 15 13 V 11 C 15 9 17 9 17 11 V 12 C 17 10 19 10 19 12 V 19 C 19 23 21 24 21 26" />
      <path d="M 11 22 C 9 22 9 18 11 18" />
    </svg>
  );
}

function IconHerb({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M16 6 V 28" strokeLinecap="round" />
      <path d="M16 10 Q 22 9 24 12 Q 22 14 16 14" fill="currentColor" fillOpacity="0.3" />
      <path d="M16 14 Q 10 13 8 16 Q 10 18 16 18" fill="currentColor" fillOpacity="0.3" />
      <path d="M16 18 Q 22 17 24 20 Q 22 22 16 22" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

function IconMoon({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path
        d="M22 20 A 9 9 0 1 1 12 6 A 6.5 6.5 0 0 0 22 20 Z"
        fill="currentColor"
        fillOpacity="0.6"
      />
    </svg>
  );
}
