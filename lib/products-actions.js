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
