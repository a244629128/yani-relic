// Lightweight description renderer for product detail pages.
// Supports markdown-style bullets and paragraph breaks without pulling
// in a full markdown library.
//
// Format rules for admin:
//   - Blank line between paragraphs.
//   - Lines starting with "- " or "* " or "• " become a bullet list.
//   - Mixed paragraphs + bullets work (paragraph → bullets → paragraph).
//
// Example admin input:
//   A pale labradorite, wrapped in antique brass wire. Flashes a pale
//   teal under candlelight.
//
//   - Handmade wire-wrapped labradorite pendant
//   - Antique copper-tone wire
//   - Blue-green flash under direct light
//   - Comes on a black cord
//
//   Made between 11pm and 1am. The stone wanted that hour.

export default function FormattedDescription({ text, className = "" }) {
  if (!text || typeof text !== "string") return null;

  // Split into "blocks" by blank lines. \n\s*\n catches Windows \r\n too.
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const isBulletBlock =
          lines.length > 0 && lines.every((l) => /^[-*•]\s+/.test(l));

        if (isBulletBlock) {
          return (
            <ul
              key={i}
              className="list-disc pl-5 mb-4 space-y-1.5 text-cream/90 leading-relaxed marker:text-brass-light"
            >
              {lines.map((line, j) => (
                <li key={j}>{line.replace(/^[-*•]\s+/, "")}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="leading-relaxed text-cream/90 mb-4">
            {lines.join(" ")}
          </p>
        );
      })}
    </div>
  );
}
