// lib/products-db.js
//
// Public-side read access to the products table. Wrapped in unstable_cache
// with tag "products" so we can invalidate on admin writes via revalidateTag.
//
// (Write-side Server Actions live in lib/products-actions.js so we keep the
//  "use server" boundary clean.)

import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase";

// Convert DB row → JS shape that the rest of the codebase expects.
// Builds the legacy `media` array: hero image first, then video, then remaining images.
function rowToProduct(row) {
  const images = row.images || [];
  const media = [];
  if (images.length > 0) media.push({ type: "image", src: images[0] });
  if (row.video && row.video.src) {
    media.push({
      type: "video",
      src: row.video.src,
      poster: row.video.poster || images[0] || null,
    });
  }
  for (let i = 1; i < images.length; i++) {
    media.push({ type: "image", src: images[i] });
  }
  const price = Number(row.price);
  const rawSale = row.sale_price != null ? Number(row.sale_price) : null;
  // Defensive: only treat as on-sale if sale price is strictly less than price.
  // (DB CHECK guarantees this, but UI shouldn't crash if data is ever weird.)
  const onSale = rawSale != null && rawSale > 0 && rawSale < price;
  const salePrice = onSale ? rawSale : null;
  const effectivePrice = onSale ? salePrice : price;
  const percentOff = onSale ? Math.round((1 - salePrice / price) * 100) : 0;
  return {
    id: row.id,
    name: row.name,
    price,
    salePrice,
    effectivePrice,
    percentOff,
    onSale,
    currency: row.currency,
    stone: row.stone,
    description: row.description,
    fieldNote: row.field_note || "",
    cordType: row.cord_type || "",
    depopUrl: row.depop_url || null,
    aspectRatio: Number(row.aspect_ratio) || 1.0,
    sold: row.sold,
    featured: row.featured,
    images,
    video: row.video,
    media,
    image: images[0] || null,
  };
}

export const getProducts = unstable_cache(
  async () => {
    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getProducts error:", error);
      return [];
    }
    return (data || []).map(rowToProduct);
  },
  ["products-all"],
  // tags: invalidate immediately when admin saves via revalidateTag("products").
  // revalidate: 60s TTL backstop so direct DB edits (Supabase SQL editor /
  // dashboard) propagate to /shop within a minute even without an admin
  // action firing our revalidateTag.
  { tags: ["products"], revalidate: 60 }
);

export async function getProduct(id) {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return rowToProduct(data);
}

/**
 * Batch fetch products by an array of IDs. Preserves the input order and
 * silently drops IDs that don't exist in the DB — the /checkout page and
 * bundle server actions rely on both behaviors:
 *   - Order preserved so the UI shows items in the order the buyer picked.
 *   - Unknown IDs dropped so a stale localStorage entry (product deleted
 *     since it was added to selection) doesn't crash the page.
 *
 * Returns [] for empty or all-invalid input — never null.
 */
export async function getProductsByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  // Cap at a sensible ceiling to guard against pathological inputs.
  // MAX_BUNDLE_SIZE (10) + buffer.
  const cleanIds = Array.from(
    new Set(
      ids.filter((v) => typeof v === "string" && v.length > 0 && v.length <= 64)
    )
  ).slice(0, 32);
  if (cleanIds.length === 0) return [];

  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("products")
    .select("*")
    .in("id", cleanIds);
  if (error) {
    console.error("[getProductsByIds] error:", error);
    return [];
  }
  const byId = new Map((data || []).map((row) => [row.id, rowToProduct(row)]));
  // Preserve input order; drop unknowns.
  return cleanIds.map((id) => byId.get(id)).filter(Boolean);
}

export async function getFeaturedProducts() {
  const all = await getProducts();
  return all.filter((p) => p.featured);
}

/**
 * Atomically flip a product to sold=true. Used by Phase 2B auto-mark
 * after a successful PayPal capture, and idempotently safe for repeat
 * calls (the WHERE sold=false guard means a second invocation is a no-op).
 *
 * Returns { ok, changed }. `changed=true` only when this call was the
 * one that flipped the bit — useful for "did we just sell this" signals.
 * Per Codex HIGH #6: callers must only invoke after the captured row is
 * durably written to DB, NOT on PayPal capture API success alone.
 */
export async function markProductSold(productId) {
  if (!productId || typeof productId !== "string") {
    return { ok: false, error: "Invalid productId" };
  }
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("products")
    .update({ sold: true })
    .eq("id", productId)
    .eq("sold", false)
    .select("id");
  if (error) {
    console.error("[markProductSold]:", error);
    return { ok: false, error: error.message };
  }
  const changed = (data?.length || 0) > 0;
  if (changed) {
    // The site uses tag-based + path-based revalidation. Bust both so
    // /shop and /shop/<id> drop the relic on the next request.
    try {
      revalidateTag("products");
      revalidatePath("/");
      revalidatePath("/shop");
      revalidatePath(`/shop/${productId}`);
      revalidatePath("/admin");
    } catch (err) {
      console.error("[markProductSold] revalidate error:", err);
    }
  }
  return { ok: true, changed };
}

/**
 * Inverse of markProductSold — flips a product back to available.
 * Idempotent (WHERE sold=true guard). Used by the admin "Mark unsold"
 * button on /admin/orders when an order was refunded/cancelled and the
 * relic should be listed again.
 */
export async function markProductAvailable(productId) {
  if (!productId || typeof productId !== "string") {
    return { ok: false, error: "Invalid productId" };
  }
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("products")
    .update({ sold: false })
    .eq("id", productId)
    .eq("sold", true)
    .select("id");
  if (error) {
    console.error("[markProductAvailable]:", error);
    return { ok: false, error: error.message };
  }
  const changed = (data?.length || 0) > 0;
  if (changed) {
    try {
      revalidateTag("products");
      revalidatePath("/");
      revalidatePath("/shop");
      revalidatePath(`/shop/${productId}`);
      revalidatePath("/admin");
    } catch (err) {
      console.error("[markProductAvailable] revalidate error:", err);
    }
  }
  return { ok: true, changed };
}

// Used by Server Actions to convert form input → DB row shape.
export function productToRow(p) {
  const price = Number(p.price);
  // sale_price: empty string / null / undefined / 0 → no sale. Numeric value
  // is enforced by DB CHECK to be > 0 and < price. Server action validates
  // upstream too for a better user error than a raw DB constraint failure.
  let salePrice = null;
  if (p.salePrice !== "" && p.salePrice != null) {
    const n = Number(p.salePrice);
    if (Number.isFinite(n) && n > 0 && n < price) salePrice = n;
  }
  // depopUrl: trim + null out empty strings so DB sees null cleanly.
  const depopUrl =
    typeof p.depopUrl === "string" && p.depopUrl.trim().length > 0
      ? p.depopUrl.trim()
      : null;
  return {
    id: p.id,
    name: p.name,
    price,
    sale_price: salePrice,
    currency: p.currency || "USD",
    stone: p.stone || "Labradorite",
    description: p.description,
    field_note: p.fieldNote || null,
    cord_type: p.cordType || null,
    depop_url: depopUrl,
    aspect_ratio: Number(p.aspectRatio) || 1.0,
    sold: !!p.sold,
    featured: !!p.featured,
    images: Array.isArray(p.images) ? p.images : [],
    video:
      p.video && p.video.src
        ? { src: p.video.src, poster: p.video.poster || null }
        : null,
  };
}
