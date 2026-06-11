"use client";

import { createClient } from "@supabase/supabase-js";
import { createSignedUploadUrl } from "@/lib/products-actions";

const BUCKET = "relics";
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.85;
const MAX_RAW_IMAGE = 15 * 1024 * 1024; // 15 MB pre-resize cap (paranoid)
const MAX_VIDEO = 50 * 1024 * 1024;     // 50 MB after resize (Supabase free tier still fine)

let _sb = null;
function browserSupabase() {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env vars in browser");
  _sb = createClient(url, anon, { auth: { persistSession: false } });
  return _sb;
}

async function resizeImageToJpeg(file) {
  // createImageBitmap honors EXIF when given imageOrientation:'from-image'.
  // Fall back to raw bitmap if the browser doesn't support that option.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  let blob;
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    blob = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", JPEG_QUALITY)
    );
  }
  bitmap.close?.();
  if (!blob) throw new Error("Could not encode resized JPEG");
  return blob;
}

/**
 * Uploads a file directly to Supabase Storage via a server-signed URL.
 * Images are resized client-side to max 1600px JPEG q0.85 before upload.
 * Returns the public URL on success; throws on failure.
 */
export async function uploadFileDirect(file, { onProgress } = {}) {
  if (!file) throw new Error("No file");
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) throw new Error("Only image or video files");

  if (isImage && file.size > MAX_RAW_IMAGE) {
    throw new Error("Image too large (>15 MB raw)");
  }
  if (isVideo && file.size > MAX_VIDEO) {
    throw new Error("Video too large (>50 MB)");
  }

  let payload;
  let ext;
  if (isImage) {
    onProgress?.("Resizing…");
    try {
      payload = await resizeImageToJpeg(file);
    } catch (err) {
      console.warn("client resize failed, uploading original:", err);
      payload = file;
    }
    ext = "jpg";
  } else {
    payload = file;
    ext = file.type === "video/quicktime" ? "mov" : (file.type.split("/")[1] || "mp4");
  }

  onProgress?.("Preparing…");
  const signed = await createSignedUploadUrl(ext);
  if (!signed.ok) throw new Error(signed.error || "Could not get upload URL");

  onProgress?.("Uploading…");
  const sb = browserSupabase();
  const { error } = await sb.storage
    .from(BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, payload, {
      contentType: isImage ? "image/jpeg" : file.type,
      upsert: false,
    });
  if (error) throw new Error(error.message || "Upload failed");

  return signed.publicUrl;
}
