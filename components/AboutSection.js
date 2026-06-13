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
          Hi, I&apos;m Yani.
        </h2>
        <p className="text-cream-dim text-center leading-relaxed max-w-2xl mx-auto mb-8">
          I make little labradorite pendants for people who like things that feel
          a little mysterious, a little old, and a little hard to explain.
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
        Hi, I&apos;m Yani.
      </h1>

      <div className="parchment rounded-sm p-8 sm:p-12 leading-relaxed font-serif text-lg space-y-5">
        <p>
          I make little labradorite pendants for people who like things that feel
          a little mysterious, a little old, and a little hard to explain.
        </p>

        <p>
          I&apos;ve always liked objects that look quiet at first, then suddenly
          show you something when the light changes. That is what I love most
          about labradorite. One second it looks dark and simple, and then it
          flashes blue, green, gold, or this strange stormy glow that never
          really looks the same twice.
        </p>

        <p>That is the feeling I try to keep in every piece.</p>

        <p>
          Each pendant is wrapped by hand, one at a time. I don&apos;t make
          duplicates, and I don&apos;t really want them to feel too polished or
          perfect. I like when a piece still feels like it has a little secret to
          it, like something you found instead of something that came from a
          factory.
        </p>

        <p className="italic">
          Some of them turn out soft and moonlit.
          <br />
          Some feel more like forest relics.
          <br />
          Some look like they belong in an old drawer, a spellbook, or around
          the neck of someone who definitely has a favorite candle.
        </p>

        <p>
          Most pieces come on a simple black cord so they are easy to wear right
          away. Everything is packed by hand and shipped from Massachusetts.
        </p>

        <p>
          Yani Relics is still small, and honestly, I like it that way. Every
          piece gets its own name, its own mood, and its own tiny story before
          it leaves me.
        </p>

        <p>Thank you for being here and looking closely.</p>

        <p>Maybe one of them will feel like yours.</p>

        <p className="italic">— Yani</p>
      </div>
    </section>
  );
}
