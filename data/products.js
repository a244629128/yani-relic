// Static constants for the public site.
//
// Product catalog lives in Supabase now — see lib/products-db.js. This file
// keeps only the cross-cutting constants that don't belong in the database:
// outbound links and the shared blur placeholder.

export const links = {
  depop: "https://www.depop.com/glitchydollhaus/",
  tiktok: "https://www.tiktok.com/@yanirelics",
  instagram: "https://www.instagram.com/yanirelics",
  email: "hello@yanirelics.com",
};

// Shared blur placeholder for all product images while they load.
// Tiny dark-forest gradient (~200 bytes). Visually identical given our consistent
// dark theme, so the swap to the real image is invisible.
export const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAYAAAAaTw1eAAAAJklEQVR4nGNgYGBgcCsuM2BgYGCob6lnYGBgYGB4+/45IzMzMwMA8BMFmCgkM98AAAAASUVORK5CYII=";
