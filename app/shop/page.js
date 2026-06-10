"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";
import { products } from "@/data/products";

function ShopPageInner() {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("all");
  const filterScrollY = useRef(0);
  const searchParams = useSearchParams();

  const available = products.filter((p) => !p.sold);
  const sold = products.filter((p) => p.sold);
  const list = filter === "available" ? available : filter === "sold" ? sold : products;

  // ?relic=r-XX → auto-open that relic's modal (from a shared link)
  useEffect(() => {
    const relicId = searchParams.get("relic");
    if (!relicId) return;
    const found = products.find((p) => p.id === relicId);
    if (found) setOpen(found);
  }, [searchParams]);

  const onFilterChange = (key) => {
    filterScrollY.current = window.scrollY;
    setFilter(key);
  };

  useEffect(() => {
    window.scrollTo(0, filterScrollY.current);
  }, [filter]);

  return (
    <>
      <Header />
      <main className="flex-1 pb-24 md:pb-0">
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-12 pb-6 md:pt-20">
          <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-3">
            Relics
          </p>
          <h1 className="font-chancery text-5xl sm:text-7xl text-cream text-center mb-4">
            The shop, tonight.
          </h1>
          <p className="text-cream-dim text-center max-w-2xl mx-auto mb-8">
            Every piece is one-of-one. When she&apos;s found her person, she&apos;s gone for good. Tap any
            relic for her field notes.
          </p>
          <MoonPhaseDivider />

          <div className="flex justify-center gap-2 mt-6 mb-10">
            {[
              { key: "all", label: `All (${products.length})` },
              { key: "available", label: `Available (${available.length})` },
              { key: "sold", label: `Found Home (${sold.length})` },
            ].map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => onFilterChange(f.key)}
                  className={`text-xs uppercase tracking-[0.18em] px-4 py-2 rounded-full border transition-colors ${
                    active
                      ? "bg-labradorite text-cream border-labradorite"
                      : "border-brass/40 text-cream-dim hover:border-labradorite-light hover:text-labradorite-glow"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {list.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                variant="grid"
                animation="magical"
                onOpen={setOpen}
                index={i}
              />
            ))}
          </div>

          {list.length === 0 && (
            <p className="text-center text-cream-dim italic font-serif py-16">
              Nothing here in this view. Try another filter.
            </p>
          )}
        </section>

        <ProductDetail product={open} onClose={() => setOpen(null)} />
      </main>
      <Footer />
    </>
  );
}

export default function ShopPage() {
  // useSearchParams must be wrapped in Suspense in Next 15
  return (
    <Suspense fallback={null}>
      <ShopPageInner />
    </Suspense>
  );
}
