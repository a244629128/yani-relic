// Static constants for the public site.
//
// Product catalog lives in Supabase now — see lib/products-db.js. This file
// keeps only the cross-cutting constants that don't belong in the database:
// outbound links and the shared blur placeholder.

// Flat US shipping fee. Waived when the item subtotal meets or exceeds
// FREE_SHIPPING_THRESHOLD_USD — see calculateShipping() below.
// US-only — international buyers are asked to message first.
export const SHIPPING_FEE_USD = 6;
export const FREE_SHIPPING_THRESHOLD_USD = 99;

/**
 * Single source of truth for shipping calculation. Used by:
 *   - SiteBanner (copy)
 *   - Product page (shipping line + total charge preview)
 *   - Checkout page (summary block)
 *   - createPayPalOrder + createPayPalBundleOrder (PayPal amount breakdown)
 *
 * `subtotalUsd` is the item subtotal BEFORE shipping — either the
 * effective price of one product or the sum of all items in a bundle.
 * Returns 0 when the buyer qualifies for free shipping, otherwise
 * SHIPPING_FEE_USD. Everything else in the flow assumes this function is
 * the only place threshold logic lives.
 */
export function calculateShipping(subtotalUsd) {
  const n = Number(subtotalUsd);
  if (!Number.isFinite(n)) return SHIPPING_FEE_USD;
  return n >= FREE_SHIPPING_THRESHOLD_USD ? 0 : SHIPPING_FEE_USD;
}

export const links = {
  depop: "https://www.depop.com/glitchydollhaus/",
  tiktok: "https://www.tiktok.com/@glitchydollhaus",
  instagram: "https://www.instagram.com/yanirelics/",
  // Deep links to message channels (used by the floating chat popover).
  // ig.me/m/ opens the Instagram app directly to a DM; falls back to
  // instagram.com/direct on web. m.me/<page-username> opens Messenger to
  // the FB page.
  instagramDm: "https://ig.me/m/yanirelics",
  messenger: "https://m.me/yanirelics",
  email: "yanirelics@gmail.com",
};

// Shared blur placeholder for all product images while they load.
// Tiny dark-forest gradient (~200 bytes). Visually identical given our consistent
// dark theme, so the swap to the real image is invisible.
export const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAYAAAAaTw1eAAAAJklEQVR4nGNgYGBgcCsuM2BgYGCob6lnYGBgYGB4+/45IzMzMwMA8BMFmCgkM98AAAAASUVORK5CYII=";
