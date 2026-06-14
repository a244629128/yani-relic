import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeatureCardsRow from "@/components/FeatureCardsRow";
import RelicFlipDeck from "@/components/RelicFlipDeck";
import Sparkles from "@/components/decor/Sparkles";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";
import { links } from "@/data/products";
import { getProducts } from "@/lib/products-db";
import DepopLink from "@/components/DepopLink";

export default async function Home() {
  const products = await getProducts();
  return (
    <>
      <Header />
      <main className="flex-1 relative pb-24 md:pb-0">
        {/* === HERO === Tightened on mobile to fit title + tagline + CTA in one dvh. */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(circle at 50% 55%, rgba(63, 143, 145, 0.18), transparent 38%)," +
                "radial-gradient(circle at 50% 10%, rgba(216, 199, 170, 0.04), transparent 30%)," +
                "linear-gradient(180deg, #0d1611 0%, #101714 60%, #0d1611 100%)",
            }}
            aria-hidden
          />
          <Sparkles count={28} intensity="magical" />

          <div className="relative mx-auto max-w-5xl px-5 sm:px-8 pt-6 pb-10 md:pt-16 md:pb-20 flex flex-col items-center text-center min-h-[calc(100dvh-108px)] md:min-h-0 justify-center">
            <h1
              className="font-chancery text-parchment"
              style={{
                fontSize: "clamp(54px, 12vw, 132px)",
                fontWeight: 400,
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              <span className="block">Yani</span>
              <span className="block">Relics</span>
            </h1>

            <MoonPhaseDivider className="my-5 sm:my-8 max-w-[200px]" />

            <p
              className="font-serif text-cream/85 max-w-md mb-7 sm:mb-10"
              style={{ fontSize: "clamp(15px, 1.3vw, 18px)", lineHeight: 1.45 }}
            >
              Handmade labradorite relics
              <br /> for soft witches and moonlit souls.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center">
              <Link href="/shop" className="btn-relic">
                View Relics
              </Link>
              <DepopLink source="hero" className="btn-relic-link">
                Shop on Depop →
              </DepopLink>
            </div>
          </div>
        </section>

        {/* === FLIP DECK === Moved out of hero, becomes its own section. */}
        <section className="relative mx-auto max-w-5xl px-5 sm:px-8 py-10 md:py-20">
          <RelicFlipDeck products={products} accent="gold" />
        </section>

        {/* === FEATURE CARDS === */}
        <section className="relative mx-auto max-w-7xl px-5 sm:px-8 py-10 md:py-20">
          <FeatureCardsRow variant="wide" />
        </section>
      </main>
      <Footer />
    </>
  );
}
