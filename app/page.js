import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeatureCardsRow from "@/components/FeatureCardsRow";
import RelicFlipDeck from "@/components/RelicFlipDeck";
import Sparkles from "@/components/decor/Sparkles";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";
import { links } from "@/data/products";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 relative">
        {/* === HERO — title above, flip deck centered, buttons below === */}
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

          <div className="relative mx-auto max-w-5xl px-5 sm:px-8 pt-12 pb-14 md:pt-16 md:pb-20 flex flex-col items-center text-center">
            <h1
              className="font-chancery text-parchment"
              style={{
                fontSize: "clamp(64px, 10vw, 132px)",
                fontWeight: 400,
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              <span className="block">Yani</span>
              <span className="block">Relics</span>
            </h1>

            <MoonPhaseDivider className="my-6 sm:my-8 max-w-[220px]" />

            <p
              className="font-serif text-cream/85 max-w-md mb-10 sm:mb-14"
              style={{ fontSize: "clamp(15px, 1.3vw, 18px)", lineHeight: 1.5 }}
            >
              Handmade labradorite relics
              <br /> for soft witches and moonlit souls.
            </p>

            {/* Flip deck takes the orb's old spot */}
            <div className="w-full mb-10 sm:mb-14">
              <RelicFlipDeck accent="gold" />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center">
              <Link href="/shop" className="btn-relic">
                View Relics
              </Link>
              <a
                href={links.depop}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-relic-link"
              >
                Shop on Depop →
              </a>
            </div>
          </div>
        </section>

        {/* === FEATURE CARDS === */}
        <section className="relative mx-auto max-w-7xl px-5 sm:px-8 py-12 md:py-20">
          <FeatureCardsRow variant="tall" />
        </section>
      </main>
      <Footer />
    </>
  );
}
