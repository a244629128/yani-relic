# PayPal Checkout — Design Doc

**Date:** 2026-06-11
**Owner:** Yani Relics
**Status:** Spec — awaiting user confirmation on open questions before implementation.

## Goal

Add PayPal as a third buying path on each product, **coexisting with Depop**.
Visitor can pay directly on the site via PayPal without leaving for Depop.
Existing "Shop on Depop" + "Message to Claim" CTAs remain untouched.

## Non-Goals (Phase 1)

- **Auto-marking `sold = true`** after a successful PayPal capture. Deferred to v2.
  Owner manually flips sold after they ship and remove from Depop.
- Refund automation (admin handles in PayPal dashboard for now).
- Tax calculation (PayPal can handle later if needed).
- Email receipts from us (PayPal sends its own; we may add Resend in v2).
- Multi-currency (USD only).
- Coupon codes / discounts.
- Multiple items per order (each relic is one-of-one — cart is unnecessary).

## Architecture

```
Buyer's browser
   │
   │  1. Renders PayPal Smart Button via SDK
   │     (script tag with publishable client-id)
   │
   ▼
PayPal Button (in-page popup)
   │
   │  2. onCreateOrder ──► Server Action createPayPalOrder(productId)
   │                              │
   │                              ├─ Re-check product not sold + no live order exists
   │                              ├─ POST /v2/checkout/orders to PayPal API
   │                              └─ Insert paypal_orders row (status='created')
   │                              ◄── returns PayPal order ID
   │
   │  3. Buyer approves in popup
   │
   │  4. onApprove ──► Server Action capturePayPalOrder(orderId)
   │                              │
   │                              ├─ POST /v2/checkout/orders/{id}/capture
   │                              ├─ Update paypal_orders (status='captured', etc.)
   │                              └─ Return success → show "ordered" screen
   │
   ▼
PayPal Webhook ──► /api/paypal/webhook  (defense-in-depth)
                          │
                          ├─ Verify signature with PAYPAL_WEBHOOK_ID
                          └─ Update paypal_orders status (e.g. REFUNDED)
```

Server actions live in `lib/paypal-actions.js`. SDK lives in `lib/paypal.js`
(env var helpers + access token caching). Public component
`<PayPalCheckoutButton productId />` renders the SDK button.

## Schema — `paypal_orders`

```sql
CREATE TABLE paypal_orders (
  id            TEXT PRIMARY KEY,        -- PayPal order ID
  product_id    TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  status        TEXT NOT NULL,           -- 'created' | 'captured' | 'failed' | 'refunded' | 'voided'
  buyer_email   TEXT,
  buyer_name    TEXT,
  shipping_address JSONB,
  payer_id      TEXT,
  capture_id    TEXT,
  raw_payload   JSONB,                   -- capture response for audit
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_at   TIMESTAMPTZ
);

-- RLS: anon = no access. Service role only (admin reads, server actions).
```

## Oversell protection

One-of-one items + coexist mode means we MUST prevent two simultaneous buyers
(one on Depop, one on PayPal, or two on PayPal). Strategy:

At `createPayPalOrder`:
1. Re-read product from DB. If `sold`, reject with "Already claimed."
2. Check `paypal_orders` for any row with the same `product_id` AND
   `status IN ('created', 'captured')` AND `created_at > now() - interval '15 minutes'`.
   If found, reject with "Another buyer is checking out — try again in a few minutes."
3. Insert order row first, then create PayPal order. Race window is small but
   real. Acceptable for hobby scale.

This is **belt-and-suspenders**, not bulletproof. With deferred auto-sold, the
owner still has to manually mark sold after fulfillment. A second buyer hitting
the page after capture but before manual mark = could buy. Mitigation: admin
order page (below) lists "needs marking sold" prominently.

## Admin order page — `/admin/orders`

New page in the (authed) group. Lists recent PayPal orders newest first:

- Status badge (captured / refunded / failed)
- Product name + price + relic ID (with link to product)
- Buyer name + email
- Shipping address (formatted)
- Capture ID (clickable to PayPal dashboard)
- Timestamp
- **A clear "Mark sold" inline action** that flips the product's `sold` flag.
  Saves a click vs. opening the admin product editor.

Top of page: count of "captured but not yet marked sold" as a nag.

## UI — buyer side

Inside `ProductDetail` modal, when product is NOT sold:

```
┌────────────────────────────────────┐
│  ░ PayPal blue smart button   ░    │  ← in-line, prominent
└────────────────────────────────────┘
   or:
┌──────────────┐  ┌────────────────┐
│ Shop on Depop│  │ Message to Claim│  ← secondary path
└──────────────┘  └────────────────┘
```

When sold, both paths disappear and we keep the existing "found her person"
parchment text.

Mobile: same layout, stacked vertically. The PayPal button is full-width
above the existing two buttons.

## Required env vars

| Variable | Where | Purpose |
|---|---|---|
| `PAYPAL_CLIENT_ID` | server + public to browser via inlined SDK URL | Identifies merchant account to PayPal SDK |
| `PAYPAL_CLIENT_SECRET` | server only | Used to fetch access token for API calls |
| `PAYPAL_ENV` | server only | `sandbox` or `live` — switches API base URL |
| `PAYPAL_WEBHOOK_ID` | server only | Used to verify webhook signatures |

Note: `PAYPAL_CLIENT_ID` is NOT prefixed with `NEXT_PUBLIC_`. It's included in
the SDK script URL that we render server-side. Embedding the merchant client-id
in the page is fine — PayPal designed it to be public. Treating it as
server-only just keeps the env list clean.

## Sandbox-first rollout

1. Owner creates PayPal Developer sandbox app, gets sandbox `CLIENT_ID` /
   `CLIENT_SECRET`. Adds them to Vercel preview env.
2. Test full purchase flow with PayPal's sandbox test buyer accounts.
3. Once verified, swap to live credentials in Vercel production env.

## Phase 2 — DEFERRED work (per user request)

These do NOT ship in phase 1. Captured here so we don't lose them.

1. **Auto-mark sold after capture.** After `capturePayPalOrder` succeeds,
   atomically flip `products.sold = true` AND re-check no second order was
   captured concurrently. Considered for v2 because:
   - Forces a re-sync to Depop (manually delisting), which we don't automate.
   - Owner may want to verify payment cleared before marking publicly sold.
   - Lower priority than the basic checkout flow.

2. **Resend (or similar) email notifications.** PayPal emails the buyer; we'd
   add a notification to the OWNER on a new capture.

3. **Inventory hold.** Reserve the product server-side for N minutes when an
   order is created, auto-release if not captured. Prevents
   long-checkouts-blocking-other-buyers race.

4. **Refund automation.** When a webhook reports a refund, auto-flip
   `products.sold = false` so it can be relisted.

5. **Auto-remove from Depop on sold.** Out of scope — Depop has no public API.
   Owner does this by hand.

6. **Buyer-facing order page.** "Thanks for your order — what happens next."
   Currently the post-capture screen is a single "ordered" message.

## Open questions (need user input before build)

1. PayPal Business account ready, or need to create one?
2. Sandbox-first OK, or jump straight to live?
3. Visual: should PayPal button be **primary/larger** (most prominent CTA) or
   **equal weight** with the existing Depop / Message buttons?
4. Shipping cost: flat rate, free, or "included in price" (PayPal still
   collects shipping address but no extra fee)?

Once those four answers come in, the work is roughly:
- Phase 1A: schema + env + library (lib/paypal.js, paypal-actions.js)
- Phase 1B: PayPal button on ProductDetail + post-capture screen
- Phase 1C: webhook handler + signature verification
- Phase 1D: /admin/orders page with "Mark sold" inline action
- Phase 1E: docs + test plan
