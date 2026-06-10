"use client";

import Link from "next/link";
import { links } from "@/data/products";

/**
 * Sticky bottom action bar — visible only on mobile (md:hidden).
 * Two actions:
 *   - View Relics (outline) → /shop
 *   - Shop on Depop (filled, with Depop logo + label) → external Depop URL
 *
 * Bottom padding respects iOS home-bar via env(safe-area-inset-bottom).
 * z-index 40 — banner (z-45) and full-screen modal (z-50) sit above it.
 */
export default function MobileActionBar() {
  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-parchment/15"
      style={{
        background: "linear-gradient(180deg, #0d1611 0%, #060a08 100%)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        <Link
          href="/shop"
          className="flex items-center justify-center gap-2 rounded-[10px] border border-parchment/35 text-parchment py-2.5 text-[12px] uppercase tracking-[0.18em]"
        >
          View Relics
        </Link>
        <a
          href={links.depop}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-[12px] uppercase tracking-[0.18em] text-cream"
          style={{
            background: "rgba(63, 143, 145, 0.85)",
            border: "1px solid rgba(111, 198, 200, 0.4)",
          }}
          aria-label="Shop on Depop"
        >
          <DepopLogo />
          <span>Shop on Depop</span>
        </a>
      </div>
    </div>
  );
}

function DepopLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 3h7.5a7.5 7.5 0 0 1 0 15H7v3H3V3zm4 4v7h3.5a3.5 3.5 0 0 0 0-7H7z" />
    </svg>
  );
}
