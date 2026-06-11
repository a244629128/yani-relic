// PayPal redirects here after the buyer approves on PayPal.com (Safari
// redirect flow). Query: ?token=ORDER_ID&PayerID=...
//
// Route Handler (not a page) — cleaner pattern for "do a server-side
// side-effect then redirect" than a Server Component render that mixes
// Server Action calls + redirect(). The previous page.js version was
// throwing "Application error: a server-side exception" because of how
// Next.js 15 handles server-action calls + revalidatePath + redirect()
// during render.

import { NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal-actions";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/shop", url));
  }

  // Best-effort capture. If anything throws, log + still redirect to
  // /orders/thanks. The thanks page polls for the order via session-bound
  // auth and gracefully handles "not paid yet" / "wrong session" /
  // "not found" cases. The webhook is the durability backstop if our
  // synchronous capture failed.
  try {
    await capturePayPalOrder(token);
  } catch (err) {
    console.error("[paypal/return] capture threw:", err);
  }

  return NextResponse.redirect(
    new URL(`/orders/thanks?o=${encodeURIComponent(token)}`, url)
  );
}
