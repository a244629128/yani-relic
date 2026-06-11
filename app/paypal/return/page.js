import { redirect } from "next/navigation";
import { capturePayPalOrder } from "@/lib/paypal-actions";

// PayPal redirects here after the buyer approves on PayPal.com (Safari
// redirect flow). Query: ?token=ORDERID&PayerID=PAYERID. We capture
// server-side, then redirect to the buyer-facing thanks page.
//
// noindex: this URL is never something a search engine should index.
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Confirming — Yani Relics",
  robots: { index: false, follow: false },
};

export default async function PayPalReturn({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : null;

  if (!token) {
    redirect("/shop");
  }

  // Try to capture. capturePayPalOrder is idempotent + safe to call
  // multiple times; even if the user reloads this page it won't double-
  // charge. PayPal returns ORDER_ALREADY_CAPTURED which we handle as
  // a recoverable issue.
  const res = await capturePayPalOrder(token);

  // Always route to /orders/thanks. The page reads the order via session-
  // bound action and renders the right copy (captured / oversold /
  // refunded / not-found-yet-polling).
  redirect(`/orders/thanks?o=${encodeURIComponent(token)}`);
}
