import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";
import DepopLink from "@/components/DepopLink";
import MailtoLink from "@/components/MailtoLink";
import { links } from "@/data/products";

export const metadata = { title: "Contact — Yani Relics" };

const channels = [
  {
    href: links.depop,
    label: "Depop",
    note: "Buy a relic. Messages on Depop are fastest if you have a question about a specific piece.",
    track: true,
  },
  {
    href: links.tiktok,
    label: "TikTok",
    note: "Watch the wrapping. Drop a comment — I read every one.",
  },
  {
    href: links.instagram,
    label: "Instagram",
    note: "Mostly stills, candle-light, dusty surfaces.",
  },
  {
    href: `mailto:${links.email}`,
    label: links.email,
    note: "For longer notes, custom requests, or saying hi.",
    trackMailto: true,
  },
];

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-5 sm:px-8 py-16 md:py-24">
          <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-3">
            Contact
          </p>
          <h1 className="font-chancery text-5xl sm:text-7xl text-cream text-center mb-4">
            Come say hello.
          </h1>
          <p className="text-cream-dim text-center max-w-xl mx-auto mb-10">
            I&apos;m a one-person shop, so replies are slow but warm. Pick whichever feels right.
          </p>
          <MoonPhaseDivider className="mb-10" />

          <ul className="space-y-3">
            {channels.map((c) => {
              const inner = (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-chancery text-3xl text-ink mb-1">{c.label}</p>
                    <p className="text-ink/75 text-sm leading-relaxed">{c.note}</p>
                  </div>
                  <span className="text-ink/60 group-hover:text-labradorite transition-colors" aria-hidden>→</span>
                </div>
              );
              const className =
                "group block parchment rounded-sm p-5 sm:p-6 transition-shadow hover:shadow-glow";
              return (
                <li key={c.label}>
                  {c.track ? (
                    <DepopLink source="contact" className={className}>
                      {inner}
                    </DepopLink>
                  ) : c.trackMailto ? (
                    <MailtoLink href={c.href} source="contact" className={className}>
                      {inner}
                    </MailtoLink>
                  ) : (
                    <a
                      href={c.href}
                      target={c.href.startsWith("http") ? "_blank" : undefined}
                      rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className={className}
                    >
                      {inner}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="text-center text-xs text-cream-dim italic mt-10">
            No contact form for now — fewer ways for things to break, fewer ways for spam to creep in.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
