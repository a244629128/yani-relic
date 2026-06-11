import Link from "next/link";
import ProductForm from "../_components/ProductForm";
import { getProducts } from "@/lib/products-db";

export const dynamic = "force-dynamic";

async function suggestId() {
  const products = await getProducts();
  const existing = new Set(products.map((p) => p.id));
  let n = products.length + 1;
  let id;
  do {
    id = `r-${String(n).padStart(2, "0")}`;
    n++;
  } while (existing.has(id));
  return id;
}

export default async function NewProductPage() {
  const id = await suggestId();
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
      <Link
        href="/admin"
        className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light"
      >
        ← Back to vault
      </Link>
      <h1 className="font-chancery text-cream text-3xl sm:text-4xl mt-3 mb-6">
        New relic
      </h1>
      <ProductForm initial={{ id }} isNew={true} />
    </main>
  );
}
