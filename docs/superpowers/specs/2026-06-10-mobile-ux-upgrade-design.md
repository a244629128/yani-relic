# Mobile UX Upgrade — Yani Relics

**Date**: 2026-06-10
**Status**: Approved (design), pending implementation plan
**Scope**: Mobile-only behavior for `/`, `/shop`, `/about`, `/faq`, `/contact`. Desktop unchanged.

---

## Goal

Bring the mobile experience to parity with desktop on a small handmade-jewelry ecommerce site. Today's mobile is functional but feels like a scaled-down desktop — vertical space is loose, conversion paths are hidden behind hamburger taps, and the magical effects that carry the desktop brand are absent on phones. Mobile is where most traffic actually lives.

## Non-goals

- No backend / payment changes (still display-only, links to Depop)
- No redesign of color, type, or brand voice
- No changes to desktop layout
- No PWA / offline mode
- No analytics / pixel work (separate scope)

## Architecture

The mobile upgrade is **14 items grouped into 5 themes**:

| Theme | Items | Why |
|---|---|---|
| **Foundation** | Safe-area + dynamic-viewport CSS utilities | Everything sticky / fixed / full-screen depends on these being right on iOS |
| **Conversion plumbing** | Sticky bottom Depop bar | Always-available CTA. Biggest mobile conversion win |
| **Vertical-space diet** | Rotating banner, tightened hero, compressed feature cards, 3-card flip deck | Mobile homepage reaches below-the-fold faster; first impression more dense |
| **Product detail upgrade** | Full-screen mobile modal, pinch-to-zoom, native share | Jewelry needs close inspection + frictionless sharing |
| **Magical mobile feel** | Tap-burst sparkles, blur placeholders | Mobile equivalents to desktop's cursor trail + smooth perceived load |
| **Quality-of-life** | Back-to-top button, scroll restoration | Standard ecommerce expectations |

Items are independent components that drop into the existing component tree. No major restructure of `app/` routes.

---

## Per-item designs

### 1. Foundation — viewport + safe-area CSS utilities

**Why first**: Sticky bar, full-screen modal, and rotating banner all depend on these. Without them, iOS adds a phantom 100px gap (notch + home bar) or content gets eaten by Safari's address bar.

**Add to `app/globals.css`**:
```css
/* Use dynamic viewport height where possible — accounts for iOS Safari's
   collapsing address bar. Falls back to 100vh in older browsers. */
.h-dvh { height: 100vh; height: 100dvh; }
.min-h-dvh { min-height: 100vh; min-height: 100dvh; }

/* Safe-area padding — respects iOS notch + home bar */
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.pt-safe { padding-top: env(safe-area-inset-top); }
.px-safe { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
```

Used by: sticky bar (pb-safe), full-screen modal (h-dvh + pb-safe), rotating banner (locked min-height).

---

### 2. Sticky bottom Depop CTA bar

**File**: new `components/MobileActionBar.js`, mounted in `app/layout.js` after `<CursorSparkleTrail />`.

**Visual**:
```
┌────────────────────────────────────────────────┐
│  [⌂ View Relics]   [▢ Depop logo  SHOP ON DEPOP]  │   ← 56px + safe-area
└────────────────────────────────────────────────┘
```

- Solid `#0d1611` bg, parchment hairline top border
- Left: `[icon]` View Relics outline button → `/shop`
- Right: Depop logo SVG + small uppercase `SHOP ON DEPOP` text in a filled brass pill → opens Depop in new tab
- Height: `56px + env(safe-area-inset-bottom)`
- z-index: `40` (banner is `z-[45]`, cursor trail / sparkles `z-60`. Bottom bar at top of viewport-bottom is independent of the top banner so they don't compete)
- Hidden on `md:` and up via `md:hidden`
- Hidden when full-screen product modal is open (modal sets a global state or uses `inert` cascade)

**Depop logo SVG**: Will inline a simple version (~12 lines SVG path). MIT/public asset.

**Why text + logo not logo-only**: Codex flagged that icon-only CTAs hurt clarity. Aritzia/Glossier never make the primary buy action mysterious.

---

### 3. Rotating banner with fixed height

**File**: edit `components/SiteBanner.js`.

**Behavior**:
- Two messages: `"Free shipping on orders $45+"` and `"Ships within 24 hours"`
- Crossfade between them every 4 seconds (opacity transition 600ms)
- Pause when user taps/hovers the banner
- Each message is a single line on mobile — no wrap
- Both messages occupy the same `min-height` box to prevent layout shift (CLS)
- Respect `prefers-reduced-motion` — don't auto-rotate

**Technical**:
- `useState` for active index, `useEffect` with `setInterval`
- Cleanup on unmount
- Pause via `useState(pause)` updated on `onPointerEnter` / `onPointerLeave` / `onTouchStart`

---

### 4. Tightened mobile hero

**File**: edit `app/page.js`.

**Changes** (mobile only — desktop unchanged):
- Title size clamp adjusted so `Yani Relics` + tagline + CTA fit in `100dvh`
- Drop the secondary subtext paragraph (`"One-of-one pieces wrapped by hand…"`) on mobile — visible on desktop only via `hidden md:block`
- Flip deck moves OUT of hero — becomes its own section below hero (currently it's inside)
- CTAs become tighter (less vertical gap)
- Target: title + 1 tagline + 2 CTAs visible in one viewport (100dvh) on a 390×844 device

---

### 5. Full-screen mobile product modal

**File**: edit `components/ProductDetail.js`.

**Mobile (< md)**:
- Modal takes `100dvh` (uses `.h-dvh` foundation)
- Slides up from bottom on open
- Sticky close button (top-right, ~`top-3 right-3` with safe-area padding)
- Sticky bottom CTA strip (~`pb-safe`): "Shop on Depop" + "Message to Claim"
- Body content scrolls between sticky top + bottom
- Image gallery becomes horizontal swipe deck

**Desktop (md+)**: unchanged — centered modal as today.

**Critical risk-mitigation (Codex flagged)**:
- Scroll-lock on body when open (already have this; verify safe-area-inset doesn't break)
- Focus trap inside modal — first focusable on open, return focus to opener on close
- `inert={false}` on modal, `inert={true}` on background page
- `100dvh` not `100vh` so iOS Safari's address bar collapsing doesn't cut the bottom off

---

### 6. Pinch-to-zoom on product gallery images

**File**: edit `components/ProductGallery.js`.

**Behavior**:
- Two-finger pinch on the main image area: scale the image up to 3x
- Double-tap (touch) toggles between 1x and 2x
- Pan when zoomed
- Reset to 1x when switching slide
- Desktop: ignored (no touch)

**Library choice**: avoid heavyweight zoom libraries. Build minimal pinch handler using `pointer` events + `getBoundingClientRect`. ~60 lines.

**Why**: Jewelry buyers want to see stone detail before paying $60-90.

---

### 7. Native share button on product detail

**File**: edit `components/ProductDetail.js`.

**Behavior**:
- Small share icon button next to the close button in modal header
- On tap: call `navigator.share({ title, text, url })`
- Falls back to `navigator.clipboard.writeText(url)` + toast if Web Share API unavailable
- Desktop: same fallback (clipboard)

**URL**: each product needs a stable URL like `/shop?relic=r-01` (query param) so the share link opens directly to the relic. **This is a small URL routing change in `app/shop/page.js`** — read query on mount, auto-open that relic's modal.

---

### 8. Lazy load + blur placeholders

**Files**: `data/products.js` + `components/ProductGallery.js` + `components/ProductCard.js`.

**Approach**:
- Use a single shared dark-forest blur data-URL (~1kb inline) for all product images — simpler than per-image generation, visually identical given our consistent dark theme
- Add `placeholder="blur" blurDataURL={SHARED_BLUR}` to `<Image>` calls in `ProductCard`, `ProductGallery`, and `RelicFlipDeck`
- Keep existing `next/image` lazy loading (already enabled by default)
- Hero image (if reintroduced) stays `priority` and skips the placeholder

**Trade-off**: ~30kb extra in the JS bundle for the placeholder data URLs. Acceptable.

---

### 9. Feature cards — horizontal swipe-strip on mobile

**File**: edit `components/FeatureCardsRow.js`.

**Mobile**: `overflow-x-auto snap-x snap-mandatory no-scrollbar flex` — 4 cards in a single row, ~2 visible at once, swipe for the rest.
**Desktop**: unchanged grid.
**Class**: `.no-scrollbar` utility already exists in `globals.css`.

---

### 10. Flip deck — 3-card tight row on mobile

**File**: edit `components/RelicFlipDeck.js`.

**Current mobile**: 5-card single-card carousel with dot indicators (a real component).
**Target mobile**: 3 face-down cards in a row, each card is 28-30% of viewport width. Tap any card to flip and reveal a random product. No carousel, no dots.

**Implementation**:
- Below `sm:`: render only first 3 cards (or random 3 of 5 symbols), use `flex` instead of `flex-shrink-0 w-[44vw]`
- Above `sm:`: unchanged 5-card grid
- Symbol assignment: pick 3 of 5 (moon, sun, star, eye, hand) per visitor — random — on `useEffect` mount

**Codex risk callout**: this is a real rewrite of the current carousel logic, not a tweak. Budget for it.

---

### 11. Drawer polish

**File**: edit `components/Header.js`.

**Current state**: already fixed in this session (slide-down, solid bg, sibling of header, inert when closed). The "polish" here is minor:
- Verify safe-area on top (`pt-safe` on the inner nav container)
- Larger tap targets for nav links (min-height 48px each — currently text-3xl which is tall but the click target is text-only)
- Subtle slide-in stagger on the menu items (one after another, 50ms apart)

---

### 12. Back-to-top button

**File**: new `components/BackToTop.js`, mounted in `app/layout.js`.

**Behavior**:
- Appears after scrolling past 800px
- Floating button, bottom-right, above the sticky bottom bar
- Small circle, parchment border, moon icon
- On tap: smooth scroll to top
- Hidden on desktop (`md:hidden`) — desktop users scroll-wheel back fine

---

### 13. Scroll restoration

**Files**: `components/ProductDetail.js`, `app/shop/page.js`.

**Modal**: track scroll position when opening modal, restore on close. Today's modal locks body scroll but doesn't restore exact position.

**/shop filter changes**: when user changes filter (All / Available / Sold), preserve scroll. Currently it resets to top.

**Implementation**: `useRef` to capture scrollY before state change, restore in `useEffect` after re-render.

---

### 14. Tap-burst sparkles

**File**: new `components/decor/TapBurstSparkles.js`, mounted in `app/layout.js` (sibling to `CursorSparkleTrail`).

**Behavior**:
- Listen for `pointerdown` events on `document` globally
- Only fires on `matchMedia("(pointer: coarse)").matches` (touch-primary devices)
- On tap: emit 6-8 small star/dot particles at the tap point
- Particles fan outward in a small arc (-30° to +30° around -90° upward), travel ~40-60px
- Fade out over 700ms
- Cap: max 20 concurrent particles
- Ignore taps on buttons, links, form fields (compete with their feedback)
- `pointer-events: none` on the overlay container
- Z-index: 60 (matches existing cursor trail)
- Respect `prefers-reduced-motion`: disable entirely

**Why pointerdown and not click**: faster feedback (no 300ms delay), works on long-press too.

---

## Implementation order

Codex's reordered sequence, slightly adapted to your scope (no search bar, keep "Found her person" poetic):

1. Foundation CSS (safe-area + dynamic viewport utilities)
2. Sticky bottom Depop CTA bar
3. Rotating banner with locked min-height
4. Tightened mobile hero
5. Full-screen mobile product modal (focus trap + scroll lock + 100dvh)
6. Pinch-to-zoom + native share on product detail
7. Lazy load + blur placeholders
8. Feature cards horizontal swipe-strip
9. Flip-deck 3-card row (rewrite)
10. Drawer polish
11. Back-to-top
12. Scroll restoration
13. Tap-burst sparkles (last — after z-index layers are stable)

Total estimated work: ~5 hours of focused implementation. Ships incrementally — each item is a separate commit.

---

## Risks (from Codex's review)

| Risk | Mitigation |
|---|---|
| Mobile Safari address bar collapse breaks `100vh` | Use `100dvh` everywhere (`.h-dvh` utility) |
| iOS notch / home bar overlaps sticky bar | `env(safe-area-inset-bottom)` padding |
| Rotating banner causes CLS | Lock min-height on the banner container |
| Full-screen modal scroll lock breaks on iOS | Set `document.body.style.overflow = 'hidden'` + `position: fixed` + restore `top` from saved scrollY |
| Focus trap missing on modal | Implement first-focusable focus + return-on-close + Tab-cycle |
| Tap-burst hits buttons | Check `e.target.closest('button, a, input')` and skip |
| Tap-burst overwhelms mid-range Android | Cap at 20 particles, use `transform` not layout properties |
| Black Chancery becomes unreadable at small sizes | Keep chancery ≥ 20px on mobile; Inter/Cormorant for smaller labels |
| Sticky bar competes with iOS Safari's address bar | `position: fixed bottom:0` with `pb-safe` works; verify on real device |
| `/shop?relic=r-01` query param routing | Add `useSearchParams` in `app/shop/page.js`, open matching relic in modal on mount |

---

## Test plan

After implementation, run on:

- **Browsers**: iOS Safari (latest), Chrome Android (latest), Chrome desktop (regression)
- **Devices**: 390×844 (iPhone 14), 360×800 (smaller Android), 768+ (tablet for regression)
- **Manual checks**:
  - Sticky bar respects safe-area on notched iPhones
  - Rotating banner doesn't shift layout between messages
  - Full-screen modal opens cleanly, closes cleanly, returns focus to opener
  - Pinch-to-zoom works smoothly, resets on slide change
  - Native share opens system share sheet on iOS/Android
  - Lazy + blur: scroll fast, no blank cards
  - Flip deck shows 3 cards on mobile, 5 on tablet+
  - Back-to-top appears at 800px scroll, disappears at top
  - Tap-burst sparkles don't fire on button taps
  - Drawer focus management when opened/closed
  - All routes return 200 in production after deploy
- **Reduced motion**: enable `prefers-reduced-motion` and verify banner doesn't rotate, sparkles don't fire, drawer slide is instant

---

## Out of scope (Codex suggested but user declined for this round)

- Search bar on `/shop` (defer until product count > 20)
- Explicit "Sold" badge (current poetic "Found her person" stays)

These can be revisited in a future spec.
