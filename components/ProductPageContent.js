"use client";

import WaxSeal from "@/components/decor/WaxSeal";
import ProductGallery from "@/components/ProductGallery";
import PayPalCheckoutButton from "@/components/PayPalCheckoutButton";

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

          {/* Buy CTA — PayPal only. Message to Claim removed per user. */}
          {product.sold ? (
            <div className="parchment-soft text-ink rounded-sm p-4 text-sm italic font-serif text-center">
              This one has found her person. Hush.
            </div>
          ) : (
            paypalClientId && (
              <div
                // isolation:isolate creates a fresh stacking context so the
                // PayPal SDK's iframe / overlays can't escape and overlap the
                // sticky header / banner on scroll.
                className="relative z-0 isolate"
              >
                <PayPalCheckoutButton product={product} clientId={paypalClientId} />
              </div>
            )
          )}
        </div>
      </div>
    </article>
  );
}
