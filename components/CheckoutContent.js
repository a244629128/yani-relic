"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSelection } from "@/hooks/useSelection";
import { BLUR_DATA_URL, calculateShipping } from "@/data/products";
import { fetchProductsForCheckout } from "@/lib/paypal-actions";
import PayPalBundleButton from "@/components/PayPalBundleButton";

/**
 * Minimalist checkout page body — small-caps "CHECKOUT" header, photo-lead
 * rows, remove-per-item, subtotal / shipping / total block, PayPal button.
 *
 * Data flow:
 *   1. On mount, read selection IDs from localStorage (via useSelection).
 *   2. Call fetchProductsForCheckout server action to hydrate to products.
 *   3. If the fetch drops any IDs (product deleted / never existed), silently
 *      remove those from the selection. If any come back sold, show the
 *      Codex-blessed blunt notice: "One piece was sold before checkout —
 *      please review your selection."
 *   4. Render item cards + total + PayPal button.
 *
 * The empty state fires when selection is [] OR only unavailable items
 * remain — a bare link back to the shop.
 */
export default function CheckoutContent({ paypalClientId }) {
  const { ids, remove } = useSelection();
  const [products, setProducts] = useState(null); // null = loading, [] = empty
  const [notice, setNotice] = useState(""); // shown when items were auto-removed

  // Hydrate products from IDs. Runs whenever the selection changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (ids.length === 0) {
        setProducts([]);
        return;
      }
      const fetched = await fetchProductsForCheckout(ids);
      if (cancelled) return;

      // Drop IDs the server didn't return (product deleted). This mutates
      // localStorage so subsequent renders don't re-request them.
      const returnedIds = new Set(fetched.map((p) => p.id));
      const missingIds = ids.filter((id) => !returnedIds.has(id));
      if (missingIds.length > 0) {
        for (const id of missingIds) remove(id);
        setNotice(
          missingIds.length === 1
            ? "One piece is no longer available. Removed from your order."
            : `${missingIds.length} pieces are no longer available. Removed from your order.`
        );
      }
      setProducts(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, remove]);

  // Loading state
  if (products === null) {
    return (
      <section className="mx-auto max-w-3xl px-5 sm:px-8 pt-12 pb-8">
        <p className="text-center text-cream-dim italic font-serif mt-16">
          Loading your selection…
        </p>
      </section>
    );
  }

  // Available vs sold split. Sold pieces linger visually so the buyer
  // sees what got dropped, but can't be checked out.
  const availableProducts = products.filter((p) => !p.sold);
  const soldProducts = products.filter((p) => p.sold);
  const isEmpty = products.length === 0;
  const noneAvailable = !isEmpty && availableProducts.length === 0;

  const itemSubtotal = availableProducts.reduce(
    (sum, p) => sum + Number(p.effectivePrice ?? p.price),
    0
  );
  // Shipping is computed from the item subtotal alone (before shipping).
  // Free-shipping threshold applies for both single-piece and bundle carts —
  // matches what createPayPalBundleOrder sends to PayPal so the buyer sees
  // consistent numbers on our summary and PayPal's overlay.
  const shipping =
    availableProducts.length > 0 ? calculateShipping(itemSubtotal) : 0;
  const total = itemSubtotal + shipping;

  return (
    <section className="mx-auto max-w-3xl px-5 sm:px-8 pt-10 pb-4">
      <PageHeader />

      {notice && (
        <div className="mb-6 rounded-md border border-yellow-200/30 bg-yellow-200/[0.06] px-4 py-3 text-center">
          <p className="text-yellow-100/90 text-sm italic font-serif">{notice}</p>
        </div>
      )}

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <ul className="space-y-3 mb-8">
            {availableProducts.map((p) => (
              <ItemRow key={p.id} product={p} onRemove={() => remove(p.id)} />
            ))}
            {soldProducts.map((p) => (
              <SoldItemRow key={p.id} product={p} onRemove={() => remove(p.id)} />
            ))}
          </ul>

          {noneAvailable ? (
            <div className="rounded-md border border-brass/25 bg-forest/60 px-5 py-6 text-center">
              <p className="text-cream-dim font-serif italic mb-4">
                All the pieces in your order were claimed before you could check out.
              </p>
              <Link
                href="/shop"
                className="inline-block text-[11px] uppercase tracking-[0.22em] text-labradorite-light hover:text-labradorite-glow"
              >
                Browse the shop →
              </Link>
            </div>
          ) : (
            <>
              <TotalBlock
                itemSubtotal={itemSubtotal}
                shipping={shipping}
                total={total}
              />
              <div className="max-w-sm mx-auto">
                <PayPalBundleButton
                  productIds={availableProducts.map((p) => p.id)}
                  clientId={paypalClientId}
                />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function PageHeader() {
  return (
    <div className="text-center mb-8">
      <p className="text-[11px] uppercase tracking-[0.32em] text-brass-light">
        — Checkout —
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <p className="text-cream-dim font-serif italic mb-6">
        Nothing selected yet.
      </p>
      <Link
        href="/shop"
        className="inline-block text-[11px] uppercase tracking-[0.22em] text-labradorite-light hover:text-labradorite-glow border border-brass/40 hover:border-labradorite-light rounded-full px-6 py-2.5 transition-colors"
      >
        Browse relics →
      </Link>
    </div>
  );
}

function ItemRow({ product, onRemove }) {
  const effective = Number(product.effectivePrice ?? product.price);
  const showSale = product.onSale && Number(product.salePrice) < Number(product.price);
  return (
    <li
      className="flex items-center gap-4 p-3 sm:p-4 rounded-md bg-forest/60 border border-brass/20"
    >
      <Link
        href={`/shop/${product.id}`}
        className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-ink/40 rounded-sm overflow-hidden block focus:outline-none focus-visible:ring-2 focus-visible:ring-labradorite-light"
      >
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="80px"
            className="object-cover"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
          />
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/shop/${product.id}`}
          className="font-chancery text-lg sm:text-xl text-cream hover:text-labradorite-glow leading-tight block"
        >
          {product.name}
        </Link>
        {showSale ? (
          <p className="text-xs text-cream-dim/80 italic">
            <span className="text-rose-300">${product.salePrice}</span>{" "}
            <span className="line-through text-cream-dim/50">${product.price}</span>
          </p>
        ) : (
          <p className="text-xs text-cream-dim/80 italic">${effective.toFixed(2)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${product.name} from order`}
        className="w-8 h-8 rounded-full flex items-center justify-center text-cream-dim/60 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3 3 L 11 11 M 11 3 L 3 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </li>
  );
}

function SoldItemRow({ product, onRemove }) {
  return (
    <li
      className="flex items-center gap-4 p-3 sm:p-4 rounded-md bg-forest/40 border border-brass/15 opacity-60"
    >
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-ink/40 rounded-sm overflow-hidden">
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="80px"
            className="object-cover grayscale"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-chancery text-lg sm:text-xl text-cream-dim line-through leading-tight">
          {product.name}
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-200/70 italic">
          Sold before checkout
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${product.name} from order`}
        className="w-8 h-8 rounded-full flex items-center justify-center text-cream-dim/60 hover:text-cream transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3 3 L 11 11 M 11 3 L 3 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </li>
  );
}

function TotalBlock({ itemSubtotal, shipping, total }) {
  const free = shipping === 0;
  return (
    <div className="max-w-sm mx-auto mb-6 px-5">
      <div className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={`$${itemSubtotal.toFixed(2)}`} />
        <Row
          label="Shipping"
          value={free ? "Free" : `$${shipping.toFixed(2)}`}
          sub="US only"
          valueEmphasis={free ? "free" : null}
        />
      </div>
      <div className="hairline my-3" />
      <Row
        label="Total"
        value={`$${total.toFixed(2)}`}
        emphasis
      />
    </div>
  );
}

function Row({ label, value, sub, emphasis, valueEmphasis }) {
  const valueCls = emphasis
    ? "font-chancery text-3xl text-labradorite-glow"
    : valueEmphasis === "free"
    ? "font-chancery text-lg text-labradorite-light"
    : "font-chancery text-lg text-cream";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={`${
          emphasis
            ? "text-[11px] uppercase tracking-[0.22em] text-brass-light"
            : "text-[12px] uppercase tracking-[0.18em] text-cream-dim/70"
        }`}
      >
        {label}
        {sub && (
          <span className="text-[10px] normal-case tracking-normal text-cream-dim/50 italic ml-2">
            · {sub}
          </span>
        )}
      </span>
      <span className={valueCls}>{value}</span>
    </div>
  );
}
