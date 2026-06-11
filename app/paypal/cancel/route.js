// PayPal redirects here if the buyer cancels approval on PayPal.com
// (Safari redirect flow). Query: ?p=PRODUCT_ID. Just redirect them
// back to the product page; the in-flight order row expires from the
// oversell window after 3 minutes naturally.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("p");
  return NextResponse.redirect(
    new URL(productId ? `/shop/${productId}` : "/shop", url)
  );
}
