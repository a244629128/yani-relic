"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { productToRow } from "@/lib/products-db";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
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
