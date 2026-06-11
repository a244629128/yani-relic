import { getProducts } from "@/lib/products-db";
import ShopClient from "./ShopClient";

export default async function ShopPage() {
  const products = await getProducts();
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || null;
  return <ShopClient products={products} paypalClientId={paypalClientId} />;
}
