"use client";

import { useEffect, useState } from "react";

/**
 * Floating "back to top" button. Appears after scrolling past 800px.
 * Mobile only (md:hidden). Positioned above the sticky bottom action bar.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setVisible(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={`md:hidden fixed right-4 z-40 w-11 h-11 rounded-full bg-forest/90 border border-brass/40 text-parchment flex items-center justify-center backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{
        bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 19 L 12 5 M5 12 L 12 5 L 19 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
