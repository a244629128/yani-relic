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
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    currency: row.currency,
    stone: row.stone,
    description: row.description,
    fieldNote: row.field_note || "",
    cordType: row.cord_type || "",
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
  { tags: ["products"] }
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

// Used by Server Actions to convert form input → DB row shape.
export function productToRow(p) {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    currency: p.currency || "USD",
    stone: p.stone || "Labradorite",
    description: p.description,
    field_note: p.fieldNote || null,
    cord_type: p.cordType || null,
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
