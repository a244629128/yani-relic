import Link from "next/link";
import Image from "next/image";
import { BLUR_DATA_URL } from "@/data/products";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";

/**
 * Bottom-of-product-page "More relics" section.
 *
 * Picks up to 3 available (not sold), not-current-product relics in a
 * deterministic order keyed by the current product id — so the same
 * product page consistently shows the same 3 suggestions across requests,
 * but different products show different sets. Avoids the SSR/cache
 * non-determinism of Math.random() while still feeling varied.
 *
 * Server component — no client JS, no hydration needed.
 */
export default function RelatedRelics({ currentId, allProducts = [] }) {
  const candidates = allProducts.filter((p) => p.id !== currentId && !p.sold);
  if (candidates.length === 0) return null;

  const picks = pickThree(candidates, currentId);
  if (picks.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-3 sm:px-5 lg:px-8 pb-16 md:pb-24">
      <MoonPhaseDivider className="my-10 md:my-16 max-w-[260px] mx-auto" />
      <p className="text-[11px] uppercase tracking-[0.22em] text-brass-light text-center mb-2">
        Other relics
      </p>
      <h2 className="font-chancery text-3xl sm:text-4xl text-cream text-center mb-8">
        Wander further
      </h2>

      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {picks.map((p) => (
          <Link
            key={p.id}
            href={`/shop/${p.id}`}
            className="group block"
            aria-label={`View ${p.name}`}
          >
            <div className="relative aspect-square bg-ink/40 rounded-sm overflow-hidden">
              <Image
                src={p.image}
                alt={p.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
                sizes="(min-width: 768px) 25vw, 33vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
              />
            </div>
            <div className="mt-2 text-center">
              <p className="font-chancery text-lg sm:text-xl text-cream group-hover:text-labradorite-glow transition-colors">
                {p.name}
              </p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-cream-dim/70">
                ${p.price}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-center mt-8">
        <Link
          href="/shop"
          className="text-xs uppercase tracking-[0.22em] text-cream-dim hover:text-labradorite-light"
        >
          ← Back to all relics
        </Link>
      </p>
    </section>
  );
}

// Deterministic 3-pick keyed on the current product id. Same id → same picks,
// reproducible across SSR + revalidate without Math.random().
function pickThree(candidates, currentId) {
  if (candidates.length <= 3) return candidates;
  const seed = hashStr(currentId);
  // Fisher–Yates with the seeded PRNG, take first 3.
  const arr = [...candidates];
  const rng = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
