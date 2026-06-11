"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { productToRow } from "@/lib/products-db";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
}

const BUCKET = "relics";
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "avif", "mp4", "mov", "webm"]);

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Issues a signed upload URL so the browser can PUT a file directly to
 * Supabase Storage, bypassing Vercel's 4.5 MB function body cap entirely.
 * The browser does the upload itself; the function only signs a URL.
 *
 * @param {string} ext - lowercase extension without dot (e.g. "jpg", "mp4")
 * @returns {Promise<{ok: true, signedUrl: string, token: string, path: string, publicUrl: string} | {ok: false, error: string}>}
 */
export async function createSignedUploadUrl(ext) {
  try {
    await requireAdmin();
    const cleanExt = String(ext || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!ALLOWED_EXT.has(cleanExt)) {
      return { ok: false, error: `Unsupported extension: ${ext}` };
    }
    const filename = `upload-${Date.now()}-${randomSuffix()}.${cleanExt}`;
    const sb = createAdminSupabase();
    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(filename);
    if (error) {
      console.error("[createSignedUploadUrl] supabase error:", error);
      return { ok: false, error: error.message };
    }
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(data.path);
    return {
      ok: true,
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      publicUrl: pub.publicUrl,
    };
  } catch (err) {
    console.error("[createSignedUploadUrl] unexpected:", err);
    return { ok: false, error: err?.message || "Could not create upload URL" };
  }
}

export async function saveProduct(product) {
  await requireAdmin();

  // Validate raw salePrice input BEFORE productToRow runs. The converter
  // silently nulls invalid values for DB safety — without this upstream
  // check, a user typing sale >= price would save successfully as "no sale"
  // with no feedback. (Codex review MED finding.)
  if (
    product?.salePrice !== "" &&
    product?.salePrice != null &&
    typeof product?.salePrice !== "boolean"
  ) {
    const rawSale = Number(product.salePrice);
    const rawPrice = Number(product.price);
    if (!Number.isFinite(rawSale) || rawSale <= 0) {
      return { ok: false, error: "Sale price must be a positive number" };
    }
    if (Number.isFinite(rawPrice) && rawSale >= rawPrice) {
      return {
        ok: false,
        error: `Sale price ($${rawSale}) must be less than the regular price ($${rawPrice})`,
      };
    }
  }

  const sb = createAdminSupabase();
  const row = productToRow(product);

  if (!row.id || !/^[a-z0-9-]{2,32}$/i.test(row.id)) {
    return {
      ok: false,
      error: "Invalid id (letters, digits, dashes only — 2-32 chars)",
    };
  }
  if (!row.name?.trim()) return { ok: false, error: "Name is required" };
  if (!(row.price > 0)) return { ok: false, error: "Price must be greater than 0" };
  if (row.sale_price != null) {
    if (!(row.sale_price > 0)) {
      return { ok: false, error: "Sale price must be greater than 0" };
    }
    if (!(row.sale_price < row.price)) {
      return { ok: false, error: "Sale price must be less than the regular price" };
    }
  }
  if (!row.description?.trim()) return { ok: false, error: "Description is required" };
  if (!Array.isArray(row.images) || row.images.length < 1) {
    return { ok: false, error: "At least 1 image is required" };
  }
  if (row.images.length > 8) {
    return { ok: false, error: "Maximum 8 images" };
  }

  const { data, error } = await sb
    .from("products")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidateTag("products");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath(`/admin/${row.id}`);
  revalidatePath("/admin");

  return { ok: true, product: data };
}

/**
 * Bulk discount: set sale_price = round(price * (1 - percent/100), 2) on
 * every non-sold product. Overwrites any existing per-product sale_price
 * (per user's "overwrite" choice). Sold items are deliberately untouched.
 *
 * @param {number} percent - integer 1..99
 * @returns {Promise<{ok: true, updated: number} | {ok: false, error: string}>}
 */
export async function bulkApplyDiscount(percent) {
  await requireAdmin();
  const pct = Number(percent);
  if (!Number.isFinite(pct) || pct < 1 || pct > 99 || !Number.isInteger(pct)) {
    return { ok: false, error: "Discount must be an integer between 1 and 99" };
  }

  const sb = createAdminSupabase();

  // Fetch all available products with their prices so we can compute each
  // sale_price client-side (Supabase JS doesn't support raw SQL expressions
  // in UPDATE without using PostgREST RPC or a stored function).
  const { data: rows, error: fetchErr } = await sb
    .from("products")
    .select("id, price")
    .eq("sold", false);
  if (fetchErr) {
    console.error("[bulkApplyDiscount] fetch error:", fetchErr);
    return { ok: false, error: fetchErr.message };
  }

  const factor = (100 - pct) / 100;
  // Compute sale_price per row; cap to 2 decimal places. Drop any row whose
  // computed sale_price wouldn't satisfy the DB CHECK (e.g. very cheap items
  // where 99% off rounds to 0).
  const updates = (rows || [])
    .map((r) => {
      const price = Number(r.price);
      const sale = Math.round(price * factor * 100) / 100;
      if (!Number.isFinite(sale) || sale <= 0 || sale >= price) return null;
      return { id: r.id, sale_price: sale };
    })
    .filter(Boolean);

  if (updates.length === 0) {
    return { ok: false, error: "No eligible products to discount" };
  }

  // upsert with onConflict='id' updates only the sale_price column we send.
  // Supabase upsert preserves existing columns it doesn't see in the payload.
  const { error: updateErr } = await sb
    .from("products")
    .upsert(updates, { onConflict: "id" });
  if (updateErr) {
    console.error("[bulkApplyDiscount] update error:", updateErr);
    return { ok: false, error: updateErr.message };
  }

  revalidateTag("products");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin");
  for (const u of updates) revalidatePath(`/shop/${u.id}`);

  return { ok: true, updated: updates.length };
}

/**
 * Clear sale_price on all products (sold or not). Used by the "Clear all
 * sales" button next to the bulk apply input.
 */
export async function clearAllSales() {
  await requireAdmin();
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("products")
    .update({ sale_price: null })
    .not("sale_price", "is", null)
    .select("id");
  if (error) {
    console.error("[clearAllSales] error:", error);
    return { ok: false, error: error.message };
  }
  const cleared = data?.length || 0;
  if (cleared > 0) {
    revalidateTag("products");
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/admin");
    for (const r of data) revalidatePath(`/shop/${r.id}`);
  }
  return { ok: true, cleared };
}

export async function deleteProduct(id) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateTag("products");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin");
  return { ok: true };
}
