import Link from "next/link";
import { notFound } from "next/navigation";
import ProductForm from "../_components/ProductForm";
import DeleteButton from "../_components/DeleteButton";
import { getProduct } from "@/lib/products-db";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
      <Link
        href="/admin"
        className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light"
      >
        ← Back to vault
      </Link>
      <h1 className="font-chancery text-cream text-3xl sm:text-4xl mt-3 mb-6">
        Edit {product.name}
      </h1>
      <ProductForm initial={product} isNew={false} />
      <div className="mt-12 pt-6 border-t border-parchment/15">
        <p className="text-rose-300/70 text-xs uppercase tracking-[0.22em] mb-3">
          Danger zone
        </p>
        <DeleteButton id={product.id} name={product.name} />
      </div>
    </main>
  );
}
