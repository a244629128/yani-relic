"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";

const SORT_OPTIONS = [
  { key: "default", label: "Newest" },
  { key: "price-asc", label: "Price ↑" },
  { key: "price-desc", label: "Price ↓" },
  { key: "name-asc", label: "A → Z" },
  { key: "name-desc", label: "Z → A" },
];

function sortProducts(items, sortKey) {
  if (sortKey === "default") return items;
  const arr = [...items];
  switch (sortKey) {
    case "price-asc":
      return arr.sort((a, b) => a.price - b.price);
    case "price-desc":
      return arr.sort((a, b) => b.price - a.price);
    case "name-asc":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return arr.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return items;
  }
}

function ShopPageInner({ products, paypalClientId }) {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("default");
  const filterScrollY = useRef(0);
  const searchParams = useSearchParams();

  const available = products.filter((p) => !p.sold);
  const sold = products.filter((p) => p.sold);
  const filtered =
    filter === "available" ? available : filter === "sold" ? sold : products;
  const list = sortProducts(filtered, sort);

  useEffect(() => {
    const relicId = searchParams.get("relic");
    if (!relicId) return;
    const found = products.find((p) => p.id === relicId);
    if (found) setOpen(found);
  }, [searchParams, products]);

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

          <div className="flex flex-wrap justify-center gap-2 mt-6 mb-4">
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

          <div className="flex items-center justify-center gap-3 mb-10">
            <span className="text-[10px] uppercase tracking-[0.22em] text-cream-dim/70">
              Sort
            </span>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort relics"
                className="appearance-none bg-forest/60 border border-brass/40 text-cream-dim hover:border-labradorite-light hover:text-labradorite-glow rounded-full pl-4 pr-9 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors cursor-pointer focus:outline-none focus:border-labradorite-light focus:text-labradorite-glow"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key} className="bg-forest text-cream">
                    {o.label}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden
                width="10"
                height="10"
                viewBox="0 0 10 10"
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cream-dim/60"
                fill="currentColor"
              >
                <path d="M1 3 L 5 7 L 9 3 Z" />
              </svg>
            </div>
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

        <ProductDetail
          product={open}
          onClose={() => setOpen(null)}
          paypalClientId={paypalClientId}
        />
      </main>
      <Footer />
    </>
  );
}

export default function ShopClient({ products, paypalClientId }) {
  // useSearchParams must be wrapped in Suspense in Next 15
  return (
    <Suspense fallback={null}>
      <ShopPageInner products={products} paypalClientId={paypalClientId} />
    </Suspense>
  );
}
