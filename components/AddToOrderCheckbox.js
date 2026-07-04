"use client";

import { useSelection } from "@/hooks/useSelection";

/**
 * Overlay button on product cards that toggles a piece in/out of the
 * localStorage-backed bundle-checkout selection.
 *
 * Two variants:
 *   variant="overlay" (default) — small circular badge for shop listing cards
 *   variant="link"              — subtle text link for the product detail page
 *
 * Hidden on sold pieces (rendered as null) so buyers can't select unavailable
 * inventory. Disabled (visible but not clickable) when the selection is at
 * MAX_BUNDLE_SIZE and this piece isn't already in the selection.
 *
 * All variants prevent the click from bubbling to any parent Link — the
 * card's photo/title still navigate to the detail page.
 */
export default function AddToOrderCheckbox({ productId, sold = false, variant = "overlay" }) {
  const { has, toggle, isFull } = useSelection();
  if (sold) return null;

  const selected = has(productId);
  const disabled = isFull && !selected;

  const onClick = (e) => {
    // The parent card is a Link; without this we'd navigate away.
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    toggle(productId);
  };

  if (variant === "link") {
    // Full-width white pill, sized to match the Depop button beneath it
    // so the two secondary CTAs stack cleanly. Bolder + slightly larger
    // text than the sibling CTAs — Yani asked for this one to read louder
    // (it's the entry point for the bundle-checkout flow, and buyers who
    // haven't discovered it yet need a visual cue).
    const base =
      "inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-full text-[14px] font-semibold transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:shadow-[0_3px_12px_rgba(0,0,0,0.25)]";
    const stateClasses = selected
      ? "bg-labradorite-light text-forest border border-labradorite-glow hover:bg-labradorite-glow"
      : disabled
      ? "bg-cream/40 text-forest/50 border border-cream/40 cursor-not-allowed"
      : "bg-cream text-forest border border-cream hover:bg-white";
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        className={`${base} ${stateClasses}`}
      >
        {selected ? (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M2.5 7 L 5.5 10 L 11.5 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Added to your cart</span>
          </>
        ) : disabled ? (
          <span>Cart is full (10 max)</span>
        ) : (
          <>
            <span className="text-lg leading-none font-light">+</span>
            <span>Add to my cart</span>
          </>
        )}
      </button>
    );
  }

  // Overlay badge — top-right of product card image.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={
        selected
          ? "Remove from your cart"
          : disabled
          ? "Cart is full (10 max)"
          : "Add to your cart"
      }
      className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all backdrop-blur-sm ${
        selected
          ? "bg-labradorite/85 text-cream border border-labradorite-light"
          : disabled
          ? "bg-forest/60 text-cream-dim/40 border border-brass/25 cursor-not-allowed"
          : "bg-forest/80 text-brass-light border border-brass/50 hover:border-labradorite-light hover:text-labradorite-glow"
      }`}
      style={{ boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)" }}
    >
      {selected ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M2.5 7 L 5.5 10 L 11.5 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span className="text-[18px] leading-none font-light">+</span>
      )}
    </button>
  );
}
