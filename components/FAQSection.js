"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Is every piece really one of one?",
    a: "Yes — truly. I find each stone myself, sit with her for a while, and wrap her by hand. Once she goes to her person, that exact piece will never exist again. The stones are similar siblings, never twins.",
  },
  {
    q: "Where do you ship from? How long does it take?",
    a: "Pieces ship from my kitchen table within 2–4 days of an order. I use tracked shipping. Most orders within the country arrive in about a week. International is slower — please be patient with the post.",
  },
  {
    q: "How do I care for labradorite?",
    a: "Keep her away from harsh chemicals (perfume, hairspray), don't sleep or shower in her, and gently buff her with a soft cloth if she feels dull. Labradorite is softer than quartz — treat her like a small living thing.",
  },
  {
    q: "Can you make a custom piece for me?",
    a: "Sometimes, when I have the time and the right stone. Drop me a note — tell me what mood you're after. I can't promise, but I love trying.",
  },
  {
    q: "Why Depop and not your own shop?",
    a: "Depop keeps things simple for now — small shop, one maker, no warehouse. I might open a proper checkout one day. Until then, Depop is home.",
  },
  {
    q: "Are the cords / chains real silver / gold?",
    a: "Mostly antique brass wire and waxed cotton cord. Some pieces have brass-tone chains. I list each piece's exact materials on Depop. I don't use sterling silver in v1 of the shop.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState(0);

  return (
    <section className="mx-auto max-w-3xl px-5 sm:px-8 py-16 md:py-24">
      <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-4">
        Small Questions
      </p>
      <h2 className="font-chancery text-5xl sm:text-7xl text-cream text-center mb-10">
        FAQ
      </h2>

      <div className="space-y-3">
        {faqs.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="border border-brass/20 bg-moss/40 rounded-sm overflow-hidden transition-colors hover:border-brass/40"
            >
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="w-full flex items-center justify-between gap-4 text-left p-4 sm:p-5"
                aria-expanded={isOpen}
              >
                <span className="font-serif text-lg sm:text-xl text-cream">{item.q}</span>
                <span
                  className={`shrink-0 w-7 h-7 rounded-full border border-brass/50 flex items-center justify-center text-brass-light transition-transform ${
                    isOpen ? "rotate-45" : ""
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="1.5">
                    <path d="M6 1 V11 M1 6 H11" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 sm:px-5 pb-5 text-cream-dim leading-relaxed text-sm sm:text-base">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
