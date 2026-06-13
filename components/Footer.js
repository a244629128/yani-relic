import Link from "next/link";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";
import DepopLink from "@/components/DepopLink";
import MailtoLink from "@/components/MailtoLink";
import { links } from "@/data/products";

export default function Footer() {
  return (
    <footer className="relative mt-24 pb-10 px-5 sm:px-8 text-cream-dim">
      <div className="mx-auto max-w-5xl">
        <MoonPhaseDivider className="mb-10" />

        <div className="grid md:grid-cols-3 gap-10 mb-12 text-center md:text-left">
          <div>
            <h3 className="font-serif text-2xl text-cream mb-3">Yani Relics</h3>
            <p className="text-sm leading-relaxed">
              A small, slow shop of handmade labradorite pieces — wrapped one at a time, in a quiet
              kitchen, with the kettle on.
            </p>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.22em] text-brass-light mb-4">Wander</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/shop" className="hover:text-labradorite-light">Relics</Link></li>
              <li><Link href="/about" className="hover:text-labradorite-light">About</Link></li>
              <li><Link href="/contact" className="hover:text-labradorite-light">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.22em] text-brass-light mb-4">Find Me</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <DepopLink source="footer" className="hover:text-labradorite-glow">
                  Depop →
                </DepopLink>
              </li>
              <li>
                <a href={links.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-labradorite-glow">
                  TikTok →
                </a>
              </li>
              <li>
                <a href={links.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-labradorite-glow">
                  Instagram →
                </a>
              </li>
              <li>
                <MailtoLink
                  href={`mailto:${links.email}`}
                  source="footer"
                  className="hover:text-labradorite-glow"
                >
                  {links.email}
                </MailtoLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="hairline mb-6" />
        <p className="text-center text-xs text-cream-dim/70 tracking-wider">
          © {new Date().getFullYear()} Yani Relics · made by hand, sent with care
        </p>
      </div>
    </footer>
  );
}
