import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacy — Yani Relics",
  description: "How Yani Relics handles visitor data — short version: barely.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pb-24 md:pb-0">
        <section className="mx-auto max-w-2xl px-5 sm:px-8 pt-12 pb-16 md:pt-20 text-cream">
          <p className="text-xs uppercase tracking-[0.22em] text-brass-light mb-3">
            The fine print
          </p>
          <h1 className="font-chancery text-4xl sm:text-5xl mb-6">Privacy</h1>

          <div className="space-y-5 leading-relaxed text-cream/90 font-serif text-lg">
            <p>
              Yani Relics is a small handmade jewelry shop. We collect as little as we can.
            </p>

            <h2 className="font-chancery text-2xl text-parchment pt-4">What we collect</h2>
            <p>
              When you browse the site, we store an anonymous identifier in your
              browser&apos;s local storage so we can tell how many distinct people view
              each relic. We also count how long product pages are open and which
              relics are clicked. None of this is connected to your name, email,
              location, or device fingerprint.
            </p>
            <p>
              We use Vercel Web Analytics for high-level visit counts. Vercel sees
              your country, browser, and the page you visited — they do not set
              third-party cookies and don&apos;t track you across sites.
            </p>

            <h2 className="font-chancery text-2xl text-parchment pt-4">What we don&apos;t collect</h2>
            <ul className="list-disc pl-5 space-y-1 text-cream/85">
              <li>No third-party advertising trackers</li>
              <li>No social-media pixels (Meta, TikTok, etc.)</li>
              <li>No cookies for tracking — only the local-storage identifier described above</li>
              <li>No account, email, or password unless you message us directly</li>
            </ul>

            <h2 className="font-chancery text-2xl text-parchment pt-4">Purchases</h2>
            <p>
              Sales happen on Depop. Once you click &quot;Shop on Depop,&quot; Depop&apos;s
              privacy practices apply — not ours. We never see your payment details.
            </p>

            <h2 className="font-chancery text-2xl text-parchment pt-4">Opting out</h2>
            <p>
              Clear your browser&apos;s site data for yanirelics.com and the local
              identifier is gone. Use a private/incognito window to browse without
              being counted at all.
            </p>

            <h2 className="font-chancery text-2xl text-parchment pt-4">Questions</h2>
            <p>
              Write to <a href="mailto:hello@yanirelics.com" className="text-labradorite-light hover:text-labradorite-glow underline underline-offset-2">hello@yanirelics.com</a>.
            </p>

            <p className="text-cream-dim/70 italic text-base pt-6">
              Last updated 2026-06-10.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
