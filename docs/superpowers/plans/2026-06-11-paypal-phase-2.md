# Phase 2 — Implementation Plan (PayPal + product pages)

**Date:** 2026-06-11
**Status:** Plan — awaiting Codex review + user confirmation before implementation.

## Goal

Three improvements on top of the working v1 PayPal checkout.
**Implementation order**: 2D → 2A → 2B (per user). 2C deferred.

1. **Dedicated product pages (`/shop/[id]`)** [Phase 2D] — replace the
   modal-based product detail with server-rendered pages. SEO-friendly
   canonical URLs, shareable links with rich previews. Remove "Shop on
   Depop" from the product page (PayPal + Message only).
2. **Oversell detection (档位1)** [Phase 2A] — detect the rare
   same-millisecond race, mark affected order as `'oversold'`, show
   admin warning. **No auto-refund** — owner refunds manually in PayPal
   Dashboard, then clicks "Marked refunded" in our admin.
3. **Auto-mark sold after capture** [Phase 2B] — flip
   `products.sold = true` after a verified durable capture, so the relic
   disappears from `/shop` and the oversell window shrinks to ~10 seconds.

## Deferred from this phase (per user)

- **Phase 2C — Email notifications to owner**: PayPal already sends a
  payment-received email; owner can check `/admin/orders` for shipping
  details. Revisit if checking admin manually becomes a chore.
- Auto-refund the loser of an oversell race (档位2/3 — done later if needed).
- Inventory hold during checkout.
- Buyer-facing thank-you page.
- Auto-list refunded products back as available.
- Friendly slug URLs (/shop/first-frost). User chose stable IDs.

---

## Phase 2D — Dedicated product pages (DO FIRST)

### Why

Modal-only product detail has SEO disadvantages (no canonical URL per
relic, no Open Graph metadata), can't be deep-linked with rich social
previews, and modal UX feels lightweight for what should be the
emotional core of the shop. User wants a beautiful per-product page.

### Decisions locked

| Decision | Choice |
|---|---|
| URL structure | `/shop/r-01`, `/shop/r-02`, … (existing IDs) |
| Card click destination | Direct navigation, modal removed |
| Layout | Split: gallery left, info right (desktop); stacked on mobile |
| Related relics section | Yes — 3 random available relics at the bottom |
| "Shop on Depop" on product page | Removed (per user) |
| "Message to Claim" on product page | Kept |
| Mobile UX | Same dedicated page as desktop (no modal). Sticky bottom bar with "Message to Claim" only. PayPal button stays inline in scrollable content (too tall to be sticky). |

### Files to touch

| File | Change |
|---|---|
| `app/shop/[id]/page.js` (NEW) | Server component. `getProduct(id)` or 404. Renders Header + ProductPageContent + RelatedRelics + Footer. `generateMetadata` for Open Graph: title, description, hero image, type=product. |
| `components/ProductPageContent.js` (NEW) | The non-modal product detail body. Extracted from current ProductDetail JSX. No modal wrapper, no Depop button. PayPal primary, Message secondary. Includes WaxSeal, ProductGallery, description, field note, stone/cord details, price, CTAs. |
| `components/ProductViewTracker.js` (NEW) | Tiny client component. Mounts on product page. Calls `trackView(productId)` in useEffect with cleanup. Same analytics behavior as today's modal-open; just different mount context. |
| `components/RelatedRelics.js` (NEW) | Server component. Takes the current product id + all products as input. Picks up to 3 random available relics (excluding self + sold). Renders as smaller cards using existing ProductCard component. |
| `components/ProductCard.js` | Replace `onClick={onOpen(product)}` with `<Link href={`/shop/${product.id}`}>`. Remove the `onOpen` prop entirely. |
| `app/shop/ShopClient.js` | Remove modal state, remove `<ProductDetail>` mount, remove `?relic=X` searchParam auto-open useEffect. Simplification. |
| `app/shop/page.js` | If `?relic=X` query is present, server-redirect to `/shop/X`. Preserves shareable links from before the migration. |
| `components/ProductDetail.js` | DELETE. Functionality moved to ProductPageContent. |
| `lib/analytics.js` | No change — trackView API is the same. |

### Open Graph metadata

```javascript
// generateMetadata for /shop/[id]/page.js
export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return {};
  return {
    title: `${product.name} — Yani Relics`,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.image ? [{ url: product.image, width: 1200, height: 1200 }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      images: product.image ? [product.image] : [],
    },
  };
}
```

### Analytics tracking semantics on the new page

- Modal open → page mount equivalent: `<ProductViewTracker productId>` mounts
  on the server component and starts the dwell timer in useEffect.
- Modal close → page unmount: `useEffect` cleanup ends the timer, flushes
  `view` event with duration_ms.
- Plus `visibilitychange` and `pagehide` events from the existing
  trackView helper still fire — covers tab close, mobile background.
- Net effect: identical to current modal-based view tracking.

### Visual consistency with homepage

- Same Header + Footer
- Same color palette (deep forest #0d1611, parchment #d8c7aa, brass)
- Same Black Chancery font for hero title
- Same hairline + moon phase decorative elements
- MoonPhaseDivider between sections

### Codex-flagged risks already accounted for

- **MobileActionBar collision**: the global `<MobileActionBar>` rendered by
  `app/layout.js` will overlap our new sticky-bottom "Message" bar on
  `/shop/[id]` pages. Fix: pass a route-aware flag (e.g., hide
  MobileActionBar when pathname starts with `/shop/r-`), OR render the
  product-page sticky bar with higher z-index + adjust safe-area padding
  so they stack. Decision: hide MobileActionBar on product pages — they
  have their own bottom CTA.
- **ProductGallery prop wiring**: `ProductGallery` and
  `PayPalCheckoutButton` are client components mounted inside the new
  server page. Verify `media`, `productId`, `paypalClientId` props thread
  correctly through ProductPageContent.
- **`?relic=r-01` shareable links**: legacy links must redirect to the
  new `/shop/r-01` *before* deleting the modal mount, or those links 404.
  Wire `app/shop/page.js` to detect the searchParam server-side and
  return `redirect('/shop/<id>')`.
- **`ProductViewTracker` re-firing on client nav**: useEffect dep array
  MUST be `[productId]`, not `[]`. Then when user navigates
  `/shop/r-01` → `/shop/r-02` via "More relics", the dwell timer flushes
  + restarts cleanly.

### Effort: ~5 hours (revised up from 3 per Codex)

Breakdown:
- 1.5h — `/shop/[id]/page.js` SSR + generateMetadata + product fetch + 404
- 1.5h — `ProductPageContent.js` (extracted from current ProductDetail,
  Depop CTA removed, layout polished)
- 0.5h — `ProductViewTracker.js` (analytics, deps=[productId])
- 0.5h — `RelatedRelics.js` (server component, 3 random available)
- 0.5h — `ProductCard.js` rewrite (Link instead of onOpen)
- 0.5h — `ShopClient.js` simplification + `app/shop/page.js` redirect for `?relic=`
- (Final QA on mobile sticky-bar collision with MobileActionBar)

---

## Phase 2A — Oversell detection (档位1)

### Why

V1 has a known TOCTOU race in `createPayPalOrder`: two buyers can both pass
the preflight check, both go through PayPal, both capture. The partial
unique index on `(product_id) WHERE status='captured'` prevents both rows
from ever showing `captured`, but the LOSER's money has still been taken by
PayPal — their `paypal_orders` row stays in `created` status while their
funds sit at PayPal with no clear allocation.

Today, the owner won't notice this without digging through PayPal Dashboard
and `/admin/orders` side-by-side. We want a loud, automated nag.

### Architecture

When a capture's DB UPDATE fails with PostgreSQL error code `23505`
(unique_violation on the partial captured index), we know exactly what
happened: PayPal captured but our DB has another captured row for the same
product. That's the unambiguous oversold signal — never a false positive.

We introduce a new status value `'oversold'`:
- Status remains in the existing whitelist (CHECK constraint migration).
- The partial unique index still says `WHERE status='captured'`, so
  `oversold` rows don't conflict.
- An oversold row means: "PayPal took the money, we can't allocate it,
  owner needs to refund manually."

### Files to touch

| File | Change |
|---|---|
| `scripts/paypal-add-oversold-status.sql` (NEW) | Migration: extend status CHECK constraint to allow `'oversold'`. Idempotent. |
| `scripts/paypal-schema.sql` | Update canonical schema with `'oversold'` in the CHECK whitelist + comment. |
| `lib/paypal-actions.js` | In `capturePayPalOrder`: detect 23505 unique violation on the captured UPDATE → second UPDATE sets `status='oversold'` + `raw_payload` includes `{ issue: 'OVERSOLD', payload: capture }`. Returns `{ ok: false, oversold: true, error: <buyer-friendly message> }`. |
| `app/api/paypal/webhook/route.js` | Same detection in the webhook path. If the webhook tries to UPDATE to `captured` but unique-index rejects → set `oversold` instead. |
| `components/PayPalCheckoutButton.js` | When `res.oversold === true`, show a distinct "Claimed at the same moment — refund being processed by the shop owner" message instead of the generic error. |
| `lib/orders-db.js` | Add `getOversoldOrders()` helper. Update `getOrderCounts()` to surface `oversoldCount`. |
| `app/admin/(authed)/orders/page.js` | Add red banner at top when `oversoldCount > 0`: "⚠️ N oversell event(s) detected — refund manually in PayPal Dashboard, then click 'Marked refunded' here." Oversold rows render with distinct red status pill, "Open in PayPal" deep link, and a "Marked refunded" button. |
| `app/admin/(authed)/_components/MarkedRefundedButton.js` (NEW) | Mirror of MarkSoldButton: flips `oversold → refunded`. Server action validates admin session. |
| `lib/paypal-actions.js` | Add `markOrderManuallyRefunded(orderId)` server action. Only flips `oversold` → `refunded`. Requires admin session. |

### Detection logic (key code path)

```javascript
// in capturePayPalOrder, after PayPal capture succeeds
const { error: updateErr } = await sb
  .from("paypal_orders")
  .update({ status: "captured", ... })
  .eq("id", paypalOrderId);

if (updateErr?.code === "23505") {
  // Unique violation on the partial captured index — another buyer beat
  // us to this product. PayPal already took this buyer's money.
  await sb
    .from("paypal_orders")
    .update({
      status: "oversold",
      raw_payload: { issue: "OVERSOLD", payload: capture },
      capture_id: captureRec?.id || null,
      captured_at: new Date().toISOString(),
    })
    .eq("id", paypalOrderId)
    .eq("status", "created"); // safety: only if still in created
  return {
    ok: false,
    oversold: true,
    error: "This piece was claimed by another buyer at the same moment. Your payment will be refunded.",
  };
}
```

### Idempotency

The detection check (`updateErr?.code === "23505"`) is exact and cannot
false-positive. Other DB errors (network blip, timeout) have different
codes and fall through to the existing soft-fail path. Defense-in-depth:
the second UPDATE includes `.eq("status", "created")` so a retry can't
overwrite a row that's already moved to `oversold` or `refunded`.

Match strategy: primary on `error.code === "23505"`; secondary
diagnostic check for `error.message` containing
`uq_po_one_captured_per_product` for logs only (not for branching).

### Codex-flagged risks accounted for (HIGH #5)

If the second UPDATE setting status='oversold' itself fails:
- **In capturePayPalOrder**: log loudly with all available context; return
  `{ ok: false, oversold: true, manualReview: true, error: '...' }` so
  the buyer sees a "captured but needs manual review — contact us"
  message rather than thinking nothing happened.
- **In webhook**: return HTTP 500 so PayPal retries the webhook
  (PayPal redelivers failed webhooks with exponential backoff). Webhook
  is the durability backstop here.
- Either way: row stays in `created` if both attempts fail. The 5-minute
  pending window blocks new buyers; the webhook will retry until the
  oversold marking succeeds.

### Effort: ~2 hours

---

## Phase 2B — Auto-mark sold after capture

### Why

Without this, the loser-buyer in an oversell race has up to several minutes
(the time between capture and admin clicking "Mark sold") during which a
third buyer could open the page and try to buy. Auto-mark sold reduces that
window to ~10 seconds (next-request Vercel revalidate cycle).

### Files to touch

| File | Change |
|---|---|
| `lib/paypal-actions.js` | In `capturePayPalOrder` after successful UPDATE: atomically flip `products.sold = true`. Use a single UPDATE with `WHERE sold = false` to avoid clobbering a manual change. Add `revalidatePath('/')` and `revalidatePath('/shop')`. |
| `app/admin/(authed)/orders/page.js` | The "Mark sold" inline button stays as a fallback (in case auto-flip failed). Update the "needs marking sold" nag query to only count rows where the PRODUCT isn't sold (not where the order's `sold_marked` is false — different concept now). |
| `lib/orders-db.js` | Refactor `getOrderCounts()`: `needsMarkSold` becomes `count of captured orders whose product is still listed as available`. |
| `lib/paypal-actions.js` | `markOrderSold()` server action stays (used by the inline button). Behavior unchanged. |

### Race-safe SQL

```javascript
// inside capturePayPalOrder, AFTER the captured UPDATE returns no error
// AND we have verified the row is now durably status='captured'.
// Codex HIGH #6: gating on PayPal capture success alone is wrong, because
// our DB UPDATE may still have failed. We must only flip sold=true when
// the captured row is actually written.
await sb
  .from("products")
  .update({ sold: true })
  .eq("id", productId)
  .eq("sold", false);  // only if not already sold (don't overwrite manual)
```

### Codex-flagged risks accounted for (HIGH #6)

- Gate auto-sold on **`updateErr === null` AND status was actually
  written**, not on PayPal capture API success alone.
- The webhook may later fire `PAYMENT.CAPTURE.COMPLETED` for the same
  order and try the same `products.sold=true` update. The `WHERE
  sold=false` clause makes the second attempt a no-op — safe and
  idempotent. Tested.

### Effort: ~1 hour

---

## Phase 2C — Email notification to owner on new orders (DEFERRED)

User chose to skip this. Rough notes preserved below for the future; not
implementing now.

### Why

Owner currently has to check `/admin/orders` or PayPal Dashboard to know a
sale happened. An email push is friction-free: phone notification, address
visible immediately, can start packing.

### Choice: Resend (free tier)

- 100 emails/day, 3,000/month free
- Domain verification (yanirelics.com SPF/DKIM/DMARC) — owner does once
- For unverified domains: send from `onboarding@resend.dev` works for
  internal owner notifications (no need to look professional to anyone but
  Yani herself)
- Alternative considered: SendGrid free (100/day), Postmark ($15/mo). Resend
  wins on free-tier simplicity.

### Files to touch

| File | Change |
|---|---|
| `package.json` | `npm install resend` |
| `.env.local` + Vercel env | Add `RESEND_API_KEY`, `OWNER_EMAIL` (where to send the alerts) |
| `lib/email.js` (NEW) | `sendOwnerSaleAlert(order, product)` — formats HTML + plaintext email body. Returns silently on failure (don't break checkout if email fails). |
| `lib/paypal-actions.js` | Call `sendOwnerSaleAlert` after `capturePayPalOrder` successfully flips status to captured. Fire-and-forget — don't await; log errors only. |
| `app/api/paypal/webhook/route.js` | Also call email helper from webhook when status moves to `captured` AND no email has been sent yet. (Idempotency: add `email_sent_at` column.) |
| `scripts/paypal-add-email-tracking.sql` (NEW) | Add `email_sent_at TIMESTAMPTZ` column for idempotency. |

### Email content (draft)

```
Subject: New Yani Relics order — $88 · Old Lantern

A new piece just sold:

  Old Lantern · $88 USD
  Captured: 2026-06-11 18:34

Buyer:
  Sarah Chen · sarah@example.com

Ship to:
  Sarah Chen
  123 Birch Lane
  Portland, OR 97201
  US

Order ID: 5O190127TN364715T

→ View in admin: https://yani-relic.vercel.app/admin/orders
→ View in PayPal: https://www.paypal.com/...

When you ship, mark it sold (or it auto-flipped if you're on the latest
code). When you've removed it from Depop, you're done.
```

### Effort: ~2 hours (includes Resend signup + domain verification walkthrough doc)

---

## Implementation order (locked by user)

```
Phase 2D (product pages)            ─ biggest UX change, do first
   └─ ships standalone, full sandbox test before moving on
Phase 2A (oversell detection)       ─ operational safety net
   └─ small additive change, no big surprises
Phase 2B (auto-mark sold)           ─ tightens the race window
   └─ depends on 2A's understanding of capture-success path
Phase 2C (email notifications)      ─ DEFERRED (skip for now)
```

## Total effort estimate (revised)

| Phase | Estimate |
|---|---|
| 2D | ~5 hours |
| 2A | ~2 hours |
| 2B | ~1 hour |
| **Total** | **~8 hours** |

Each phase is independently revertable and ships in its own commit.

## Decisions noted but not in scope

- **Auto-mark sold rollback path** — if a refund happens later, products
  stay sold by default. Manual relist if owner wants. (Codex agreed.)

## Test plan (each phase)

### 2A — Oversell detection
- Sandbox: open the same product in two browser tabs simultaneously
- Click PayPal in both within ~1 sec of each other
- Approve both
- Verify: one shows "Thank you", one shows "claimed at same moment" message
- Verify: `/admin/orders` shows red banner + the oversold row
- Click "Open in PayPal" → opens PayPal Dashboard at the right transaction
- Refund manually in PayPal
- Click "Marked refunded" in admin → row flips to refunded, banner disappears

### 2B — Auto-mark sold
- Buy any product on sandbox
- Verify: product disappears from `/shop` (or shows "Found Home")
- Verify: `/admin/orders` shows the captured order, no "Mark sold" needed
- Refund manually in PayPal, run cleanup if relisting needed

### 2C — Email notification
- Buy any product on sandbox
- Owner email inbox: receives the alert within seconds
- Format: matches the draft above
- Idempotency: webhook + capture both fire successfully, but only one
  email arrives (email_sent_at deduplicates)
- Failure mode: if Resend API down, checkout still completes; check logs
  for the email error
