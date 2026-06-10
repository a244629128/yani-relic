"use client";

import { useEffect } from "react";
import WaxSeal from "@/components/decor/WaxSeal";
import ProductGallery from "@/components/ProductGallery";
import { links } from "@/data/products";

export default function ProductDetail({ product, onClose }) {
  useEffect(() => {
    if (!product) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [product, onClose]);

  if (!product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`relic-${product.id}-title`}
    >
      <button
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close detail"
      />
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-sm bg-moss border border-brass/30 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-forest/85 border border-brass/40 text-cream hover:text-labradorite-glow flex items-center justify-center"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="grid md:grid-cols-2">
          <div className="relative bg-ink/40 p-3 sm:p-4">
            <ProductGallery
              media={product.media}
              images={product.images || [product.image]}
              alt={product.name}
            />
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
              <WaxSeal label={product.sold ? "Found Home" : "One of One"} />
            </div>
          </div>

          <div className="p-6 sm:p-10 text-cream">
            <p className="text-[11px] uppercase tracking-[0.22em] text-brass-light mb-3">
              {product.stone} · Hand-wrapped pendant
            </p>
            <h2 id={`relic-${product.id}-title`} className="font-chancery text-5xl sm:text-6xl mb-3">
              {product.name}
            </h2>
            <p className="font-serif italic text-cream-dim mb-6">{product.fieldNote}</p>

            <div className="hairline mb-6" />

            <p className="leading-relaxed text-cream/90 mb-6">{product.description}</p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-8">
              <div>
                <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">Stone</dt>
                <dd>{product.stone}</dd>
              </div>
              <div>
                <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">Comes with</dt>
                <dd>{product.cordType}</dd>
              </div>
              <div>
                <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">Flash</dt>
                <dd>Blue-green under direct light</dd>
              </div>
              <div>
                <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">Edition</dt>
                <dd>One of one — never repeated</dd>
              </div>
            </dl>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="font-chancery text-5xl text-labradorite-glow">${product.price}</span>
              <span className="text-xs text-cream-dim/70">{product.currency}</span>
            </div>

            {product.sold ? (
              <div className="parchment-soft text-ink rounded-sm p-4 text-sm italic font-serif text-center">
                This one has found her person. Hush.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={links.depop}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full bg-labradorite hover:bg-labradorite-light transition-colors text-cream font-medium tracking-wide"
                >
                  Shop on Depop
                </a>
                <a
                  href={`mailto:${links.email}?subject=Message to claim: ${encodeURIComponent(product.name)}`}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full border border-brass/70 text-cream hover:border-labradorite-light hover:text-labradorite-glow transition-colors"
                >
                  Message to Claim
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
