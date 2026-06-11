"use client";

import Image from "next/image";
import Link from "next/link";
import WaxSeal from "@/components/decor/WaxSeal";
import HoverSparkleField from "@/components/decor/HoverSparkleField";
import { BLUR_DATA_URL } from "@/data/products";

// Universal card. `variant` switches between visual treatments.
//   variant: "grid" | "masonry" | "editorial" | "archive"
//   animation: "none" | "subtle" | "magical" | "dynamic"
//
// Card clicks navigate to /shop/<product.id> (full dedicated page).
// The old onOpen modal flow was removed in Phase 2D.
export default function ProductCard({ product, variant = "grid", animation = "subtle", index = 0 }) {
  const transition = {
    none: "",
    subtle: "",
    magical: "hover:ring-1 hover:ring-labradorite-light/40",
    dynamic: "hover:ring-1 hover:ring-labradorite-light/60 hover:scale-[1.015]",
  }[animation];

  const animDelay = animation === "magical" || animation === "dynamic"
    ? { animation: `fade-up 0.7s ease-out ${index * 0.07}s both` }
    : undefined;

  const href = `/shop/${product.id}`;
  const openAriaLabel = `View details for ${product.name}`;

  if (variant === "archive") {
    return (
      <article
        className={`group relative overflow-hidden parchment rounded-sm p-4 sm:p-5 flex gap-4 ${transition}`}
        style={animDelay}
      >
        <HoverSparkleField cardId={product.id} count={9} />
        <Link
          href={href}
          aria-label={openAriaLabel}
          className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-ink/40 rounded-sm overflow-hidden block group/img focus:outline-none focus:ring-2 focus:ring-labradorite-light"
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover sepia-[0.15] group-hover/img:scale-105 transition-transform duration-700"
            sizes="120px"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-brass">
              Specimen № {String(index + 1).padStart(3, "0")}
            </p>
            {!product.sold && (
              <span className="text-[10px] uppercase tracking-[0.2em] text-brass border border-brass/40 px-2 py-0.5 rounded-sm">
                One of One
              </span>
            )}
          </div>
          <h3 className="font-chancery text-2xl text-ink leading-tight mb-1">{product.name}</h3>
          <p className="text-[13px] text-ink/70 leading-snug mb-2 line-clamp-2">{product.description}</p>
          <div className="flex items-center justify-between">
            <span className="font-chancery text-xl text-ink">${product.price}</span>
            <Link
              href={href}
              className="text-[11px] uppercase tracking-[0.18em] text-ink/80 hover:text-labradorite underline-offset-4 hover:underline"
            >
              View Details →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "editorial") {
    const aspect = product.aspectRatio > 1 ? "aspect-[4/5]" : "aspect-[5/4]";
    return (
      <article
        className={`group relative card-relic ${transition}`}
        style={animDelay}
      >
        <HoverSparkleField cardId={product.id} count={12} />
        <Link
          href={href}
          aria-label={openAriaLabel}
          className={`relative ${aspect} w-full bg-ink/40 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-labradorite-light`}
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(min-width: 768px) 50vw, 100vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
          />
          <div className="absolute top-4 right-4">
            <WaxSeal label={product.sold ? "Found Home" : "One of One"} />
          </div>
          {product.sold && (
            <div className="absolute inset-0 bg-ink/45 flex items-center justify-center">
              <span className="font-serif italic text-cream text-2xl">Found her person</span>
            </div>
          )}
        </Link>
        <div className="p-6 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-brass-light mb-2">
            {product.stone} · Hand-wrapped
          </p>
          <h3 className="font-chancery text-4xl text-cream mb-3">{product.name}</h3>
          <p className="text-cream-dim leading-relaxed mb-5 max-w-prose">{product.description}</p>
          <div className="flex items-center justify-between">
            <span className="font-chancery text-3xl text-labradorite-glow">${product.price}</span>
            <Link
              href={href}
              className="text-xs uppercase tracking-[0.2em] px-5 py-2.5 rounded-full border border-brass/60 text-cream hover:border-labradorite-light hover:text-labradorite-glow transition-colors"
            >
              View Details
            </Link>
          </div>
        </div>
      </article>
    );
  }

  // grid + masonry share the same card body; masonry just lets height float
  return (
    <article
      className={`group relative card-relic ${transition}`}
      style={animDelay}
    >
      <HoverSparkleField cardId={product.id} count={10} />
      <Link
        href={href}
        aria-label={openAriaLabel}
        className={`relative ${variant === "masonry" ? "" : "aspect-square"} w-full bg-ink/40 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-labradorite-light`}
      >
        {variant === "masonry" ? (
          <div className="relative w-full" style={{ aspectRatio: `1 / ${product.aspectRatio}` }}>
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
            />
          </div>
        ) : (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
          />
        )}

        {!product.sold && (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.18em] bg-forest/85 text-cream/90 border border-brass/40 px-2 py-1 rounded-sm">
            One of One
          </span>
        )}
        {product.sold && (
          <div className="absolute inset-0 bg-ink/45 flex items-center justify-center">
            <span className="font-serif italic text-cream text-xl">Found her person</span>
          </div>
        )}
      </Link>
      <div className="p-4 sm:p-5">
        <h3 className="font-chancery text-2xl text-cream mb-1">{product.name}</h3>
        <p className="text-xs text-cream-dim/80 italic mb-3 line-clamp-2 leading-snug">
          {product.description.split(".")[0]}.
        </p>
        <div className="flex items-center justify-between">
          <span className="font-chancery text-xl text-labradorite-glow">${product.price}</span>
          <Link
            href={href}
            className="text-[11px] uppercase tracking-[0.18em] text-cream/80 hover:text-labradorite-glow"
          >
            View Details →
          </Link>
        </div>
      </div>
    </article>
  );
}
