"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelection } from "@/hooks/useSelection";

/**
 * Floating cart icon (bottom-right, stacked below the FloatingChatButton).
 * Same 56/60px circle as the chat button so the two form a natural pair.
 * A small brass number badge sits at the top-right of the icon showing
 * the selection count.
 *
 * Visible whenever the buyer has selected 1+ piece.
 * Hidden on:
 *   - /admin/*  (never relevant while editing shop)
 *   - /checkout (redundant — buyer is already on the page)
 *
 * Vertical stack from bottom on mobile:
 *   MobileActionBar (0-4rem, includes safe-area)
 *   SelectionBar cart icon (~5.25rem)  ← this component
 *   FloatingChatButton (~9.5rem)
 *   BackToTop (~13.5rem, only when scrolled)
 *
 * On desktop (md+, no MobileActionBar): cart at bottom-6, chat at
 * bottom-24 — same 4.5rem gap, just closer to the bottom edge.
 */
export default function SelectionBar() {
  const pathname = usePathname();
  const { ids } = useSelection();

  if (pathname?.startsWith("/admin")) return null;
  if (pathname === "/checkout") return null;
  if (ids.length < 1) return null;

  const count = ids.length;
  return (
    <div className="fixed right-4 md:right-6 z-40 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] md:bottom-6">
      <Link
        href="/checkout"
        aria-label={`Cart: ${count} ${count === 1 ? "piece" : "pieces"} — check out`}
        className="relative block w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-labradorite-light hover:-translate-y-0.5 transition-transform"
        style={{
          background:
            "linear-gradient(135deg, #1a2520 0%, #0d1611 60%, #050a08 100%)",
          border: "1px solid rgba(181, 154, 104, 0.85)",
          boxShadow:
            "0 10px 28px rgba(0, 0, 0, 0.55), 0 0 18px rgba(63, 143, 145, 0.28), inset 0 0 12px rgba(181, 154, 104, 0.10)",
        }}
      >
        <BagIcon />
        {/* Number badge — brass circle top-right. Uses min-width so a
            two-digit count (10, the max) still fits without cropping. */}
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums text-forest"
          style={{
            background:
              "linear-gradient(135deg, rgba(216, 199, 170, 1) 0%, rgba(181, 154, 104, 1) 100%)",
            border: "1px solid rgba(13, 22, 17, 0.6)",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.5)",
          }}
        >
          {count}
        </span>
      </Link>
    </div>
  );
}

function BagIcon() {
  // Rounded handmade-bag silhouette. Chose a curvier basket shape rather
  // than a stiff shopping-cart glyph — reads warmer against the site's
  // magical/handmade tone. Brass stroke matches the border color.
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      {/* Bag body */}
      <path
        d="M5 8 h14 l-1.2 11.2 a2 2 0 0 1 -1.99 1.8 H8.19 a2 2 0 0 1 -1.99 -1.8 L5 8 Z"
        stroke="rgba(216, 199, 170, 0.95)"
        strokeWidth="1.5"
        fill="rgba(216, 199, 170, 0.08)"
        strokeLinejoin="round"
      />
      {/* Handle */}
      <path
        d="M9 8 v -2 a 3 3 0 0 1 6 0 v 2"
        stroke="rgba(216, 199, 170, 0.95)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
