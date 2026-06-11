"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import sharp from "sharp";
import { createAdminSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { productToRow } from "@/lib/products-db";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
}

// === Upload limits per the user's choice ===
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const BUCKET = "relics";

function safeBaseName(name) {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Uploads a single file (image or video) to the Supabase Storage `relics` bucket
 * and returns its public URL. Auto-resizes images to max 1600px long edge,
 * JPEG q80. Rejects oversized files / wrong mime types.
 *
 * Expects FormData with `file` field. Returns { ok, url? , error? }.
 */
export async function uploadMediaFile(formData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return { ok: false, error: "No file provided" };
  }

  const mime = file.type || "";
  const isImage = IMAGE_MIME.has(mime);
  const isVideo = VIDEO_MIME.has(mime);
  if (!isImage && !isVideo) {
    return { ok: false, error: `Unsupported file type: ${mime || "(unknown)"}` };
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB)` };
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: `Video too large (max ${MAX_VIDEO_BYTES / 1024 / 1024} MB)` };
  }

  const ext = isVideo ? (mime === "video/quicktime" ? "mov" : mime.split("/")[1] || "mp4") : "jpg";
  const filename = `${safeBaseName(file.name || "upload")}-${Date.now()}-${randomSuffix()}.${ext}`;

  let bodyBuffer;
  let outputMime;
  if (isImage) {
    const raw = Buffer.from(await file.arrayBuffer());
    bodyBuffer = await sharp(raw)
      .rotate() // honor EXIF orientation
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();
    outputMime = "image/jpeg";
  } else {
    bodyBuffer = Buffer.from(await file.arrayBuffer());
    outputMime = mime;
  }

  const sb = createAdminSupabase();
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(filename, bodyBuffer, {
      contentType: outputMime,
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Upload failed: ${upErr.message}` };
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(filename);
  return { ok: true, url: data.publicUrl, type: isVideo ? "video" : "image" };
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
