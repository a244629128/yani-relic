"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BLUR_DATA_URL, links } from "@/data/products";
import { getOrderForBuyer } from "@/lib/paypal-actions";
import { getSessionId } from "@/lib/analytics";

// After PayPal capture completes, the buyer is redirected here. We
// re-fetch the order from our DB via a session-bound server action.
// The order row write happens server-side during capture; there's a
// small window where the client redirect can arrive before that write
// is durable (Codex review missed-item #5). Poll a few times before
// declaring "not found" to absorb that lag.
const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1200;

export default function ThanksClient({ orderId }) {
  const [state, setState] = useState({ phase: "loading" }); // loading | ok | wrong_session | not_paid | not_found | missing
  const [order, setOrder] = useState(null);
  const [product, setProduct] = useState(null);

  useEffect(() => {
    if (!orderId) {
      setState({ phase: "missing" });
      return;
    }
    let cancelled = false;
    const sessionId = getSessionId();
    if (!sessionId) {
      setState({ phase: "no_session" });
      return;
    }

    async function tryFetch(attempt = 0) {
      const res = await getOrderForBuyer(orderId, sessionId);
      if (cancelled) return;
      if (res.ok) {
        setOrder(res.order);
        setProduct(res.product);
        setState({ phase: "ok" });
        return;
      }
      if (res.error === "not_found" && attempt < POLL_ATTEMPTS - 1) {
        // Brief retry — capture DB write might still be landing.
        setTimeout(() => tryFetch(attempt + 1), POLL_INTERVAL_MS);
        return;
      }
      setState({ phase: res.error || "not_found" });
    }
    tryFetch(0);
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (state.phase === "loading") {
    return (
      <section className="mx-auto max-w-2xl px-5 sm:px-8 py-16 text-center">
        <p className="font-chancery text-3xl text-cream mb-3">A moment…</p>
        <p className="text-cream-dim italic font-serif">
          Looking up your relic.
        </p>
      </section>
    );
  }

  if (state.phase === "ok") {
    return <SuccessView order={order} product={product} />;
  }

  if (state.phase === "wrong_session") {
    return (
      <InfoView
        title="This receipt belongs to another browser"
        body={
          <>
            <p className="mb-3">
              Looks like you&apos;re viewing this confirmation link from a
              different device or browser than the one you used to check out.
            </p>
            <p className="text-cream-dim text-sm">
              Check your PayPal receipt email for the order details. If you
              need help, write to <SupportEmail />.
            </p>
          </>
        }
      />
    );
  }

  if (state.phase === "no_session") {
    return (
      <InfoView
        title="Couldn't verify your browser"
        body={
          <>
            <p className="mb-3">
              Your browser may have private-mode storage disabled, so we
              can&apos;t confirm this is the same session that placed the
              order. PayPal will have emailed you a receipt with the order
              ID.
            </p>
            <p className="text-cream-dim text-sm">
              Need anything? Write to <SupportEmail />.
            </p>
          </>
        }
      />
    );
  }

  if (state.phase === "not_paid") {
    return (
      <InfoView
        title="Your order is still being processed"
        body={
          <>
            <p className="mb-3">
              PayPal is still confirming the payment. Refresh in a moment, or
              check your PayPal receipt email.
            </p>
            <p className="text-cream-dim text-sm">
              If this persists, write to <SupportEmail />.
            </p>
          </>
        }
      />
    );
  }

  // not_found or missing or unknown
  return (
    <InfoView
      title="We couldn't find that order"
      body={
        <>
          <p className="mb-3">
            The link may be incorrect, or it was placed on a different device.
            PayPal will have emailed you a receipt with the confirmation
            number.
          </p>
          <p className="text-cream-dim text-sm">
            If you think this is a mistake, write to <SupportEmail /> and
            we&apos;ll sort it out.
          </p>
        </>
      }
    />
  );
}

function SuccessView({ order, product }) {
  // Status branches the celebration tone (Codex brainstorm B):
  // - captured: full celebration
  // - oversold: clear "two hands reached" message, refund being processed
  // - refunded: calm closure
  const status = order.status;
  const captured = status === "captured";
  const oversold = status === "oversold";
  const refunded = status === "refunded";

  const total = (order.amount_cents / 100).toFixed(2);
  const dateStr = order.captured_at
    ? new Date(order.captured_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const shipping = formatShipping(order.shipping_address);

  let titleLine;
  let leadBlurb;
  if (captured) {
    titleLine = "She has chosen you.";
    leadBlurb = "Thank you — your relic is on her way to her new person.";
  } else if (oversold) {
    titleLine = "So sorry — two hands at the same moment.";
    leadBlurb =
      "PayPal captured your payment, but another buyer reached this relic at the same instant. The shop owner has been notified and will refund you manually within a day or two. No action needed on your end.";
  } else if (refunded) {
    titleLine = "Your order has been refunded.";
    leadBlurb = "The refund has been processed by the shop owner. You should see it on your PayPal account within a few days.";
  }

  return (
    <section className="mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16 text-cream">
      <p className="text-[11px] uppercase tracking-[0.22em] text-brass-light text-center mb-3">
        Order #{order.id.slice(-10)}
      </p>
      <h1 className="font-chancery text-4xl sm:text-6xl text-center mb-4">
        {titleLine}
      </h1>
      <p className="text-cream/85 text-center max-w-xl mx-auto mb-10 leading-relaxed">
        {leadBlurb}
      </p>

      {/* Relic + summary card */}
      <div className="grid sm:grid-cols-[160px_1fr] gap-5 items-start bg-forest/40 border border-parchment/15 rounded-md p-5 mb-10">
        <div className="relative aspect-square w-full sm:w-40 bg-ink/40 rounded-sm overflow-hidden">
          {product?.image && (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="160px"
              className="object-cover"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
            />
          )}
        </div>
        <div>
          <p className="font-chancery text-3xl mb-1">
            {product?.name || order.product_id}
          </p>
          <p
            className={`text-2xl font-chancery mb-3 ${
              refunded ? "text-cream-dim" : oversold ? "text-yellow-200" : "text-labradorite-glow"
            }`}
          >
            ${total} <span className="text-xs text-cream-dim/70">{order.currency}</span>
            {refunded && (
              <span className="ml-2 text-[11px] uppercase tracking-[0.18em] text-rose-300">
                refunded
              </span>
            )}
            {oversold && (
              <span className="ml-2 text-[11px] uppercase tracking-[0.18em] text-yellow-200">
                refunding
              </span>
            )}
          </p>
          {dateStr && (
            <p className="text-cream-dim text-xs italic">{dateStr}</p>
          )}
          {order.buyer_name && (
            <p className="text-cream-dim text-sm mt-1">
              {order.buyer_name}
              {order.buyer_email && <> · {order.buyer_email}</>}
            </p>
          )}
        </div>
      </div>

      {/* Shipping address */}
      {captured && shipping && (
        <div className="bg-forest/40 border border-parchment/15 rounded-md p-5 mb-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-brass-light mb-3">
            Shipping to
          </p>
          {shipping.recipient && (
            <p className="font-medium mb-1">{shipping.recipient}</p>
          )}
          {shipping.lines.map((line, i) => (
            <p key={i} className="text-cream/90 leading-snug">
              {line}
            </p>
          ))}
        </div>
      )}

      {/* What happens next */}
      {captured && (
        <div className="bg-forest/40 border border-parchment/15 rounded-md p-5 mb-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-brass-light mb-3">
            What happens next
          </p>
          <ul className="space-y-3 text-cream/90 leading-relaxed">
            <li className="flex gap-3">
              <span className="text-labradorite-light shrink-0">·</span>
              <span>
                PayPal has emailed you a receipt with this order&apos;s
                confirmation number.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-labradorite-light shrink-0">·</span>
              <span>
                I&apos;ll wrap her by hand over the next 2–3 days — wax seal,
                hand-written note, the works.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-labradorite-light shrink-0">·</span>
              <span>
                You&apos;ll get a follow-up email from me when she ships with
                tracking details.
              </span>
            </li>
          </ul>

          <p className="text-cream-dim/80 italic text-sm mt-5 pt-4 border-t border-parchment/15">
            <strong className="not-italic text-cream-dim">Care note:</strong>{" "}
            Labradorite likes soft cloth and dim drawers. Avoid prolonged
            sunlight on the cord. If she dulls, a damp cloth and a slow polish
            with a soft towel brings the flash back.
          </p>
        </div>
      )}

      {/* Oversold / refund support card */}
      {(oversold || refunded) && (
        <div className="bg-forest/40 border border-yellow-200/30 rounded-md p-5 mb-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-100 mb-3">
            Need anything?
          </p>
          <p className="text-cream/90 leading-relaxed">
            If you don&apos;t see the refund on PayPal within 3 business days,
            or if you have any questions about what happened, write to{" "}
            <SupportEmail />. I&apos;ll personally make sure it&apos;s sorted.
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/shop"
          className="text-xs uppercase tracking-[0.22em] px-5 py-2.5 rounded-full border border-brass/60 text-cream hover:border-labradorite-light hover:text-labradorite-glow transition-colors"
        >
          ← All relics
        </Link>
        <a
          href={links.tiktok}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs uppercase tracking-[0.22em] px-5 py-2.5 rounded-full border border-brass/60 text-cream hover:border-labradorite-light hover:text-labradorite-glow transition-colors"
        >
          Follow on TikTok →
        </a>
      </div>

      {/* Tiny support footer */}
      <p className="text-center text-cream-dim/60 text-xs italic mt-12">
        Order ID: {order.id} · Questions: <SupportEmail />
      </p>
    </section>
  );
}

function InfoView({ title, body }) {
  return (
    <section className="mx-auto max-w-2xl px-5 sm:px-8 py-16">
      <h1 className="font-chancery text-3xl sm:text-5xl text-cream mb-5 text-center">
        {title}
      </h1>
      <div className="text-cream/90 leading-relaxed text-center max-w-xl mx-auto">
        {body}
      </div>
      <div className="text-center mt-10">
        <Link
          href="/shop"
          className="text-xs uppercase tracking-[0.22em] px-5 py-2.5 rounded-full border border-brass/60 text-cream hover:border-labradorite-light hover:text-labradorite-glow transition-colors"
        >
          ← Back to all relics
        </Link>
      </div>
    </section>
  );
}

function SupportEmail() {
  return (
    <a
      href={`mailto:${links.email}`}
      className="text-labradorite-light hover:text-labradorite-glow underline underline-offset-2"
    >
      {links.email}
    </a>
  );
}

function formatShipping(addr) {
  if (!addr || typeof addr !== "object") return null;
  const a = addr.address || addr;
  const recipient = addr.name?.full_name || null;
  const lines = [
    a.address_line_1,
    a.address_line_2,
    [a.admin_area_2, a.admin_area_1, a.postal_code].filter(Boolean).join(", "),
    a.country_code,
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return { recipient, lines };
}
