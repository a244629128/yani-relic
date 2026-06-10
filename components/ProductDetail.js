"use client";

import { useEffect, useRef } from "react";
import WaxSeal from "@/components/decor/WaxSeal";
import ProductGallery from "@/components/ProductGallery";
import { links } from "@/data/products";

export default function ProductDetail({ product, onClose }) {
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (!product) return;
    savedScrollY.current = window.scrollY;
    openerRef.current = document.activeElement;

    // Lock body scroll (iOS-safe: position fixed with saved scroll)
    const body = document.body;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY.current}px`;
    body.style.left = "0";
    body.style.right = "0";

    // Focus first focusable inside modal
    const focusable = dialogRef.current?.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab" && focusable && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      body.style.overflow = "";
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      window.scrollTo(0, savedScrollY.current);
      window.removeEventListener("keydown", onKey);
      if (openerRef.current && typeof openerRef.current.focus === "function") {
        openerRef.current.focus();
      }
    };
  }, [product, onClose]);

  if (!product) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`relic-${product.id}-title`}
    >
      <button
        className="hidden md:block absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close detail"
        tabIndex={-1}
      />
      <div className="relative w-full md:max-w-5xl bg-moss md:border md:border-brass/30 md:rounded-sm md:shadow-2xl md:max-h-[92vh] md:overflow-y-auto h-dvh md:h-auto overflow-y-auto animate-modal-up md:animate-none">
        {/* Sticky close + share on mobile; desktop has absolute close in top-right */}
        <div className="md:hidden sticky top-0 z-10 flex justify-between items-center px-3 py-3 bg-moss/95 backdrop-blur-sm border-b border-parchment/10">
          <ShareButton product={product} />
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-forest/85 border border-brass/40 text-cream hover:text-labradorite-glow flex items-center justify-center"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Desktop close button — absolute top-right */}
        <button
          onClick={onClose}
          className="hidden md:flex absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-forest/85 border border-brass/40 text-cream hover:text-labradorite-glow items-center justify-center"
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

          <div className="p-6 sm:p-10 text-cream pb-32 md:pb-10">
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

            {/* Desktop inline CTAs */}
            <div className="hidden md:block">
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
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full bg-labradorite hover:bg-labradorite-light text-cream font-medium"
                  >
                    Shop on Depop
                  </a>
                  <a
                    href={`mailto:${links.email}?subject=Message to claim: ${encodeURIComponent(product.name)}`}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full border border-brass/70 text-cream"
                  >
                    Message to Claim
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom CTA strip */}
        {!product.sold && (
          <div
            className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-moss/95 backdrop-blur-md border-t border-brass/30 px-4 py-3 flex gap-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <a
              href={links.depop}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full bg-labradorite hover:bg-labradorite-light text-cream font-medium"
            >
              Shop on Depop
            </a>
            <a
              href={`mailto:${links.email}?subject=Message to claim: ${encodeURIComponent(product.name)}`}
              className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full border border-brass/70 text-cream"
            >
              Message
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ShareButton({ product }) {
  const onShare = async () => {
    const url = `${window.location.origin}/shop?relic=${product.id}`;
    const data = {
      title: `${product.name} — Yani Relics`,
      text: `${product.name} · $${product.price} · One of One`,
      url,
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard");
      } catch (_) {}
    }
  };
  return (
    <button
      onClick={onShare}
      aria-label="Share this relic"
      className="w-9 h-9 rounded-full bg-forest/85 border border-brass/40 text-cream flex items-center justify-center"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 12 V 19 A 1 1 0 0 0 5 20 H 19 A 1 1 0 0 0 20 19 V 12" strokeLinecap="round" />
        <path d="M12 3 V 15" strokeLinecap="round" />
        <path d="M8 7 L 12 3 L 16 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
