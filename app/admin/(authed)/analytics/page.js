import Link from "next/link";
import {
  getProductStats,
  getRecentActivity,
  formatDwell,
  formatPct,
} from "@/lib/analytics-db";
import ResetAllAnalyticsButton from "../_components/ResetAllAnalyticsButton";

export const dynamic = "force-dynamic"; // analytics is always live

export default async function AnalyticsPage({ searchParams }) {
  const params = await searchParams;
  const days = Number(params?.days) === 7 ? 7 : 30;

  const [{ stats, totals }, recent] = await Promise.all([
    getProductStats({ days }),
    getRecentActivity({ hours: 24 }),
  ]);

  const hasAny =
    totals.views > 0 ||
    totals.depopClicksAll > 0 ||
    totals.mailtoClicksAll > 0 ||
    totals.imageZooms > 0 ||
    totals.flipDeckClaims > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
      <div className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-chancery text-4xl text-cream">Analytics</h1>
          <p className="text-cream-dim text-sm mt-1">
            Anonymous engagement signals — last {days} days.
          </p>
          <p className="text-cream-dim/60 text-[11px] italic mt-1 max-w-xl">
            Unique visitor counts use a localStorage UUID and can be inflated by
            scripted abuse — cross-check Vercel Analytics for ground truth.
          </p>
        </div>
        <div className="flex gap-2">
          <RangePill href="?days=7" label="7d" active={days === 7} />
          <RangePill href="?days=30" label="30d" active={days === 30} />
        </div>
      </div>

      {!hasAny ? (
        <EmptyState />
      ) : (
        <>
          {/* === Totals tiles === */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
            <Tile label="Total views" value={totals.views} />
            <Tile label="Unique visitors" value={totals.uniqueVisitors} />
            <Tile
              label="Depop clicks (all)"
              value={totals.depopClicksAll}
              hint={`${totals.depopClicksPerProduct} per relic · ${totals.depopClicksGeneral} site-wide`}
            />
            <Tile
              label="Email clicks (all)"
              value={totals.mailtoClicksAll}
              hint={`${totals.mailtoClicksPerProduct} per relic · ${totals.mailtoClicksGeneral} site-wide`}
            />
            <Tile label="Fullscreen opens" value={totals.imageZooms} />
            <Tile
              label="Flip-deck claims"
              value={totals.flipDeckClaims}
              hint="from homepage card flip"
            />
          </div>

          {/* === Per-product table === */}
          <section className="mb-10">
            <h2 className="text-cream font-chancery text-2xl mb-3">
              By relic
            </h2>
            <div className="overflow-x-auto border border-parchment/15 rounded-md bg-forest/40">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-[0.18em] text-cream-dim/80 bg-forest/60">
                  <tr>
                    <Th className="text-left">Relic</Th>
                    <Th>Views</Th>
                    <Th>Avg dwell</Th>
                    <Th>Depop</Th>
                    <Th>Email</Th>
                    <Th>Intent CTR</Th>
                    <Th>Fullscreen</Th>
                    <Th>Flip deck</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-t border-parchment/10 ${
                        i === 0 && r.views > 0 ? "bg-labradorite/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/${r.id}`}
                          className="text-cream hover:text-labradorite-light transition-colors"
                        >
                          {r.name}
                        </Link>
                        {r.sold && (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-rose-300/70">
                            Sold
                          </span>
                        )}
                        {i === 0 && r.views > 0 && (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-labradorite-light">
                            ★ Most popular
                          </span>
                        )}
                      </td>
                      <Td>{r.views || "—"}</Td>
                      <Td>{formatDwell(r.avgDwellMs)}</Td>
                      <Td>{r.depopClicks || "—"}</Td>
                      <Td>{r.mailtoClicks || "—"}</Td>
                      <Td>{formatPct(r.intentCtr)}</Td>
                      <Td>{r.imageZooms || "—"}</Td>
                      <Td>{r.flipDeckClaims || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-cream-dim/60 text-xs italic mt-2">
              Avg dwell is directional, not exact (capped at 5 min, paused
              when the tab is hidden). Intent CTR = (Depop clicks + Email
              clicks) ÷ views — combined purchase-intent signal.
            </p>
          </section>

          {/* === Hot right now === */}
          {recent.length > 0 && (
            <section className="mb-10">
              <h2 className="text-cream font-chancery text-2xl mb-3">
                Hot right now <span className="text-cream-dim/60 text-sm font-sans">— last 24h</span>
              </h2>
              <ul className="space-y-1">
                {recent.slice(0, 5).map((r) => {
                  const product = stats.find((s) => s.id === r.product_id);
                  return (
                    <li
                      key={r.product_id}
                      className="flex justify-between items-baseline gap-4 bg-forest/40 border border-parchment/15 rounded-md px-4 py-2"
                    >
                      <Link
                        href={`/admin/${r.product_id}`}
                        className="text-cream hover:text-labradorite-light transition-colors"
                      >
                        {product?.name || r.product_id}
                      </Link>
                      <span className="text-cream-dim text-xs">
                        {r.views} views · {r.depopClicks} Depop clicks
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Danger zone */}
          <div className="mt-12 pt-6 border-t border-parchment/15">
            <p className="text-rose-300/70 text-xs uppercase tracking-[0.22em] mb-3">
              Danger zone
            </p>
            <ResetAllAnalyticsButton />
          </div>
        </>
      )}
    </main>
  );
}

function RangePill({ href, label, active }) {
  return (
    <Link
      href={href}
      className={`text-xs uppercase tracking-[0.18em] px-3 py-1 rounded-full border transition-colors ${
        active
          ? "bg-labradorite text-cream border-labradorite"
          : "border-brass/40 text-cream-dim hover:border-labradorite-light hover:text-labradorite-glow"
      }`}
    >
      {label}
    </Link>
  );
}

function Tile({ label, value, hint }) {
  return (
    <div className="bg-forest/40 border border-parchment/15 rounded-md p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-cream-dim/70 mb-1">
        {label}
      </p>
      <p className="font-chancery text-4xl text-labradorite-glow">{value}</p>
      {hint && (
        <p className="text-[10px] text-cream-dim/60 italic mt-1">{hint}</p>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2 font-normal ${className || "text-right"}`}
    >
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-4 py-3 text-right tabular-nums text-cream-dim">{children}</td>;
}

function EmptyState() {
  return (
    <div className="border border-parchment/15 rounded-md bg-forest/40 p-10 text-center">
      <p className="text-cream-dim italic font-serif mb-2">
        No events yet — once visitors browse your relics, you&apos;ll see them here.
      </p>
      <p className="text-cream-dim/60 text-xs">
        If you just deployed, give it a few minutes and try opening a product on
        the live site (incognito window so it counts as a fresh visitor).
      </p>
    </div>
  );
}
