import Link from "next/link";
import Image from "next/image";
import { getProducts } from "@/lib/products-db";
import { BLUR_DATA_URL } from "@/data/products";

export const dynamic = "force-dynamic";

export default async function AdminListPage() {
  const products = await getProducts();
  const total = products.length;
  const available = products.filter((p) => !p.sold).length;
  const sold = total - available;
  const featured = products.filter((p) => p.featured).length;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-chancery text-cream text-3xl sm:text-4xl">All relics</h1>
          <p className="text-cream-dim text-sm mt-1">
            {total} total · {available} available · {sold} found home · {featured} featured
          </p>
        </div>
        <Link href="/admin/new" className="btn-relic !py-2 !px-5 !text-[12px]">
          + New relic
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="card-relic p-8 text-center text-cream-dim">
          <p className="font-serif italic mb-3">No relics yet.</p>
          <p className="text-sm">
            If you just set up Supabase, you may need to run{" "}
            <code className="bg-forest/60 px-2 py-1 rounded text-xs">npm run seed</code> to
            populate the starter products.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <li
              key={p.id}
              className="card-relic p-3 sm:p-4 flex items-center gap-3 sm:gap-4"
            >
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-ink/40 rounded-sm overflow-hidden">
                {p.image && (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    unoptimized
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-chancery text-cream text-xl truncate">{p.name}</p>
                <p className="text-xs text-cream-dim mt-0.5">
                  <span className="text-labradorite-light">${p.price}</span>
                  {" · "}
                  {p.sold ? "Sold" : "Available"}
                  {p.featured && " · ★ Featured"}
                </p>
                <p className="text-[10px] text-cream-dim/70 mt-0.5 truncate">{p.id}</p>
              </div>
              <Link
                href={`/admin/${p.id}`}
                className="text-[11px] uppercase tracking-[0.18em] text-labradorite-light hover:text-labradorite-glow shrink-0"
              >
                Edit →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
