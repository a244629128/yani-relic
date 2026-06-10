// Site-wide promo banner — sticky at the very top of every page.
// Banner height is h-11 sm:h-14 (44px / 56px). If you change those, also
// update the Header's `top-11 sm:top-14` sticky offset to match.
// Edit the labels / emphasized fragments to change the announcement.
const LABEL_1 = "Free shipping on orders";
const EMPHASIS_1 = "$45+";
const LABEL_2 = "Ships within";
const EMPHASIS_2 = "24 hours";

export default function SiteBanner() {
  return (
    <div
      className="sticky top-0 z-[45] w-full h-11 sm:h-14"
      style={{
        background:
          "linear-gradient(180deg, #101714 0%, #0d1611 100%)",
        borderBottom: "1px solid rgba(216, 199, 170, 0.12)",
      }}
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4 h-full flex items-center justify-center gap-2 sm:gap-4">
        <SparkleMark />
        <p
          className="text-parchment uppercase font-serif flex items-baseline flex-wrap justify-center gap-x-1.5 sm:gap-x-2 gap-y-0"
          style={{
            fontSize: "clamp(11px, 0.95vw, 15px)",
            letterSpacing: "0.18em",
            fontWeight: 500,
          }}
        >
          <span>{LABEL_1}</span>
          <Emphasis>{EMPHASIS_1}</Emphasis>
          <span style={{ color: "rgba(216, 199, 170, 0.5)", padding: "0 4px" }}>·</span>
          <span>{LABEL_2}</span>
          <Emphasis>{EMPHASIS_2}</Emphasis>
        </p>
        <SparkleMark />
      </div>
    </div>
  );
}

function Emphasis({ children }) {
  return (
    <span
      className="font-chancery"
      style={{
        color: "#b59a68", // brass-light — antique gold
        fontSize: "clamp(22px, 2vw, 30px)",
        letterSpacing: "0",
        textTransform: "none",
        lineHeight: 1,
      }}
    >
      {children}
    </span>
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
