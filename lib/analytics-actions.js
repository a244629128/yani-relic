"use server";

// Admin-only destructive operations on analytics. Both require an active
// admin session — anyone calling these without auth gets "Unauthorized".

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
}

/**
 * Delete all product_events rows for a single relic.
 * Returns { ok, deleted? } or { ok: false, error }.
 */
export async function resetProductAnalytics(productId) {
  await requireAdmin();
  if (typeof productId !== "string" || !productId) {
    return { ok: false, error: "Invalid productId" };
  }

  const sb = createAdminSupabase();
  const { error, count } = await sb
    .from("product_events")
    .delete({ count: "exact" })
    .eq("product_id", productId);

  if (error) {
    console.error("[resetProductAnalytics] error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/analytics");
  revalidatePath(`/admin/${productId}`);
  return { ok: true, deleted: count ?? 0 };
}

/**
 * Wipe the entire product_events table. Used by the global reset on
 * /admin/analytics. Requires the caller to type a confirm-phrase client-side
 * before we even reach here — but we double-check on the server too.
 */
export async function resetAllAnalytics(confirmPhrase) {
  await requireAdmin();
  if (confirmPhrase !== "reset all analytics") {
    return { ok: false, error: "Confirmation phrase did not match" };
  }

  const sb = createAdminSupabase();
  const { error, count } = await sb
    .from("product_events")
    .delete({ count: "exact" })
    // Supabase requires a filter for delete; this matches every row.
    .gte("id", 0);

  if (error) {
    console.error("[resetAllAnalytics] error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/analytics");
  return { ok: true, deleted: count ?? 0 };
}
