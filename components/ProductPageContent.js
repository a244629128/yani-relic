"use client";

import WaxSeal from "@/components/decor/WaxSeal";
import ProductGallery from "@/components/ProductGallery";
import PayPalCheckoutButton from "@/components/PayPalCheckoutButton";
import { links } from "@/data/products";
import { trackMailtoClick } from "@/lib/analytics";

/**
 * Body of the /shop/[id] page. The page itself is a server component;
 * this client component holds the interactive bits (PayPal button,
 * tracked CTAs). Layout: split gallery left, info right on desktop;
 * stacked on mobile.
 *
 * Depop CTA intentionally absent — Phase 2D moved it off the product
 * page entirely (per user). Header / footer / site-wide Depop links
 * still expose Depop as a buying option elsewhere.
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
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <WaxSeal label={product.sold ? "Found Home" : "One of One"} />
          </div>
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
            <div>
              <dt className="text-brass-light text-[11px] uppercase tracking-[0.18em] mb-1">
                Edition
              </dt>
              <dd>One of one — never repeated</dd>
            </div>
          </dl>

          <div className="flex items-baseline gap-2 mb-6">
            <span className="font-chancery text-5xl text-labradorite-glow">
              ${product.price}
            </span>
            <span className="text-xs text-cream-dim/70">{product.currency}</span>
          </div>

          {/* Buy CTAs — PayPal primary, Message to Claim secondary. No Depop. */}
          {product.sold ? (
            <div className="parchment-soft text-ink rounded-sm p-4 text-sm italic font-serif text-center">
              This one has found her person. Hush.
            </div>
          ) : (
            <>
              {paypalClientId && (
                <div className="mb-4">
                  <PayPalCheckoutButton product={product} clientId={paypalClientId} />
                </div>
              )}
              {/* Desktop secondary: inline. Mobile has the sticky bottom bar below. */}
              <div className="hidden md:block">
                <a
                  href={`mailto:${links.email}?subject=Message to claim: ${encodeURIComponent(product.name)}`}
                  onClick={() => trackMailtoClick(product.id)}
                  className="inline-flex items-center justify-center w-full px-4 py-2 rounded-full border border-brass/40 text-cream-dim hover:border-labradorite-light hover:text-labradorite-glow transition-colors text-[12px]"
                >
                  Message to Claim
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile sticky bottom bar — Message to Claim only.
          PayPal button stays inline in the scroll because it's too tall to be sticky.
          On md+ the global MobileActionBar is hidden via Tailwind; on mobile we
          also hide MobileActionBar on /shop/r-* via app/layout.js. */}
      {!product.sold && (
        <div
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-moss/95 backdrop-blur-md border-t border-brass/30 px-4 py-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <a
            href={`mailto:${links.email}?subject=Message to claim: ${encodeURIComponent(product.name)}`}
            onClick={() => trackMailtoClick(product.id)}
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-full border border-brass/70 text-cream font-medium"
          >
            Message to Claim
          </a>
        </div>
      )}
    </article>
  );
}
