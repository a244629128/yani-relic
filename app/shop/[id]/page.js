import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductPageContent from "@/components/ProductPageContent";
import ProductViewTracker from "@/components/ProductViewTracker";
import RelatedRelics from "@/components/RelatedRelics";
import { getProduct, getProducts } from "@/lib/products-db";

export const dynamic = "force-static";
export const revalidate = 60; // ISR — admin edits revalidate via revalidateTag

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return {};
  const desc = (product.description || "").slice(0, 160);
  const img = product.image || null;
  return {
    title: `${product.name} — Yani Relics`,
    description: desc,
    openGraph: {
      title: `${product.name} · $${product.price} — Yani Relics`,
      description: desc,
      type: "website",
      images: img ? [{ url: img, width: 1200, height: 1200, alt: product.name }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: desc,
      images: img ? [img] : [],
    },
  };
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const allProducts = await getProducts();
  // Toggle: set PAYPAL_DISABLED=true in Vercel env vars to hide the PayPal
  // button while keeping all credentials in place. Default (env unset or
  // set to anything other than "true") keeps PayPal enabled. Useful while
  // PayPal account verification is in progress — the button vanishes, the
  // Depop CTA stays, no code change needed.
  const paypalClientId =
    process.env.PAYPAL_DISABLED === "true"
      ? null
      : process.env.PAYPAL_CLIENT_ID || null;

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Back to shop crumb */}
        <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-6 md:pt-10">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cream-dim hover:text-labradorite-light transition-colors"
          >
            <span aria-hidden>←</span> Back to all relics
          </Link>
        </div>

        <ProductPageContent product={product} paypalClientId={paypalClientId} />
        <ProductViewTracker productId={product.id} />
        <RelatedRelics currentId={product.id} allProducts={allProducts} />
      </main>
      <Footer />
    </>
  );
}
