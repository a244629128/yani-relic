import { redirect } from "next/navigation";
import { getProducts } from "@/lib/products-db";
import ShopClient from "./ShopClient";

export default async function ShopPage({ searchParams }) {
  // Backward-compat: shareable /shop?relic=r-01 links from before Phase 2D
  // now redirect to the dedicated product page.
  const params = await searchParams;
  const legacyRelic = params?.relic;
  if (typeof legacyRelic === "string" && /^[a-z0-9-]{1,32}$/i.test(legacyRelic)) {
    redirect(`/shop/${legacyRelic}`);
  }

  const products = await getProducts();
  return <ShopClient products={products} />;
}
