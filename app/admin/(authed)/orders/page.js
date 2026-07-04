import Link from "next/link";
import {
  getRecentOrders,
  getOrderCounts,
  formatAmount,
  formatShippingAddress,
} from "@/lib/orders-db";
import MarkSoldButton from "../_components/MarkSoldButton";
import MarkUnsoldButton from "../_components/MarkUnsoldButton";
import MarkedRefundedButton from "../_components/MarkedRefundedButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders — Vault" };

const STATUS_STYLES = {
  created:   "bg-yellow-200/15 text-yellow-200 border-yellow-200/40",
  approved:  "bg-yellow-200/15 text-yellow-200 border-yellow-200/40",
  captured:  "bg-labradorite/25 text-labradorite-light border-labradorite-light/40",
  failed:    "bg-rose-300/15 text-rose-300 border-rose-300/40",
  refunded:  "bg-rose-300/15 text-rose-300 border-rose-300/40",
  voided:    "bg-cream-dim/15 text-cream-dim border-cream-dim/30",
  oversold:  "bg-red-900/40 text-red-200 border-red-300/60",
};

// PayPal Dashboard deep-link to a specific order. Switches sandbox vs live.
function paypalDashboardUrl(orderId) {
  const isLive = process.env.PAYPAL_ENV === "live";
  const host = isLive ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
  return `${host}/activities/details/inv/${orderId}`;
}

export default async function AdminOrdersPage() {
  const [orders, counts] = await Promise.all([
    getRecentOrders({ limit: 100 }),
    getOrderCounts(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-chancery text-4xl text-cream">Orders</h1>
          <p className="text-cream-dim text-sm mt-1">
            PayPal captures, newest first. {counts.total} total · {counts.captured} captured · {counts.refunded} refunded.
          </p>
        </div>
      </div>

      {counts.oversold > 0 && (
        <div className="mb-6 rounded-md border border-red-300/60 bg-red-900/30 p-4">
          <p className="text-red-100 text-sm leading-relaxed">
            <strong>⚠ {counts.oversold} oversell event{counts.oversold === 1 ? "" : "s"}</strong>{" "}
            detected — PayPal captured the buyer&apos;s money but another buyer
            already claimed the same relic. <strong>Refund manually in
            PayPal Dashboard</strong>, then click <em>Marked refunded</em> on
            the row to clear it.
          </p>
        </div>
      )}

      {counts.needsMarkSold > 0 && (
        <div className="mb-6 rounded-md border border-yellow-200/40 bg-yellow-200/10 p-4">
          <p className="text-yellow-100 text-sm">
            <strong>{counts.needsMarkSold}</strong>{" "}
            order{counts.needsMarkSold === 1 ? "" : "s"} paid but not yet marked
            sold. Click <em>Mark sold</em> after you&apos;ve shipped and
            removed the piece from Depop.
          </p>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="border border-parchment/15 rounded-md bg-forest/40 p-10 text-center">
          <p className="text-cream-dim italic font-serif mb-2">
            No PayPal orders yet.
          </p>
          <p className="text-cream-dim/60 text-xs">
            They&apos;ll appear here as soon as the first one comes in.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const shipping = formatShippingAddress(o.shipping_address);
            // The product's actual sold flag is the truth (Phase 2B auto-sets
            // it after capture). The order's sold_marked column is now just
            // legacy tracking — we branch the button purely on productSold.
            const isOversold = o.status === "oversold";
            const isCaptured = o.status === "captured";
            // Manual mark-sold/unsold buttons apply to single-item orders
            // only. Bundle orders flip all pieces atomically at capture
            // (see capturePayPalBundleOrder). If reconciliation is ever
            // needed for a bundle, admin does it product-by-product via
            // the /admin/<productId> edit pages.
            const showMarkSold =
              !o.isBundle && isCaptured && o.productSold === false;
            const showMarkUnsold =
              !o.isBundle && isCaptured && o.productSold === true;
            return (
              <li
                key={o.id}
                className={`border rounded-md p-4 sm:p-5 ${
                  isOversold
                    ? "border-red-300/50 bg-red-900/15"
                    : "border-parchment/15 bg-forest/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className={`text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${
                          STATUS_STYLES[o.status] || ""
                        }`}
                      >
                        {o.status}
                      </span>
                      {o.isBundle && (
                        <span className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border border-brass/50 text-brass-light bg-brass/10">
                          Bundle
                        </span>
                      )}
                      {o.sold_marked && (
                        <span className="text-[10px] uppercase tracking-[0.18em] text-labradorite-light/80">
                          ✓ Sold marked
                        </span>
                      )}
                      <span className="text-cream-dim text-xs">
                        {new Date(o.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-cream font-chancery text-2xl mb-1">
                      {o.isBundle ? (
                        <span>{o.productName}</span>
                      ) : (
                        <Link
                          href={`/admin/${o.product_id}`}
                          className="hover:text-labradorite-light transition-colors"
                        >
                          {o.productName}
                        </Link>
                      )}
                      <span className="text-labradorite-glow text-xl">
                        {" "}— {formatAmount(o.amount_cents, o.currency)}
                      </span>
                    </p>
                    {o.isBundle && o.items && o.items.length > 0 && (
                      <ul className="mb-2 pl-3 border-l border-brass/30 space-y-0.5">
                        {o.items.map((it) => (
                          <li key={it.productId} className="text-cream/80 text-sm">
                            <Link
                              href={`/admin/${it.productId}`}
                              className="hover:text-labradorite-light transition-colors"
                            >
                              {it.productName}
                            </Link>
                            <span className="text-cream-dim/60 text-xs ml-2">
                              {formatAmount(it.priceCents, o.currency)}
                            </span>
                            {it.productSold === false && (
                              <span className="text-yellow-200/80 text-[10px] uppercase tracking-[0.18em] ml-2">
                                (not marked sold)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-cream-dim text-xs">
                      {o.buyer_name || "(buyer name pending)"} ·{" "}
                      {o.buyer_email || "(email pending)"}
                    </p>
                    {shipping && shipping.lines.length > 0 && (
                      <div className="mt-3 text-xs text-cream/85 leading-relaxed">
                        {shipping.recipient && (
                          <p className="font-medium">{shipping.recipient}</p>
                        )}
                        {shipping.lines.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-cream-dim/50 text-[10px] mt-2 font-mono break-all">
                      Order: {o.id}
                      {o.capture_id && <> · Capture: {o.capture_id}</>}
                    </p>
                    {isOversold && (
                      <a
                        href={paypalDashboardUrl(o.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-red-200 hover:text-red-100 underline-offset-4 hover:underline"
                      >
                        Open in PayPal Dashboard →
                      </a>
                    )}
                  </div>
                  {showMarkSold && (
                    <MarkSoldButton orderId={o.id} productName={o.productName} />
                  )}
                  {showMarkUnsold && (
                    <MarkUnsoldButton orderId={o.id} productName={o.productName} />
                  )}
                  {isOversold && (
                    <MarkedRefundedButton
                      orderId={o.id}
                      buyerName={o.buyer_name}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
