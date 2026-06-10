import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";

export const metadata = { title: "Font Demo · Black Chancery — Yani Relics" };

export default function FontDemoPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-5 sm:px-8 py-12 md:py-20">
          <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-3">
            Font Comparison
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-cream text-center mb-4">
            Cormorant Garamond → Black Chancery
          </h1>
          <p className="text-cream-dim text-center max-w-2xl mx-auto mb-8 text-sm">
            Black Chancery is a 1991 calligraphic display font — broad-pen, medieval / old-world.
            Cormorant Garamond is the elegant transitional serif currently used.
            Each row below shows the same content rendered in both, so you can judge fit.
          </p>
          <MoonPhaseDivider className="mb-12" />

          {/* 1. Hero title */}
          <DemoRow label="Hero title (homepage)">
            <Pair>
              <Panel kind="current">
                <h2
                  className="font-serif text-cream"
                  style={{
                    fontSize: "clamp(40px, 6vw, 80px)",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    lineHeight: 0.92,
                  }}
                >
                  <span className="block">YANI</span>
                  <span className="block">RELICS</span>
                </h2>
              </Panel>
              <Panel kind="chancery">
                <h2
                  className="font-chancery text-cream"
                  style={{
                    fontSize: "clamp(40px, 6vw, 80px)",
                    fontWeight: 400,
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                  }}
                >
                  <span className="block">Yani</span>
                  <span className="block">Relics</span>
                </h2>
              </Panel>
            </Pair>
          </DemoRow>

          {/* 2. Logo / brand mark in the header */}
          <DemoRow label="Header brand mark">
            <Pair>
              <Panel kind="current">
                <span
                  className="font-serif text-parchment uppercase tracking-[0.18em]"
                  style={{ fontSize: "20px", fontWeight: 500 }}
                >
                  Yani Relics
                </span>
              </Panel>
              <Panel kind="chancery">
                <span
                  className="font-chancery text-parchment"
                  style={{ fontSize: "26px", letterSpacing: "0.04em" }}
                >
                  Yani Relics
                </span>
              </Panel>
            </Pair>
          </DemoRow>

          {/* 3. Section heading */}
          <DemoRow label="Section heading">
            <Pair>
              <Panel kind="current">
                <h3
                  className="font-serif uppercase text-parchment"
                  style={{
                    fontSize: "20px",
                    letterSpacing: "0.32em",
                    fontWeight: 500,
                  }}
                >
                  The Relic Chose You
                </h3>
              </Panel>
              <Panel kind="chancery">
                <h3
                  className="font-chancery text-parchment"
                  style={{
                    fontSize: "32px",
                    letterSpacing: "0.04em",
                    fontWeight: 400,
                  }}
                >
                  The Relic Chose You
                </h3>
              </Panel>
            </Pair>
          </DemoRow>

          {/* 4. Banner price */}
          <DemoRow label="Banner — emphasized price">
            <Pair>
              <Panel kind="current">
                <p
                  className="font-serif text-parchment uppercase flex items-baseline gap-2"
                  style={{ fontSize: "13px", letterSpacing: "0.22em" }}
                >
                  <span>Free shipping on orders</span>
                  <span
                    style={{
                      color: "#b59a68",
                      fontSize: "22px",
                      letterSpacing: "0.1em",
                      fontWeight: 600,
                      fontStyle: "italic",
                    }}
                  >
                    $45+
                  </span>
                </p>
              </Panel>
              <Panel kind="chancery">
                <p
                  className="text-parchment flex items-baseline gap-2"
                  style={{ fontFamily: "Inter", fontSize: "13px", letterSpacing: "0.18em", textTransform: "uppercase" }}
                >
                  <span>Free shipping on orders</span>
                  <span
                    className="font-chancery"
                    style={{
                      color: "#b59a68",
                      fontSize: "32px",
                      letterSpacing: "0",
                      textTransform: "none",
                    }}
                  >
                    $45+
                  </span>
                </p>
              </Panel>
            </Pair>
          </DemoRow>

          {/* 5. Product card name */}
          <DemoRow label="Product card name">
            <Pair>
              <Panel kind="current">
                <h4 className="font-serif text-xl text-cream">First Frost</h4>
                <p className="text-xs text-cream-dim/80 italic mt-1">A pale labradorite, wrapped in antique brass wire.</p>
                <span className="font-serif text-labradorite-glow text-base mt-3 block">$68</span>
              </Panel>
              <Panel kind="chancery">
                <h4 className="font-chancery text-cream" style={{ fontSize: "28px" }}>
                  First Frost
                </h4>
                <p className="text-xs text-cream-dim/80 italic mt-1">A pale labradorite, wrapped in antique brass wire.</p>
                <span className="font-chancery text-labradorite-glow mt-3 block" style={{ fontSize: "22px" }}>$68</span>
              </Panel>
            </Pair>
          </DemoRow>

          {/* 6. Long body text — shows why Black Chancery is for headings only */}
          <DemoRow label="Body paragraph (Black Chancery is hard to read at this size)">
            <Pair>
              <Panel kind="current">
                <p className="text-cream-dim leading-relaxed text-sm" style={{ fontFamily: "Inter" }}>
                  I started wrapping labradorite because I couldn&apos;t stop picking up smooth stones on
                  walks. One night, after the kettle had clicked off twice, I sat down with a pair of pliers
                  and a small coil of antique brass wire, and I made the first one.
                </p>
              </Panel>
              <Panel kind="chancery" warn>
                <p className="font-chancery text-cream-dim leading-relaxed" style={{ fontSize: "18px" }}>
                  I started wrapping labradorite because I couldn&apos;t stop picking up smooth stones on
                  walks. One night, after the kettle had clicked off twice, I sat down with a pair of pliers
                  and a small coil of antique brass wire, and I made the first one.
                </p>
              </Panel>
            </Pair>
          </DemoRow>

          {/* 7. Full A-Z preview */}
          <DemoRow label="Black Chancery — full character set preview">
            <div className="card-relic p-6 sm:p-8 font-chancery text-cream" style={{ fontSize: "28px", lineHeight: 1.3 }}>
              <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
              <p>abcdefghijklmnopqrstuvwxyz</p>
              <p>0 1 2 3 4 5 6 7 8 9 &nbsp; &amp; ! ? . , : ; &mdash;</p>
              <p className="text-labradorite-light mt-4">
                Handmade labradorite relics for soft witches and moonlit souls.
              </p>
            </div>
          </DemoRow>

          {/* 8. Recommended pairing */}
          <DemoRow label="Recommended pairing (if you choose to switch)">
            <div className="card-relic p-6 sm:p-10">
              <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-3">
                Featured Relic
              </p>
              <h2
                className="font-chancery text-cream text-center mb-4"
                style={{ fontSize: "clamp(38px, 5vw, 64px)", letterSpacing: "0.02em" }}
              >
                Owl Hour
              </h2>
              <p className="text-cream/85 text-center max-w-md mx-auto leading-relaxed text-sm">
                Almost black until you tilt it — then a slow blue river runs through. For late-night writers.
              </p>
              <p className="text-center mt-4 font-chancery text-labradorite-light" style={{ fontSize: "24px" }}>
                $82
              </p>
              <p className="text-center mt-2 text-[10px] uppercase tracking-[0.22em] text-brass-light">
                One of One
              </p>
            </div>
            <p className="text-xs text-cream-dim/70 italic mt-3 text-center">
              Black Chancery for the relic name; Inter for body. Keep prices in Chancery for a unified
              hand-lettered feel, or in Inter for sharper readability.
            </p>
          </DemoRow>

          <div className="mt-16 pt-10 border-t border-parchment/15">
            <h3 className="font-serif text-2xl text-cream mb-4 text-center">My read</h3>
            <ul className="text-cream-dim text-sm space-y-2 max-w-2xl mx-auto leading-relaxed">
              <li>
                <span className="text-labradorite-light">✓</span> Great for hero name, big product titles, "specimen" labels, accent prices —
                anywhere you want a hand-lettered medieval feel.
              </li>
              <li>
                <span className="text-labradorite-light">✓</span> Reinforces the witchy / forest-relic theme more aggressively than Cormorant.
              </li>
              <li>
                <span className="text-rose-300/70">✗</span> Hard to read at small sizes (under ~24px) — don&apos;t use for body, captions,
                or anything dense.
              </li>
              <li>
                <span className="text-rose-300/70">✗</span> No italic / bold / numerals variants. Single weight.
              </li>
              <li>
                <span className="text-rose-300/70">✗</span> Not on Google Fonts — needs to be self-hosted (already done). 55KB on first paint.
              </li>
            </ul>
            <p className="text-center mt-8 text-cream text-sm">
              If you like the vibe, tell me where to apply it:{" "}
              <span className="text-labradorite-light">hero title only · all headings · brand mark · everything</span>
              {" "}— I&apos;ll wire it in.
            </p>
            <div className="text-center mt-6">
              <Link href="/" className="btn-relic">
                Back to home
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function DemoRow({ label, children }) {
  return (
    <section className="mb-12 sm:mb-16">
      <p className="text-[10px] uppercase tracking-[0.22em] text-brass-light mb-4">{label}</p>
      {children}
    </section>
  );
}

function Pair({ children }) {
  return <div className="grid sm:grid-cols-2 gap-3 sm:gap-5">{children}</div>;
}

function Panel({ kind, warn, children }) {
  const isChancery = kind === "chancery";
  return (
    <div
      className="card-relic p-6 sm:p-8 min-h-[160px] flex flex-col justify-center"
      style={
        warn
          ? { background: "rgba(60, 25, 25, 0.4)" }
          : undefined
      }
    >
      <p className="text-[9px] uppercase tracking-[0.22em] text-brass-light mb-4">
        {isChancery ? "Black Chancery" : "Cormorant Garamond"}
      </p>
      {children}
    </div>
  );
}
