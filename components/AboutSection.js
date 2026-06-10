import FernSprig from "@/components/decor/FernSprig";

export default function AboutSection({ compact = false }) {
  if (compact) {
    return (
      <section className="relative mx-auto max-w-4xl px-5 sm:px-8 py-16 md:py-24">
        <FernSprig className="absolute right-0 top-4 w-16 text-brass/25" flip />
        <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-4">
          About the Maker
        </p>
        <h2 className="font-chancery text-4xl sm:text-5xl text-cream text-center mb-5">
          A small shop in a quiet kitchen.
        </h2>
        <p className="text-cream-dim text-center leading-relaxed max-w-2xl mx-auto mb-8">
          I&apos;m Yani. I wrap labradorite by hand in the evenings, mostly with the kettle on. Every piece
          is one-of-one — same hands, same stones, but never the same flash twice. If a relic finds you, she was
          meant to.
        </p>
        <div className="text-center">
          <a
            href="/about"
            className="text-sm uppercase tracking-[0.18em] text-labradorite-glow hover:text-cream"
          >
            Read more →
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto max-w-4xl px-5 sm:px-8 py-16 md:py-24">
      <FernSprig className="absolute -left-4 top-10 w-20 md:w-28 text-brass/30 opacity-70" />
      <FernSprig flip className="absolute -right-4 bottom-10 w-20 md:w-28 text-brass/30 opacity-70" />

      <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-4">
        About the Maker
      </p>
      <h1 className="font-chancery text-5xl sm:text-7xl text-cream text-center mb-10">
        I&apos;m Yani.
      </h1>

      <div className="parchment rounded-sm p-8 sm:p-12 leading-relaxed font-serif text-lg space-y-5">
        <p>
          I started wrapping labradorite because I couldn&apos;t stop picking up smooth stones on walks.
          One night, after the kettle had clicked off twice, I sat down with a pair of pliers and a small
          coil of antique brass wire, and I made the first one.
        </p>
        <p>
          Everything I sell is made by my hands, one piece at a time, in a quiet kitchen. I work in the
          evenings, mostly, when the windows have gone dark and the dog is asleep. I don&apos;t do batches.
          I don&apos;t do duplicates. I find a stone, I sit with her for a while, and I wrap her in the
          way she asks to be wrapped.
        </p>
        <p>
          Every relic is one-of-one — same hands, same care, but the labradorite flash is never the same
          twice. Some are river-pebble small. Some hold a wide blue ocean. They go to the people who need
          them.
        </p>
        <p className="italic">— Yani</p>
      </div>
    </section>
  );
}
