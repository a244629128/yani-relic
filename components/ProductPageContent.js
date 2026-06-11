"use client";

import WaxSeal from "@/components/decor/WaxSeal";
import ProductGallery from "@/components/ProductGallery";
import PayPalCheckoutButton from "@/components/PayPalCheckoutButton";
import { links } from "@/data/products";
import { trackDepopClick } from "@/lib/analytics";

/**
 * Body of the /shop/[id] page. The page itself is a server component;
 * this client component holds the interactive bits (PayPal button,
 * tracked CTAs). Layout: split gallery left, info right on desktop;
 * stacked on mobile. PayPal is the primary CTA; a Depop link sits below
 * as the secondary buying path (red brand button, see below).
 */
export default function ProductPageContent({ product, paypalClientId }) {
  return (
    <article className="mx-auto max-w-6xl px-3 sm:px-5 lg:px-8 pt-4 pb-32 md:pb-16">
      <div className="grid md:grid-cols-2 gap-6 md:gap-10 lg:gap-14">
        {/* Gallery */}
        <div className="relative bg-ink/40 rounded-sm overflow-hidden">
          <ProductGallery
            media={product.media}
            images={product.images || [product.image]}
            alt={product.name}
            productId={product.id}
          />
          {product.sold && (
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
              <WaxSeal label="Found Home" />
            </div>
          )}
        </div>

        {/* Info column */}
        <div className="text-cream pt-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-brass-light mb-3">
            {product.stone} · Hand-wrapped pendant
          </p>
          <h1 className="font-chancery text-5xl sm:text-6xl mb-3 leading-tight">
            {product.name}
          </h1>
          <p className="font-serif italic text-cream-dim mb-6">
            {product.fieldNote}
          </p>

          <div className="hairline mb-6" />

          <p className="leading-relaxed text-cream/90 mb-6">
            {product.description}
          </p>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-8">
            <div>
              <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">
                Stone
              </dt>
              <dd>{product.stone}</dd>
            </div>
            <div>
              <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">
                Comes with
              </dt>
              <dd>{product.cordType || "Cord / chain included"}</dd>
            </div>
            <div>
              <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">
                Flash
              </dt>
              <dd>Blue-green under direct light</dd>
            </div>
          </dl>

          <div className="flex items-baseline gap-3 flex-wrap mb-6">
            {product.onSale && !product.sold ? (
              <>
                <span className="font-chancery text-5xl text-rose-400">
                  ${product.salePrice}
                </span>
                <span className="line-through text-cream-dim/60 text-2xl font-chancery">
                  ${product.price}
                </span>
                <span className="text-[11px] uppercase tracking-[0.22em] text-rose-200 bg-rose-700/30 border border-rose-300/40 px-2.5 py-1 rounded-full">
                  {product.percentOff}% off
                </span>
                <span className="text-xs text-cream-dim/70 ml-1">{product.currency}</span>
              </>
            ) : (
              <>
                <span
                  className={`font-chancery text-5xl ${product.sold ? "text-cream-dim" : "text-labradorite-glow"}`}
                >
                  ${product.price}
                </span>
                <span className="text-xs text-cream-dim/70">{product.currency}</span>
              </>
            )}
          </div>

          {/* Buy CTAs — PayPal primary, Shop on Depop secondary. */}
          {product.sold ? (
            <div className="parchment-soft text-ink rounded-sm p-4 text-sm italic font-serif text-center">
              This one has found her person. Hush.
            </div>
          ) : (
            <>
              {paypalClientId && (
                <div
                  // isolation:isolate creates a fresh stacking context so the
                  // PayPal SDK's iframe / overlays can't escape and overlap the
                  // sticky header / banner on scroll.
                  className="relative z-0 isolate mb-3"
                >
                  <PayPalCheckoutButton product={product} clientId={paypalClientId} />
                </div>
              )}
              <a
                href={links.depop}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackDepopClick(product.id)}
                className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-full bg-[#ff2300] hover:bg-[#e01f00] text-white font-medium text-[13px] transition-colors shadow-[0_2px_8px_rgba(255,35,0,0.25)] hover:shadow-[0_3px_12px_rgba(255,35,0,0.35)]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M3 3h7.5a7.5 7.5 0 0 1 0 15H7v3H3V3zm4 4v7h3.5a3.5 3.5 0 0 0 0-7H7z" />
                </svg>
                <span>Shop on Depop</span>
              </a>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
