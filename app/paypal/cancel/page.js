import { redirect } from "next/navigation";

// PayPal redirects here if the buyer cancels the approval on PayPal.com
// (Safari redirect flow). Query: ?p=PRODUCT_ID (we set this in
// createPayPalOrder's cancel_url).
//
// We don't void the in-flight order here because that requires the
// buyer_session_id from localStorage, which a server component can't
// read. The order's 'created' row will expire from the oversell window
// after 5 minutes — short enough that the same buyer can retry shortly,
// and other buyers are still protected.
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Cancelled — Yani Relics",
  robots: { index: false, follow: false },
};

export default async function PayPalCancel({ searchParams }) {
  const params = await searchParams;
  const productId = typeof params?.p === "string" ? params.p : null;
  redirect(productId ? `/shop/${productId}` : "/shop");
}
