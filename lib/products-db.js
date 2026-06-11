// lib/products-db.js
//
// Public-side read access to the products table. Wrapped in unstable_cache
// with tag "products" so we can invalidate on admin writes via revalidateTag.
//
// (Write-side Server Actions live in lib/products-actions.js so we keep the
//  "use server" boundary clean.)

import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase";

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
