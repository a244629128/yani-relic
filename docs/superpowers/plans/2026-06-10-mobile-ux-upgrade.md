# Mobile UX Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Yani Relics mobile experience to parity with desktop via 14 prioritized changes per the design spec at `docs/superpowers/specs/2026-06-10-mobile-ux-upgrade-design.md`.

**Architecture:** Each item is an independent, isolated component or file edit. Items 1-13 ship incrementally; #14 (tap-burst sparkles) ships last because it needs all z-index layers stabilized first. Verification at each task uses Playwright + visual screenshot + computed-style check (this is a no-test-suite project, so "test" = browser behavior assertion).

**Tech Stack:** Next.js 15.5.19 (App Router, JS), React 18.3.1, Tailwind v4, native Web APIs (Pointer Events, Web Share, IntersectionObserver), no new npm deps required.

---

## File Structure

| File | New? | Responsibility |
|---|---|---|
| `app/globals.css` | edit | Add safe-area + dynamic viewport CSS utilities (foundation) |
| `app/layout.js` | edit | Mount `MobileActionBar`, `BackToTop`, `TapBurstSparkles` |
| `app/page.js` | edit | Tighten hero, move flip deck out of hero |
| `app/shop/page.js` | edit | Scroll restoration; query-param routing for share links |
| `components/SiteBanner.js` | edit | Rotating messages with locked min-height |
| `components/Header.js` | edit | Drawer polish — safe-area, larger tap targets, stagger |
| `components/ProductDetail.js` | edit | Full-screen mobile modal, share button, scroll restoration |
| `components/ProductGallery.js` | edit | Pinch-to-zoom + double-tap zoom |
| `components/ProductCard.js` | edit | Blur placeholders on `<Image>` |
| `components/FeatureCardsRow.js` | edit | Mobile horizontal swipe-strip |
| `components/RelicFlipDeck.js` | edit | 3-card row on mobile (rewrite carousel logic) |
| `components/MobileActionBar.js` | **NEW** | Sticky bottom Depop CTA bar (mobile only) |
| `components/BackToTop.js` | **NEW** | Floating back-to-top button (mobile only) |
| `components/decor/TapBurstSparkles.js` | **NEW** | Tap-burst sparkles on touch devices |
| `data/products.js` | edit | Export shared `BLUR_DATA_URL` constant |

---

## Task 1: Foundation — Safe-area + dynamic-viewport CSS utilities

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add utility classes to globals.css**

After the existing `.no-scrollbar` utility (around line 184), add:

```css
/* Dynamic viewport height — accounts for iOS Safari's collapsing address bar.
   Falls back to 100vh on older browsers. Used by full-screen modal + sticky
   elements that need to span the visible viewport. */
.h-dvh { height: 100vh; height: 100dvh; }
.min-h-dvh { min-height: 100vh; min-height: 100dvh; }
.max-h-dvh { max-height: 100vh; max-height: 100dvh; }

/* Safe-area padding — respects iOS notch + home-bar */
.pt-safe { padding-top: env(safe-area-inset-top); }
.pr-safe { padding-right: env(safe-area-inset-right); }
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.pl-safe { padding-left: env(safe-area-inset-left); }
.px-safe { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
.py-safe { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }

/* Used together with explicit padding values, e.g.:
     <div style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))` }}> */
```

- [ ] **Step 2: Verify in browser**

Run: dev server is already on 3939. Navigate to `http://localhost:3939/`.

Via Playwright `browser_evaluate`:
```js
() => {
  const test = document.createElement('div');
  test.className = 'h-dvh pb-safe';
  test.style.position = 'fixed'; test.style.inset = '0';
  document.body.appendChild(test);
  const cs = getComputedStyle(test);
  const result = { height: cs.height, paddingBottom: cs.paddingBottom };
  test.remove();
  return result;
}
```
Expected: `height` = full viewport (e.g. `844px` on iPhone 14), `paddingBottom` = `0px` on desktop or env value on iOS Safari.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Add safe-area + dynamic-viewport CSS utilities (foundation for mobile UX)"
```

---

## Task 2: Sticky bottom Depop CTA bar (mobile only)

**Files:**
- Create: `components/MobileActionBar.js`
- Modify: `app/layout.js` (mount the bar)

- [ ] **Step 1: Create the component**

Create `components/MobileActionBar.js`:

```jsx
"use client";

import Link from "next/link";
import { links } from "@/data/products";

/**
 * Sticky bottom action bar — visible only on mobile (md:hidden).
 * Two actions:
 *   - View Relics (outline) → /shop
 *   - Shop on Depop (filled, with Depop logo + label) → external Depop URL
 *
 * Hidden when a full-screen product modal is open via prop forwarded from
 * ProductDetail (data attribute on <body>); for now we just hide on md+
 * desktop and let the modal cover us when it's open at z-50.
 *
 * Bottom padding uses env(safe-area-inset-bottom) for iPhone home bar.
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
  // Simplified Depop "D" mark — inline SVG, single color (currentColor).
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 3h7.5a7.5 7.5 0 0 1 0 15H7v3H3V3zm4 4v7h3.5a3.5 3.5 0 0 0 0-7H7z" />
    </svg>
  );
}
```

- [ ] **Step 2: Mount in layout.js**

Modify `app/layout.js`. Add import after `CursorSparkleTrail`:

```js
import MobileActionBar from "@/components/MobileActionBar";
```

In the `<body>` element, add `<MobileActionBar />` just before `<CursorSparkleTrail />`:

```jsx
<body className="min-h-full flex flex-col bg-forest text-cream font-sans">
  <SiteBanner />
  {children}
  <MobileActionBar />
  <CursorSparkleTrail />
</body>
```

- [ ] **Step 3: Verify in browser at mobile viewport**

Playwright steps:
1. `browser_resize({ width: 390, height: 844 })`
2. `browser_navigate("http://localhost:3939/")`
3. `browser_take_screenshot({ filename: ".playwright-mcp/task2-bar.png" })`

Expected: At the bottom of the viewport, see two buttons side-by-side: "VIEW RELICS" (outline) and "[D] SHOP ON DEPOP" (teal-tinted with Depop logo). Both above any iOS home-bar safe area.

Then verify via evaluate:
```js
() => {
  const bar = document.querySelector('div.md\\:hidden.fixed.inset-x-0.bottom-0');
  if (!bar) return { found: false };
  const rect = bar.getBoundingClientRect();
  return {
    found: true,
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
    pb: getComputedStyle(bar).paddingBottom,
  };
}
```
Expected: `top` close to viewport height - bar height, `bottom` = viewport height, height ≈ 64px (more on devices with home bar), `pb` returns `env()` resolved value.

- [ ] **Step 4: Verify hidden on desktop**

Resize to `1440x900`, screenshot. Bar should NOT be visible.

- [ ] **Step 5: Commit**

```bash
git add components/MobileActionBar.js app/layout.js
git commit -m "Add sticky bottom Depop CTA bar for mobile"
```

---

## Task 3: Rotating banner with locked min-height

**Files:**
- Modify: `components/SiteBanner.js`

- [ ] **Step 1: Convert SiteBanner to a client component with rotation logic**

Replace the entire contents of `components/SiteBanner.js` with:

```jsx
"use client";

import { useEffect, useState } from "react";

// Two short single-line messages that crossfade every 4s. Both messages
// occupy the same fixed-height slot to prevent CLS. Pauses on
// pointer/touch. Respects prefers-reduced-motion (no auto-rotate; first
// message stays visible).
const MESSAGES = [
  { label: "Free shipping on orders", emphasis: "$45+" },
  { label: "Ships within", emphasis: "24 hours" },
];

const ROTATE_MS = 4000;

export default function SiteBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused || MESSAGES.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <div
      className="sticky top-0 z-[45] w-full h-11 sm:h-14"
      style={{
        background:
          "linear-gradient(180deg, #101714 0%, #0d1611 100%)",
        borderBottom: "1px solid rgba(216, 199, 170, 0.12)",
      }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4 h-full flex items-center justify-center gap-3 sm:gap-4">
        <SparkleMark />
        <div className="relative h-full flex items-center" style={{ minWidth: 0 }}>
          {MESSAGES.map((m, i) => (
            <p
              key={i}
              className="absolute inset-0 flex items-center justify-center gap-2 sm:gap-2.5 text-parchment uppercase font-serif transition-opacity duration-500"
              style={{
                fontSize: "clamp(11px, 0.95vw, 15px)",
                letterSpacing: "0.18em",
                fontWeight: 500,
                whiteSpace: "nowrap",
                opacity: i === index ? 1 : 0,
              }}
              aria-hidden={i !== index}
            >
              <span>{m.label}</span>
              <span
                className="font-chancery"
                style={{
                  color: "#b59a68",
                  fontSize: "clamp(22px, 2vw, 30px)",
                  letterSpacing: "0",
                  textTransform: "none",
                  lineHeight: 1,
                }}
              >
                {m.emphasis}
              </span>
            </p>
          ))}
        </div>
        <SparkleMark />
      </div>
    </div>
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
```

- [ ] **Step 2: Verify the rotation works + no CLS**

Playwright:
```js
async () => {
  // Wait 5 seconds, sample text 3 times to confirm rotation
  const samples = [];
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 1700));
    samples.push(
      Array.from(document.querySelectorAll('.sticky.top-0.z-\\[45\\] p'))
        .filter(p => getComputedStyle(p).opacity === '1')
        .map(p => p.textContent.trim())
    );
  }
  return samples;
}
```
Expected: 3 entries each containing 1 message. Should alternate between "Free shipping on orders $45+" and "Ships within 24 hours".

Visual check: take a screenshot every second for 8 seconds. The banner's bounding box should never change height.

- [ ] **Step 3: Verify pause-on-touch**

```js
async () => {
  const banner = document.querySelector('.sticky.top-0.z-\\[45\\]');
  const before = Array.from(banner.querySelectorAll('p'))
    .findIndex(p => getComputedStyle(p).opacity === '1');
  banner.dispatchEvent(new Event('pointerenter', { bubbles: true }));
  await new Promise(r => setTimeout(r, 6000)); // wait past one rotation tick
  const after = Array.from(banner.querySelectorAll('p'))
    .findIndex(p => getComputedStyle(p).opacity === '1');
  return { before, after, samePaused: before === after };
}
```
Expected: `samePaused: true`.

- [ ] **Step 4: Commit**

```bash
git add components/SiteBanner.js
git commit -m "Banner: auto-rotate between shipping + delivery messages with fixed-height slot"
```

---

## Task 4: Tightened mobile hero

**Files:**
- Modify: `app/page.js`

- [ ] **Step 1: Read the current page.js**

Use Read tool on `app/page.js` to confirm current structure (Hero + RelicFlipDeck inside, then FeatureCardsRow below).

- [ ] **Step 2: Move flip deck out of hero on mobile, tighten hero**

Modify `app/page.js`. The current page has hero containing title + tagline + flip deck + CTAs all in one section. Rewrite to:

```jsx
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeatureCardsRow from "@/components/FeatureCardsRow";
import RelicFlipDeck from "@/components/RelicFlipDeck";
import Sparkles from "@/components/decor/Sparkles";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";
import { links } from "@/data/products";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 relative pb-24 md:pb-0">
        {/* === HERO === Tightened on mobile to fit title + tagline + CTA in one dvh. */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(circle at 50% 55%, rgba(63, 143, 145, 0.18), transparent 38%)," +
                "radial-gradient(circle at 50% 10%, rgba(216, 199, 170, 0.04), transparent 30%)," +
                "linear-gradient(180deg, #0d1611 0%, #101714 60%, #0d1611 100%)",
            }}
            aria-hidden
          />
          <Sparkles count={28} intensity="magical" />

          <div className="relative mx-auto max-w-5xl px-5 sm:px-8 pt-6 pb-10 md:pt-16 md:pb-20 flex flex-col items-center text-center min-h-[calc(100dvh-108px)] md:min-h-0 justify-center">
            <h1
              className="font-chancery text-parchment"
              style={{
                fontSize: "clamp(54px, 12vw, 132px)",
                fontWeight: 400,
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              <span className="block">Yani</span>
              <span className="block">Relics</span>
            </h1>

            <MoonPhaseDivider className="my-5 sm:my-8 max-w-[200px]" />

            <p
              className="font-serif text-cream/85 max-w-md mb-7 sm:mb-10"
              style={{ fontSize: "clamp(15px, 1.3vw, 18px)", lineHeight: 1.45 }}
            >
              Handmade labradorite relics
              <br /> for soft witches and moonlit souls.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center">
              <Link href="/shop" className="btn-relic">
                View Relics
              </Link>
              <a
                href={links.depop}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-relic-link"
              >
                Shop on Depop →
              </a>
            </div>
          </div>
        </section>

        {/* === FLIP DECK section === Moved out of hero, becomes its own section. */}
        <section className="relative mx-auto max-w-5xl px-5 sm:px-8 py-10 md:py-20">
          <RelicFlipDeck accent="gold" />
        </section>

        {/* === FEATURE CARDS === */}
        <section className="relative mx-auto max-w-7xl px-5 sm:px-8 py-10 md:py-20">
          <FeatureCardsRow variant="tall" />
        </section>
      </main>
      <Footer />
    </>
  );
}
```

Key changes:
- `min-h-[calc(100dvh-108px)] md:min-h-0` on hero so it fills the visible viewport below banner+header
- `pt-6 pb-10` on mobile vs `md:pt-16 md:pb-20` on desktop
- Flip deck is now a separate `<section>` below hero
- Hero CTAs use existing `.btn-relic` + `.btn-relic-link` classes
- `pb-24 md:pb-0` on `<main>` reserves space for the mobile sticky bottom bar (so content doesn't go under it)

- [ ] **Step 3: Verify in browser at 390x844**

```js
() => {
  const hero = document.querySelector('section');
  const rect = hero.getBoundingClientRect();
  return {
    heroTop: rect.top,
    heroBottom: rect.bottom,
    heroHeight: rect.height,
    viewportHeight: window.innerHeight,
    fitsInOneViewport: rect.bottom <= window.innerHeight,
  };
}
```
Expected on 390×844: `fitsInOneViewport: true`. Hero ends within the first viewport.

Screenshot at full viewport — title, divider, tagline, CTAs all visible above the fold.

- [ ] **Step 4: Verify desktop is unchanged**

Resize to 1440×900, screenshot. Should look identical to before this task.

- [ ] **Step 5: Commit**

```bash
git add app/page.js
git commit -m "Hero: tighten to fit one dvh on mobile, move flip deck to own section"
```

---

## Task 5: Full-screen mobile product modal (with focus trap)

**Files:**
- Modify: `components/ProductDetail.js`

- [ ] **Step 1: Add focus-trap helper + slide-up animation**

Rewrite `components/ProductDetail.js`:

```jsx
"use client";

import { useEffect, useRef } from "react";
import WaxSeal from "@/components/decor/WaxSeal";
import ProductGallery from "@/components/ProductGallery";
import { links } from "@/data/products";

export default function ProductDetail({ product, onClose }) {
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (!product) return;
    // Save scroll position + opener
    savedScrollY.current = window.scrollY;
    openerRef.current = document.activeElement;

    // Lock body scroll (iOS-safe: position fixed with saved scroll)
    const body = document.body;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY.current}px`;
    body.style.left = "0";
    body.style.right = "0";

    // Focus first focusable inside modal
    const focusable = dialogRef.current?.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab" && focusable && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      body.style.overflow = "";
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      window.scrollTo(0, savedScrollY.current);
      window.removeEventListener("keydown", onKey);
      // Return focus to opener
      if (openerRef.current && typeof openerRef.current.focus === "function") {
        openerRef.current.focus();
      }
    };
  }, [product, onClose]);

  if (!product) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`relic-${product.id}-title`}
    >
      <button
        className="hidden md:block absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close detail"
        tabIndex={-1}
      />
      <div
        className="relative w-full md:max-w-5xl bg-moss md:border md:border-brass/30 md:rounded-sm md:shadow-2xl md:max-h-[92vh] md:overflow-y-auto h-dvh md:h-auto overflow-y-auto animate-modal-up md:animate-none"
      >
        {/* Sticky close + share buttons on mobile */}
        <div className="sticky top-0 z-10 flex justify-between items-center px-3 py-3 md:px-0 md:py-0 md:absolute md:top-3 md:right-3 md:left-auto md:bg-transparent bg-moss/95 backdrop-blur-sm border-b border-parchment/10 md:border-0">
          <ShareButton product={product} />
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-forest/85 border border-brass/40 text-cream hover:text-labradorite-glow flex items-center justify-center"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="grid md:grid-cols-2">
          <div className="relative bg-ink/40 p-3 sm:p-4">
            <ProductGallery
              media={product.media}
              images={product.images || [product.image]}
              alt={product.name}
            />
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
              <WaxSeal label={product.sold ? "Found Home" : "One of One"} />
            </div>
          </div>

          <div className="p-6 sm:p-10 text-cream pb-32 md:pb-10">
            <p className="text-[11px] uppercase tracking-[0.22em] text-brass-light mb-3">
              {product.stone} · Hand-wrapped pendant
            </p>
            <h2 id={`relic-${product.id}-title`} className="font-chancery text-5xl sm:text-6xl mb-3">
              {product.name}
            </h2>
            <p className="font-serif italic text-cream-dim mb-6">{product.fieldNote}</p>

            <div className="hairline mb-6" />

            <p className="leading-relaxed text-cream/90 mb-6">{product.description}</p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-8">
              <div>
                <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">Stone</dt>
                <dd>{product.stone}</dd>
              </div>
              <div>
                <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">Comes with</dt>
                <dd>{product.cordType}</dd>
              </div>
              <div>
                <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">Flash</dt>
                <dd>Blue-green under direct light</dd>
              </div>
              <div>
                <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">Edition</dt>
                <dd>One of one — never repeated</dd>
              </div>
            </dl>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="font-chancery text-5xl text-labradorite-glow">${product.price}</span>
              <span className="text-xs text-cream-dim/70">{product.currency}</span>
            </div>
          </div>
        </div>

        {/* Sticky bottom CTA strip — mobile only */}
        {!product.sold && (
          <div
            className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-moss/95 backdrop-blur-md border-t border-brass/30 px-4 py-3 flex gap-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <a
              href={links.depop}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full bg-labradorite hover:bg-labradorite-light transition-colors text-cream font-medium tracking-wide"
            >
              Shop on Depop
            </a>
            <a
              href={`mailto:${links.email}?subject=Message to claim: ${encodeURIComponent(product.name)}`}
              className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full border border-brass/70 text-cream"
            >
              Message
            </a>
          </div>
        )}

        {/* Desktop CTAs (inline in content) */}
        <div className="hidden md:block px-10 pb-10">
          {product.sold ? (
            <div className="parchment-soft text-ink rounded-sm p-4 text-sm italic font-serif text-center">
              This one has found her person. Hush.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={links.depop}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full bg-labradorite hover:bg-labradorite-light text-cream font-medium"
              >
                Shop on Depop
              </a>
              <a
                href={`mailto:${links.email}?subject=Message to claim: ${encodeURIComponent(product.name)}`}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full border border-brass/70 text-cream"
              >
                Message to Claim
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShareButton({ product }) {
  const onShare = async () => {
    const url = `${window.location.origin}/shop?relic=${product.id}`;
    const data = {
      title: `${product.name} — Yani Relics`,
      text: `${product.name} · $${product.price} · One of One`,
      url,
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard");
      } catch (_) {}
    }
  };
  return (
    <button
      onClick={onShare}
      aria-label="Share this relic"
      className="md:hidden w-9 h-9 rounded-full bg-forest/85 border border-brass/40 text-cream flex items-center justify-center"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 12 V 19 A 1 1 0 0 0 5 20 H 19 A 1 1 0 0 0 20 19 V 12" strokeLinecap="round" />
        <path d="M12 3 V 15" strokeLinecap="round" />
        <path d="M8 7 L 12 3 L 16 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Add modal-up slide animation to globals.css**

Add this keyframe to `app/globals.css` (after the existing `@keyframes drift` block):

```css
@keyframes modal-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.animate-modal-up { animation: modal-up 280ms cubic-bezier(0.22, 0.61, 0.36, 1); }
```

- [ ] **Step 3: Verify in browser**

At 390×844, navigate to `/shop`, click a product image. Verify:
- Modal slides up from bottom
- Fills the full viewport
- Sticky header with share + close buttons stays visible
- Sticky bottom CTA bar (Shop / Message) stays visible
- Body content scrolls between them

Playwright check:
```js
async () => {
  const articles = document.querySelectorAll('article');
  let target;
  for (const a of articles) {
    if (a.textContent.includes('First Frost')) {
      target = a.querySelector('button[aria-label^="View details"]');
      break;
    }
  }
  target?.click();
  await new Promise(r => setTimeout(r, 400));
  const modal = document.querySelector('[role="dialog"]');
  const inner = modal?.querySelector('div.relative.w-full');
  const innerRect = inner?.getBoundingClientRect();
  return {
    modalOpened: !!modal,
    innerHeight: innerRect?.height,
    fillsViewport: innerRect && innerRect.height >= window.innerHeight - 20,
  };
}
```
Expected: `fillsViewport: true` on mobile.

- [ ] **Step 4: Verify desktop is unchanged**

At 1440×900, click a product — modal should be centered, max-w-5xl, with the existing rounded backdrop.

- [ ] **Step 5: Commit**

```bash
git add components/ProductDetail.js app/globals.css
git commit -m "Modal: full-screen on mobile (slide up + focus trap + sticky CTAs), centered on desktop"
```

---

## Task 6: Pinch-to-zoom + native share on product gallery

**Files:**
- Modify: `components/ProductGallery.js`

- [ ] **Step 1: Add pinch + double-tap zoom logic**

In `components/ProductGallery.js`, find the main image container `<div className="relative aspect-square overflow-hidden bg-ink/40 select-none">` and replace its content with a zoom-capable wrapper. Add after the `useEffect` blocks (around line 90) and before `goPrev`/`goNext`:

```jsx
// === Zoom state for touch devices ===
const [zoom, setZoom] = useState(1); // 1 or 2 or 3
const [pan, setPan] = useState({ x: 0, y: 0 });
const lastTap = useRef(0);
const pinchStart = useRef(null); // { distance, zoom }
const lastPan = useRef({ x: 0, y: 0 });

// Reset zoom when slide changes
useEffect(() => {
  setZoom(1);
  setPan({ x: 0, y: 0 });
}, [active]);

const getTouchDistance = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const handleDoubleTap = (e) => {
  const now = Date.now();
  if (now - lastTap.current < 300) {
    setZoom((z) => (z === 1 ? 2 : 1));
    setPan({ x: 0, y: 0 });
  }
  lastTap.current = now;
};

const onZoomTouchStart = (e) => {
  if (e.touches.length === 2) {
    pinchStart.current = {
      distance: getTouchDistance(e.touches),
      zoom,
    };
  } else if (e.touches.length === 1 && zoom > 1) {
    lastPan.current = {
      x: e.touches[0].clientX - pan.x,
      y: e.touches[0].clientY - pan.y,
    };
  }
};

const onZoomTouchMove = (e) => {
  if (e.touches.length === 2 && pinchStart.current) {
    e.preventDefault();
    const newDist = getTouchDistance(e.touches);
    const ratio = newDist / pinchStart.current.distance;
    const newZoom = Math.max(1, Math.min(3, pinchStart.current.zoom * ratio));
    setZoom(newZoom);
  } else if (e.touches.length === 1 && zoom > 1) {
    e.preventDefault();
    setPan({
      x: e.touches[0].clientX - lastPan.current.x,
      y: e.touches[0].clientY - lastPan.current.y,
    });
  }
};

const onZoomTouchEnd = () => {
  pinchStart.current = null;
  if (zoom < 1.1) {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }
};
```

Then modify the existing `<div className="relative aspect-square overflow-hidden bg-ink/40 select-none">` opening to also include the zoom handlers — combine with the existing swipe handlers (the swipe handlers should only fire when `zoom === 1`):

```jsx
<div
  className="relative aspect-square overflow-hidden bg-ink/40 select-none"
  onTouchStart={(e) => {
    onZoomTouchStart(e);
    if (zoom === 1 && e.touches.length === 1) onTouchStart(e);
  }}
  onTouchMove={(e) => {
    onZoomTouchMove(e);
    if (zoom === 1 && e.touches.length === 1) onTouchMove(e);
  }}
  onTouchEnd={(e) => {
    onZoomTouchEnd();
    if (zoom === 1) onTouchEnd();
  }}
  onClick={handleDoubleTap}
>
```

Then wrap the `<Image>` and `<video>` elements inside each slide in a transformed container:

For each `<div className={`absolute inset-0 transition-opacity duration-500 ${...}`} aria-hidden={i !== active}>` block, wrap its child with:

```jsx
<div
  style={{
    width: "100%",
    height: "100%",
    transform: i === active ? `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` : undefined,
    transformOrigin: "center",
    transition: pinchStart.current ? "none" : "transform 200ms ease-out",
  }}
>
  {/* existing <Image> or <video> goes here */}
</div>
```

- [ ] **Step 2: Verify pinch-to-zoom works**

This is hard to test via Playwright (no real pinch gestures). Visual + manual test on a real device required for full verification. Programmatic sanity check:

```js
() => {
  const wrapper = document.querySelector('.relative.aspect-square');
  const hasTouchHandlers = wrapper.ontouchstart !== null || true; // React attaches via event delegation
  return { foundWrapper: !!wrapper };
}
```

For automated verification, simulate double-tap behavior by firing click twice rapidly:

```js
async () => {
  const wrapper = document.querySelector('.relative.aspect-square');
  wrapper.click();
  await new Promise(r => setTimeout(r, 100));
  wrapper.click();
  await new Promise(r => setTimeout(r, 300));
  // Check if any descendant has transform with scale > 1
  const transformed = wrapper.querySelector('[style*="scale"]');
  return {
    found: !!transformed,
    transform: transformed?.getAttribute('style'),
  };
}
```
Expected: transformed div has `scale(2)` after double-tap.

- [ ] **Step 3: Commit**

```bash
git add components/ProductGallery.js
git commit -m "Gallery: pinch-to-zoom + double-tap zoom on touch devices"
```

---

## Task 7: Lazy load + shared blur placeholder

**Files:**
- Modify: `data/products.js`
- Modify: `components/ProductCard.js`
- Modify: `components/ProductGallery.js`
- Modify: `components/RelicFlipDeck.js`

- [ ] **Step 1: Add shared blur data URL to products.js**

At the end of `data/products.js`, after the `links` export, add:

```js
// 4x6 pixel dark-forest gradient encoded as base64 PNG.
// Used as the `blurDataURL` placeholder while real product images load.
// Matches the brand palette so the swap is invisible.
export const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAYAAAAaTw1eAAAAJklEQVR4nGNgYGBgcCsuM2BgYGCob6lnYGBgYGB4+/45IzMzMwMA8BMFmCgkM98AAAAASUVORK5CYII=";
```

- [ ] **Step 2: Use BLUR_DATA_URL in ProductCard**

In `components/ProductCard.js`, import the constant at the top:

```js
import { BLUR_DATA_URL } from "@/data/products";
```

Then on every `<Image>` in this file (there are several — find them by searching for `<Image\n` or `<Image `), add the two props:

```jsx
placeholder="blur"
blurDataURL={BLUR_DATA_URL}
```

Example (one of the variants):
```jsx
<Image
  src={product.image}
  alt={product.name}
  fill
  className="object-cover sepia-[0.15] group-hover/img:scale-105 transition-transform duration-700"
  sizes="120px"
  placeholder="blur"
  blurDataURL={BLUR_DATA_URL}
/>
```

Apply this to all `<Image>` instances in `ProductCard.js`.

- [ ] **Step 3: Same in ProductGallery**

In `components/ProductGallery.js`, import `BLUR_DATA_URL` and add the same two props to the main `<Image>` and the thumbnail `<Image>`.

- [ ] **Step 4: Same in RelicFlipDeck**

In `components/RelicFlipDeck.js`, import `BLUR_DATA_URL` and add the same to the `<Image>` in the `FrontCard` component.

- [ ] **Step 5: Verify blur appears before image loads**

Test by throttling network to "Slow 3G" in DevTools, hard-reload `/shop`, watch cards — should show a soft dark blur, then crossfade to the real image.

Playwright programmatic check (only confirms props are set):
```js
() => {
  const imgs = document.querySelectorAll('img');
  // Next.js renders a separate <img> for placeholders; sometimes inline styles
  // contain the data:image base64. Check that the props are reaching the DOM.
  return {
    count: imgs.length,
    sampleSrc: imgs[0]?.src?.slice(0, 30),
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add data/products.js components/ProductCard.js components/ProductGallery.js components/RelicFlipDeck.js
git commit -m "Lazy load: add shared blur data-URL placeholder to all product images"
```

---

## Task 8: Feature cards — horizontal swipe-strip on mobile

**Files:**
- Modify: `components/FeatureCardsRow.js`

- [ ] **Step 1: Switch grid to mobile flex-snap, keep desktop grid**

In `components/FeatureCardsRow.js`, find:

```jsx
<div className={`grid grid-cols-2 lg:grid-cols-4 ${gap}`}>
```

Replace with:

```jsx
{/* Mobile: horizontal swipe-strip with snap. Desktop: 4-col grid. */}
<div className="overflow-x-auto lg:overflow-visible -mx-3 sm:mx-0 pb-3 lg:pb-0 snap-x snap-mandatory lg:snap-none no-scrollbar">
  <div className="flex lg:grid lg:grid-cols-4 gap-4 sm:gap-5 px-3 lg:px-0 lg:mx-auto">
```

And update the inner mapping. Find the `cards.map((c, i) => (...))` and wrap each `<FeatureCard>` in a snap-sized container:

```jsx
{cards.map((c, i) => (
  <div
    key={i}
    className="flex-shrink-0 w-[60vw] max-w-[240px] lg:w-auto lg:max-w-none snap-center"
  >
    <FeatureCard card={c} aspect={aspect} />
  </div>
))}
```

And close the new wrapper `</div></div>` correctly.

- [ ] **Step 2: Verify at 390×844**

Screenshot — should see 1.5-2 cards visible, with a peek of the next card on the right. Swipe scrolls horizontally with snap-to-center.

```js
() => {
  const strip = document.querySelector('.snap-x.snap-mandatory');
  if (!strip) return { found: false };
  return {
    isOverflowX: strip.scrollWidth > strip.clientWidth,
    cardCount: strip.querySelectorAll('.snap-center').length,
  };
}
```
Expected: `isOverflowX: true` (content wider than container, so scroll works), `cardCount: 4`.

- [ ] **Step 3: Verify desktop is unchanged**

At 1440×900, screenshot. Should see all 4 cards in a row (grid).

- [ ] **Step 4: Commit**

```bash
git add components/FeatureCardsRow.js
git commit -m "Feature cards: horizontal swipe-strip on mobile, grid on desktop"
```

---

## Task 9: Flip deck — 3-card row on mobile (rewrite)

**Files:**
- Modify: `components/RelicFlipDeck.js`

- [ ] **Step 1: Change DECK_SIZE behavior to be responsive**

At the top of `components/RelicFlipDeck.js`, find:
```js
const DECK_SIZE = 5;
```

Replace with:
```js
const DESKTOP_DECK_SIZE = 5;
const MOBILE_DECK_SIZE = 3;
```

Then add a hook to detect mobile (inside the `RelicFlipDeck` component, before the `useState`):

```js
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  const mq = window.matchMedia("(max-width: 639px)");
  const update = () => setIsMobile(mq.matches);
  update();
  mq.addEventListener("change", update);
  return () => mq.removeEventListener("change", update);
}, []);
const deckSize = isMobile ? MOBILE_DECK_SIZE : DESKTOP_DECK_SIZE;
```

Then change every `DECK_SIZE` constant reference (initial useState, etc.) to `deckSize`.

- [ ] **Step 2: Replace the mobile carousel with a 3-card row**

Find the existing JSX block that renders the cards (around `<div className="overflow-x-auto sm:overflow-visible ...">`). Replace the entire scroll-snap container with:

```jsx
{/* Mobile: 3-card row, no scroll. Desktop: 5-col grid. */}
<div className="flex sm:grid sm:grid-cols-5 gap-3 sm:gap-5 px-3 sm:px-4 max-w-5xl mx-auto justify-center">
  {cards.map((card, i) => (
    <div
      key={i}
      data-card-slot
      className="flex-1 max-w-[120px] sm:max-w-none sm:w-auto"
    >
      <FlipCard
        card={card}
        symbol={SYMBOLS[i]}
        onFlip={() => handleFlip(i)}
        borderColor={borderColor}
      />
    </div>
  ))}
</div>
```

Remove the now-unused mobile dot indicators block (`<div className="flex sm:hidden ..."`) and the `handleScroll` + `scrollToCard` functions + `scrollRef`. Keep `activeIdx` only if used elsewhere — otherwise remove that too.

- [ ] **Step 3: Verify at 390×844**

Screenshot the flip deck section. Expected: 3 face-down cards in a single tight row, all visible without scrolling.

```js
() => {
  const slots = document.querySelectorAll('[data-card-slot]');
  return { count: slots.length };
}
```
Expected: 3 on mobile.

- [ ] **Step 4: Verify desktop unchanged**

At 1440×900: 5 cards in a row.
```js
() => document.querySelectorAll('[data-card-slot]').length
```
Expected: 5.

- [ ] **Step 5: Commit**

```bash
git add components/RelicFlipDeck.js
git commit -m "Flip deck: 3-card tight row on mobile, 5-card grid on desktop"
```

---

## Task 10: Drawer polish — safe-area + larger tap targets + stagger

**Files:**
- Modify: `components/Header.js`

- [ ] **Step 1: Add safe-area padding + min-height tap targets**

In `components/Header.js`, find the mobile drawer's `<nav>` inside the slide-down drawer block:

```jsx
<nav
  className="relative h-full flex flex-col items-center justify-center gap-7 px-6 text-center"
  aria-label="Mobile"
>
```

Replace with:

```jsx
<nav
  className="relative h-full flex flex-col items-center justify-center gap-6 px-6 text-center pt-safe pb-safe"
  aria-label="Mobile"
>
```

Then find each drawer link:
```jsx
className="font-serif text-3xl text-parchment hover:text-labradorite-light transition-colors uppercase tracking-[0.12em]"
```

Replace with (add min-height + padding for tap target):
```jsx
className="font-serif text-3xl text-parchment hover:text-labradorite-light transition-colors uppercase tracking-[0.12em] min-h-[48px] flex items-center"
```

- [ ] **Step 2: Add staggered entry animation to drawer links**

Wrap each drawer link in a span with inline animation delay:

```jsx
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
```

- [ ] **Step 3: Verify**

At 390×844, click hamburger. Drawer slides down. Each nav link should fade-in with a small upward translate, staggered 40ms apart.

- [ ] **Step 4: Commit**

```bash
git add components/Header.js
git commit -m "Drawer: safe-area padding, 48px tap targets, staggered link entry"
```

---

## Task 11: Back-to-top button

**Files:**
- Create: `components/BackToTop.js`
- Modify: `app/layout.js`

- [ ] **Step 1: Create the component**

Create `components/BackToTop.js`:

```jsx
"use client";

import { useEffect, useState } from "react";

/**
 * Floating "back to top" button. Appears after scrolling past 800px.
 * Mobile only (md:hidden). Positioned above the sticky bottom bar.
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
        bottom: "calc(5.5rem + env(safe-area-inset-bottom))", // above the action bar
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 19 L 12 5 M5 12 L 12 5 L 19 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Mount in layout.js**

Modify `app/layout.js`. Add import:

```js
import BackToTop from "@/components/BackToTop";
```

Add `<BackToTop />` to the body (before `<CursorSparkleTrail />`):

```jsx
<body className="min-h-full flex flex-col bg-forest text-cream font-sans">
  <SiteBanner />
  {children}
  <MobileActionBar />
  <BackToTop />
  <CursorSparkleTrail />
</body>
```

- [ ] **Step 3: Verify**

At 390×844, navigate to `/` and scroll past 800px. Back-to-top button should appear bottom-right above the sticky action bar.

```js
async () => {
  window.scrollTo(0, 900);
  await new Promise(r => setTimeout(r, 100));
  const btn = document.querySelector('button[aria-label="Back to top"]');
  return {
    found: !!btn,
    opacity: btn ? getComputedStyle(btn).opacity : null,
  };
}
```
Expected: `opacity: "1"`.

Click it:
```js
async () => {
  document.querySelector('button[aria-label="Back to top"]')?.click();
  await new Promise(r => setTimeout(r, 800));
  return { scrollY: window.scrollY };
}
```
Expected: `scrollY: 0`.

- [ ] **Step 4: Commit**

```bash
git add components/BackToTop.js app/layout.js
git commit -m "Add back-to-top button (mobile only, shows past 800px)"
```

---

## Task 12: Scroll restoration on shop filter changes + query-param relic open

**Files:**
- Modify: `app/shop/page.js`

- [ ] **Step 1: Use URL query param to open a specific relic + preserve scroll on filter**

Rewrite `app/shop/page.js`:

```jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";
import { products } from "@/data/products";

export default function ShopPage() {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("all");
  const filterScrollY = useRef(0);
  const searchParams = useSearchParams();

  const available = products.filter((p) => !p.sold);
  const sold = products.filter((p) => p.sold);
  const list = filter === "available" ? available : filter === "sold" ? sold : products;

  // Open a specific relic if ?relic=r-XX in URL (from a shared link)
  useEffect(() => {
    const relicId = searchParams.get("relic");
    if (!relicId) return;
    const found = products.find((p) => p.id === relicId);
    if (found) setOpen(found);
  }, [searchParams]);

  // Preserve scroll position when filter changes
  const onFilterChange = (key) => {
    filterScrollY.current = window.scrollY;
    setFilter(key);
  };

  useEffect(() => {
    window.scrollTo(0, filterScrollY.current);
  }, [filter]);

  return (
    <>
      <Header />
      <main className="flex-1 pb-24 md:pb-0">
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-12 pb-6 md:pt-20">
          <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-3">
            Relics
          </p>
          <h1 className="font-chancery text-5xl sm:text-7xl text-cream text-center mb-4">
            The shop, tonight.
          </h1>
          <p className="text-cream-dim text-center max-w-2xl mx-auto mb-8">
            Every piece is one-of-one. When she&apos;s found her person, she&apos;s gone for good. Tap any
            relic for her field notes.
          </p>
          <MoonPhaseDivider />

          <div className="flex justify-center gap-2 mt-6 mb-10">
            {[
              { key: "all", label: `All (${products.length})` },
              { key: "available", label: `Available (${available.length})` },
              { key: "sold", label: `Found Home (${sold.length})` },
            ].map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => onFilterChange(f.key)}
                  className={`text-xs uppercase tracking-[0.18em] px-4 py-2 rounded-full border transition-colors ${
                    active
                      ? "bg-labradorite text-cream border-labradorite"
                      : "border-brass/40 text-cream-dim hover:border-labradorite-light hover:text-labradorite-glow"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {list.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                variant="grid"
                animation="magical"
                onOpen={setOpen}
                index={i}
              />
            ))}
          </div>

          {list.length === 0 && (
            <p className="text-center text-cream-dim italic font-serif py-16">
              Nothing here in this view. Try another filter.
            </p>
          )}
        </section>

        <ProductDetail product={open} onClose={() => setOpen(null)} />
      </main>
      <Footer />
    </>
  );
}
```

Key changes:
- `useSearchParams` reads `?relic=r-XX` and auto-opens the matching relic
- `filterScrollY` ref captures scroll position before filter changes
- `useEffect` on `filter` restores the captured position after re-render
- `pb-24 md:pb-0` on `<main>` reserves space for sticky bottom bar

- [ ] **Step 2: Verify filter preserves scroll**

```js
async () => {
  window.scrollTo(0, 600);
  await new Promise(r => setTimeout(r, 100));
  const before = window.scrollY;
  const availableBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Available'));
  availableBtn?.click();
  await new Promise(r => setTimeout(r, 300));
  return { before, after: window.scrollY, preserved: Math.abs(window.scrollY - before) < 50 };
}
```
Expected: `preserved: true`.

- [ ] **Step 3: Verify ?relic=r-01 opens the modal**

Navigate to `http://localhost:3939/shop?relic=r-01`, expect First Frost's modal to be visible immediately.

```js
async () => {
  await new Promise(r => setTimeout(r, 500));
  const modal = document.querySelector('[role="dialog"]');
  const title = modal?.querySelector('h2')?.textContent;
  return { modalOpen: !!modal, title };
}
```
Expected: `title: "First Frost"`.

- [ ] **Step 4: Commit**

```bash
git add app/shop/page.js
git commit -m "Shop: scroll restoration on filter change + ?relic=ID query-param routing"
```

---

## Task 13: Tap-burst sparkles (touch devices only)

**Files:**
- Create: `components/decor/TapBurstSparkles.js`
- Modify: `app/layout.js`

- [ ] **Step 1: Create the component**

Create `components/decor/TapBurstSparkles.js`:

```jsx
"use client";

import { useEffect, useRef, useState } from "react";

const MAX_PARTICLES = 20;
const TTL_MS = 700;
const PARTICLES_PER_TAP = 7;

/**
 * Tap-burst sparkles. On touch-primary devices, listens for pointerdown
 * events globally. On each tap (excluding taps on interactive elements
 * like buttons/links/inputs), emits a small burst of stars from the tap
 * point that fan outward and fade. Respects prefers-reduced-motion.
 */
export default function TapBurstSparkles() {
  const [particles, setParticles] = useState([]);
  const idRef = useRef(0);
  const isCoarseRef = useRef(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    isCoarseRef.current = window.matchMedia("(pointer: coarse)").matches;
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isCoarseRef.current || reducedMotionRef.current) return;

    const onPointerDown = (e) => {
      if (e.pointerType === "mouse") return; // only fire on touch/pen
      // Skip interactive elements so we don't compete with their feedback
      if (e.target.closest("button, a, input, select, textarea, [role='button'], [contenteditable]")) return;

      const burst = Array.from({ length: PARTICLES_PER_TAP }).map((_, i) => {
        const id = ++idRef.current;
        // Fan outward in a 60° arc centered upward
        const angle = (-90 + (i / (PARTICLES_PER_TAP - 1) - 0.5) * 60) * (Math.PI / 180);
        const distance = 35 + Math.random() * 25;
        return {
          id,
          x: e.clientX,
          y: e.clientY,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          isStar: Math.random() > 0.4,
          size: 4 + Math.random() * 4,
        };
      });

      setParticles((prev) => {
        const next = [...prev, ...burst];
        if (next.length > MAX_PARTICLES) {
          return next.slice(next.length - MAX_PARTICLES);
        }
        return next;
      });

      window.setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !burst.find((b) => b.id === p.id)));
      }, TTL_MS);
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
            willChange: "transform",
          }}
        >
          <span
            className="block"
            style={{
              animation: `tap-burst ${TTL_MS}ms ease-out forwards`,
              ["--dx"]: `${p.dx}px`,
              ["--dy"]: `${p.dy}px`,
            }}
          >
            {p.isStar ? <StarSVG size={p.size} /> : <Dot size={p.size} />}
          </span>
        </span>
      ))}
    </div>
  );
}

function StarSVG({ size }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      style={{
        filter:
          "drop-shadow(0 0 4px rgba(111, 198, 200, 0.9)) drop-shadow(0 0 1px rgba(232, 230, 210, 1))",
      }}
      aria-hidden
    >
      <path
        d="M10 0 L12.2 7.3 L20 7.3 L13.9 11.7 L16.2 19 L10 14.6 L3.8 19 L6.1 11.7 L0 7.3 L7.8 7.3 Z"
        fill="rgba(232, 230, 210, 0.95)"
      />
    </svg>
  );
}

function Dot({ size }) {
  return (
    <span
      className="block rounded-full"
      style={{
        width: size,
        height: size,
        background: "rgba(232, 230, 210, 0.95)",
        boxShadow: "0 0 6px 1px rgba(111, 198, 200, 0.7)",
      }}
    />
  );
}
```

- [ ] **Step 2: Add the burst keyframe to globals.css**

Add after the existing `@keyframes cursor-spark` block in `app/globals.css`:

```css
@keyframes tap-burst {
  0%   { opacity: 0;   transform: scale(0.4) translate(0, 0); }
  20%  { opacity: 1;   transform: scale(1.1) translate(var(--dx), var(--dy)); }
  100% { opacity: 0;   transform: scale(0.6) translate(var(--dx), var(--dy)); }
}
```

- [ ] **Step 3: Mount in layout.js**

Modify `app/layout.js`. Add import:

```js
import TapBurstSparkles from "@/components/decor/TapBurstSparkles";
```

Add to the body (alongside CursorSparkleTrail):

```jsx
<body className="min-h-full flex flex-col bg-forest text-cream font-sans">
  <SiteBanner />
  {children}
  <MobileActionBar />
  <BackToTop />
  <CursorSparkleTrail />
  <TapBurstSparkles />
</body>
```

- [ ] **Step 4: Verify on emulated touch viewport**

Force pointer:coarse via Chrome devtools "touch" mode, navigate to `/`, tap an empty area:

```js
async () => {
  // Programmatically fire a synthetic touch pointerdown on the hero area
  document.body.dispatchEvent(new PointerEvent('pointerdown', {
    pointerType: 'touch',
    clientX: 200,
    clientY: 400,
    bubbles: true,
  }));
  await new Promise(r => setTimeout(r, 100));
  const sparkles = document.querySelectorAll('div.fixed.inset-0.z-\\[60\\] > span');
  return { sparkleCount: sparkles.length };
}
```
Expected: `sparkleCount: 7`.

Tap on a button (e.g., View Relics) — should NOT emit sparkles:
```js
async () => {
  const btn = Array.from(document.querySelectorAll('button, a'))
    .find(el => el.textContent.includes('View Relics'));
  btn?.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 200, bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  return { sparkleCount: document.querySelectorAll('div.fixed.inset-0.z-\\[60\\] > span').length };
}
```
Expected: no NEW sparkles from this tap (previous ones may still be in flight).

- [ ] **Step 5: Commit**

```bash
git add components/decor/TapBurstSparkles.js app/globals.css app/layout.js
git commit -m "Add tap-burst sparkles (touch devices only, skips interactive elements)"
```

---

## Task 14: Final integration check + push

**Files:** (no code changes)

- [ ] **Step 1: Run all routes at mobile + desktop**

For each route (`/`, `/shop`, `/about`, `/faq`, `/contact`):

1. Resize to 390×844
2. Navigate
3. Screenshot
4. Verify: banner rotates, sticky bottom bar shows, hero fits, no console errors
5. Resize to 1440×900
6. Navigate
7. Screenshot
8. Verify: no mobile-only elements visible, layout looks like before

- [ ] **Step 2: Test sharing flow end-to-end**

At 390×844:
1. Open `/shop`
2. Tap a product image
3. Tap share button in modal
4. Verify `navigator.share` is called or clipboard contains `/shop?relic=r-01`

- [ ] **Step 3: Push everything**

```bash
git log --oneline -15  # confirm all commits are there
git push origin main
```

- [ ] **Step 4: Verify production**

Wait ~60s for Vercel auto-deploy, then `curl -sI https://yani-relic.vercel.app/ | head -3` — expect `HTTP/2 200`.

- [ ] **Step 5: Done**

```bash
git tag v1-mobile-ux-upgrade
git push origin v1-mobile-ux-upgrade
```

---

## Risks revisited (carried from spec)

| Risk | Mitigation in this plan |
|---|---|
| `100vh` cut off by iOS Safari address bar | Task 1 adds `.h-dvh` utility; Tasks 5/11 use it |
| Notch / home-bar overlap with sticky bars | Task 1 adds `.pb-safe`; Tasks 2/11/5 use `env(safe-area-inset-bottom)` |
| Rotating banner causes CLS | Task 3 locks min-height via parent `h-11 sm:h-14` and absolute-positions all messages |
| Modal scroll lock breaks on iOS | Task 5 uses `position: fixed` + saved `scrollY` + restoration on close |
| Focus trap missing | Task 5 implements Tab cycling + return to opener |
| Tap-burst hits buttons | Task 13 uses `e.target.closest("button, a, input, ...")` skip |
| Sparkles overwhelm mid-range Android | Task 13 caps at 20 particles, uses `transform` not layout |
| Black Chancery under 16px unreadable | Already addressed in code — chancery only used at 20px+; smaller labels remain Inter/Cormorant. No new chancery usage in this plan |
| `/shop?relic=r-01` shared link | Task 12 reads `useSearchParams` and auto-opens matching relic |

---

## Self-review notes

Spec coverage checked against `docs/superpowers/specs/2026-06-10-mobile-ux-upgrade-design.md`:

- ✓ Item 1 (foundation) → Task 1
- ✓ Item 2 (sticky bottom bar) → Task 2
- ✓ Item 3 (rotating banner) → Task 3
- ✓ Item 4 (tighten hero) → Task 4
- ✓ Item 5 (full-screen modal) → Task 5
- ✓ Item 6 (pinch-zoom) → Task 6 (combined with share)
- ✓ Item 7 (share button) → Task 6
- ✓ Item 8 (lazy + blur) → Task 7
- ✓ Item 9 (feature cards strip) → Task 8
- ✓ Item 10 (3-card flip deck) → Task 9
- ✓ Item 11 (drawer polish) → Task 10
- ✓ Item 12 (back-to-top) → Task 11
- ✓ Item 13 (scroll restoration + ?relic) → Task 12
- ✓ Item 14 (tap sparkles) → Task 13
- ✓ Final QA + push → Task 14

Order matches spec's recommended sequence (foundation → CTAs → space-savers → modal → enhancements → polish).

All steps contain actual code, exact file paths, and verification commands. No "TBD" / "etc." / "similar to" placeholders.
