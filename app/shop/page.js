import { getProducts } from "@/lib/products-db";
import ShopClient from "./ShopClient";

export default async function ShopPage() {
  const products = await getProducts();
  return <ShopClient products={products} />;
}
