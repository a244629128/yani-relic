"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { links } from "@/data/products";

const POPOVER_ID = "chat-channels-popover";

/**
 * Floating chat icon, bottom-right of every public page. Click → popover
 * opens upward with 3 message channels: Instagram DM, Messenger, Email.
 *
 * Design intent (per Codex review):
 *   - All three channels are async; the popover header sets expectations
 *     ("Usually replies within a few hours") so visitors don't expect
 *     live-chat speed and then feel ghosted.
 *   - No real-time chat infra — Yani is a one-person shop, her response
 *     latency is the same on any channel, but IG/Messenger are venues
 *     where async replies feel normal to buyers.
 *   - Hidden on /admin/* — never useful when she's editing the shop.
 *
 * Z-index strategy:
 *   - Closed: z-40 (sibling layer with MobileActionBar / BackToTop).
 *   - Open:   z-[44] so the popover wins over BackToTop while still sitting
 *             below SiteBanner (z-45).
 *
 * Visibility design (per Codex, iterated):
 *   - Pulsing brass halo at -5px inset draws the eye without garish color.
 *   - 1.025× breath scale on the button + opacity-animated aura layer
 *     (so the bright glow doesn't repaint box-shadow every frame).
 *   - Two brass sparkles twinkle at offset times for low-frequency surprise.
 *   - Stronger border (0.85 brass) + bigger circle (56/60px) raise contrast.
 *   - All animations honor prefers-reduced-motion (see globals.css).
 */
export default function FloatingChatButton() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const firstChannelRef = useRef(null);

  // ESC + click-outside close. Only attach handlers while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    // Passive — we never preventDefault, so let the browser keep scroll/pinch fast.
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [isOpen]);

  // A11y: when popover opens, drop keyboard focus on the first channel link
  // so screen-reader / keyboard users land in actionable content immediately.
  useEffect(() => {
    if (isOpen) firstChannelRef.current?.focus();
  }, [isOpen]);

  // Hide on admin pages. Hook order above must be unconditional.
  if (pathname?.startsWith("/admin")) return null;

  const channels = [
    {
      label: "Instagram DM",
      sub: "@yanirelics",
      href: links.instagramDm,
      Icon: IconInstagram,
    },
    {
      label: "Messenger",
      sub: "Yani Relics",
      href: links.messenger,
      Icon: IconMessenger,
    },
    {
      label: "Email",
      sub: links.email,
      href: `mailto:${links.email}`,
      Icon: IconMail,
    },
  ];

  return (
    <div
      ref={rootRef}
      // Bottom offset on mobile clears the MobileActionBar (~64px tall + safe-area).
      // On md+ the bar is hidden, so we collapse to a small offset.
      // Z bumps to 44 when open so the popover wins over BackToTop (z-40)
      // while still sitting below SiteBanner (z-45).
      className={`fixed right-4 md:right-6 bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] md:bottom-24 ${isOpen ? "z-[44]" : "z-40"}`}
    >
      {/* Popover */}
      {isOpen && (
        <div
          id={POPOVER_ID}
          role="dialog"
          aria-label="Send a message"
          // Width guard: min(280px, viewport-2rem) covers narrow webviews,
          // browser zoom, and odd Android browsers — Codex flagged this.
          className="absolute bottom-full right-0 mb-3 w-[min(280px,calc(100vw-2rem))] sm:w-[300px] overflow-hidden animate-modal-up"
          style={{
            background:
              "linear-gradient(160deg, #1a2520 0%, #0d1611 60%, #050a08 100%)",
            border: "1px solid rgba(181, 154, 104, 0.4)",
            borderRadius: "8px",
            boxShadow:
              "0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(63, 143, 145, 0.15)",
          }}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-parchment/15">
            <h3
              className="font-chancery text-cream"
              style={{ fontSize: "22px", letterSpacing: "0.01em" }}
            >
              Send a message
            </h3>
            <p className="text-cream-dim text-[11px] mt-1 leading-snug italic font-serif">
              Usually replies within a few hours — it&apos;s a one-person shop.
            </p>
          </div>

          {/* Channel list */}
          <ul className="py-1">
            {channels.map((c, i) => (
              <li key={c.label}>
                <a
                  ref={i === 0 ? firstChannelRef : undefined}
                  href={c.href}
                  target={c.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={c.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                  onClick={() => setIsOpen(false)}
                  // focus-visible:ring keeps keyboard users oriented — the
                  // background-only focus state was too subtle (Codex MED).
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] focus-visible:bg-white/[0.04] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-labradorite-light/50 transition-colors group"
                >
                  <c.Icon className="w-5 h-5 text-brass-light shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-[13px] leading-tight group-hover:text-labradorite-light transition-colors">
                      {c.label}
                    </p>
                    <p className="text-cream-dim/70 text-[10px] truncate">
                      {c.sub}
                    </p>
                  </div>
                  <span
                    className="text-brass-light/50 group-hover:text-brass-light text-sm transition-colors"
                    aria-hidden
                  >
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close message panel" : "Send a message"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? POPOVER_ID : undefined}
        // chat-fab-button owns the static visuals (background, border, base
        // shadow). chat-fab-breath is the animation layer — applied only
        // when closed so the open state stays still.
        className={`chat-fab-button relative w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-labradorite-light ${isOpen ? "" : "chat-fab-breath"}`}
      >
        {/* Eye-catch layers — only visible when closed. Four stacked effects:
            aura (opacity-pulsed glow, behind button), halo ring (scaled +
            opacity-pulsed), two brass sparkle twinkles. */}
        {!isOpen && (
          <>
            <span className="chat-fab-aura" aria-hidden />
            <span className="chat-fab-halo" aria-hidden />
            <span className="chat-fab-sparkle chat-fab-sparkle--1" aria-hidden />
            <span className="chat-fab-sparkle chat-fab-sparkle--2" aria-hidden />
          </>
        )}

        {isOpen ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            className="text-brass-light"
            aria-hidden
          >
            <path
              d="M5 5 L 15 15 M 15 5 L 5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <IconChatBubble />
        )}
      </button>
    </div>
  );
}

/* ===== Icons ===== */

function IconChatBubble() {
  // Speech bubble with a small star inside — matches the brass + magic
  // aesthetic of the rest of the site.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 5 h16 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 H10 l-4 4 v-4 H4 a2 2 0 0 1 -2 -2 V7 a2 2 0 0 1 2 -2 Z"
        fill="rgba(181, 154, 104, 0.92)"
      />
      <path
        d="M12 8 L 13 11 L 16 12 L 13 13 L 12 16 L 11 13 L 8 12 L 11 11 Z"
        fill="#0d1611"
      />
    </svg>
  );
}

function IconInstagram({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function IconMessenger({ className }) {
  // Stylized Messenger glyph — speech-bubble shape + the signature lightning.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 3 C 6.5 3 2.5 7 2.5 12 c 0 2.6 1.1 4.9 3 6.5 V 22 l 2.8 -1.6 c 1.1 0.4 2.4 0.6 3.7 0.6 c 5.5 0 9.5 -4 9.5 -9 S 17.5 3 12 3 Z" />
      <path d="M6.5 14 L 10 10 L 12.5 12 L 16.5 9 L 13 13 L 10.5 11 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMail({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7 L 12 13 L 21 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
