"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { links } from "@/data/products";
import { trackDepopClickGeneral } from "@/lib/analytics";

const nav = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Relics" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
      className="sticky top-11 sm:top-14 z-40 transition-[background-color,backdrop-filter] duration-300"
      style={{
        // Keep a permanent 1px border so border-width never animates from 0 → 1.
        // Only its color fades — invisible at top, faint parchment when scrolled.
        borderBottom: scrolled
          ? "1px solid rgba(216, 199, 170, 0.15)"
          : "1px solid transparent",
        backgroundColor: scrolled ? "rgba(13, 22, 17, 0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        transition:
          "background-color 300ms ease, backdrop-filter 300ms ease, -webkit-backdrop-filter 300ms ease, border-color 300ms ease",
      }}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-6">
        {/* LEFT — moon logo + brand */}
        <Link
          href="/"
          className="flex items-center gap-3 group"
          aria-label="Yani Relics — home"
        >
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
            <path
              d="M 22 20 A 9 9 0 1 1 12 6 A 6.5 6.5 0 0 0 22 20 Z"
              fill="rgba(181, 154, 104, 0.85)"
            />
          </svg>
          <span
            className="font-chancery text-parchment group-hover:text-labradorite-light transition-colors"
            style={{ fontSize: "clamp(20px, 1.6vw, 26px)", letterSpacing: "0.02em" }}
          >
            Yani Relics
          </span>
        </Link>

        {/* CENTER — nav */}
        <nav className="hidden md:flex items-center gap-7 lg:gap-10" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-parchment uppercase font-serif hover:text-labradorite-light transition-colors"
              style={{
                fontSize: "13px",
                letterSpacing: "0.16em",
                fontWeight: 500,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-parchment"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {open ? (
              <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
            ) : (
              <>
                <path d="M4 7 H20" strokeLinecap="round" />
                <path d="M4 12 H20" strokeLinecap="round" />
                <path d="M4 17 H20" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>
      </header>

      {/* Mobile drawer — rendered as a SIBLING of <header>, not a child.
          Why: when the user scrolls and the header gets backdrop-filter:blur, the
          header becomes a containing block for fixed descendants. The drawer's
          `top:108 bottom:0` then resolves against the 64px-tall header → drawer
          height collapses to 0 → bg invisible, nav text overflows and overlaps
          the page. Keeping the drawer as a sibling means its `fixed` positioning
          stays anchored to the viewport.
          Slide-down via inline transform (always 100% opaque during transition).
          `inert` when closed keeps Tab from reaching the hidden links. */}
      <div
        className={`md:hidden fixed inset-x-0 top-[108px] bottom-0 z-30 transition-transform duration-300 ease-out ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          transform: open ? "translateY(0)" : "translateY(-110vh)",
        }}
        aria-hidden={!open}
        inert={!open || undefined}
      >
        <div className="absolute inset-0 bg-forest" onClick={() => setOpen(false)} />
        <nav
          className="relative h-full flex flex-col items-center justify-start gap-5 px-6 pt-10 pb-safe text-center"
          aria-label="Mobile"
        >
          {nav.map((item, i) => (
            <span
              key={item.href}
              style={{
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0)" : "translateY(8px)",
                transition: `opacity 350ms ease-out ${50 + i * 40}ms, transform 350ms ease-out ${50 + i * 40}ms`,
              }}
            >
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="font-serif text-3xl text-parchment hover:text-labradorite-light transition-colors uppercase tracking-[0.12em] min-h-[48px] flex items-center"
              >
                {item.label}
              </Link>
            </span>
          ))}
          <div className="mt-4 flex flex-col gap-3 w-full max-w-xs">
            <a
              href={links.depop}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackDepopClickGeneral("header-drawer")}
              className="btn-relic"
            >
              Shop on Depop
            </a>
            <a
              href={links.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-relic-link"
            >
              Follow on TikTok →
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
