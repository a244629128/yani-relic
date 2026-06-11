"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { links, BLUR_DATA_URL } from "@/data/products";
import { trackDepopClick } from "@/lib/analytics";

const DESKTOP_DECK_SIZE = 5;
const MOBILE_DECK_SIZE = 3;
const FLIP_MS = 1100;

// Each card slot has a fixed ornament symbol on its back. Stable across shuffles
// so the visual identity of "card 3 is the star" never changes.
const SYMBOLS = ["moon", "sun", "star", "eye", "hand"];

/**
 * "The Relic Chose You" — interactive flip deck.
 *
 *   - Each visitor sees a different random initial deck (random selection
 *     runs client-side in useEffect so server and client agree on first paint).
 *   - Click face-down → flips face-up with a freshly-picked random product.
 *   - Click face-up → flips face-down. Next click reveals a new random product.
 *   - "Shuffle" actually re-shuffles the products.
 *
 * Mobile: single-card carousel (one large card centered, swipe horizontally,
 * dots below indicate active card).
 * Desktop: 5-column grid.
 */
export default function RelicFlipDeck({
  products = [],
  subtitle = "Choose a card and see which relic is calling to you.",
  accent = "gold",
}) {
  // Render desktop-sized deck on SSR; useEffect below trims to 3 on mobile after mount.
  const [cards, setCards] = useState(() =>
    Array.from({ length: DESKTOP_DECK_SIZE }, () => ({ product: null, isFlipped: false }))
  );
  const [hasMounted, setHasMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const pickRandom = useCallback((excludeIds = []) => {
    if (!products.length) return null;
    const pool = products.filter((p) => !excludeIds.includes(p.id));
    const fromPool = pool.length > 0 ? pool : products;
    return fromPool[Math.floor(Math.random() * fromPool.length)];
  }, [products]);

  // Detect mobile via matchMedia; on change, trim/expand the deck.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const deckSize = isMobile ? MOBILE_DECK_SIZE : DESKTOP_DECK_SIZE;

  // On mount + on deckSize change, populate (or resize) cards with random products.
  useEffect(() => {
    setCards(() => {
      const used = [];
      return Array.from({ length: deckSize }).map(() => {
        const product = pickRandom(used);
        if (product) used.push(product.id);
        return { product, isFlipped: false };
      });
    });
    setHasMounted(true);
  }, [pickRandom, deckSize]);

  const handleFlip = (i) => {
    setCards((prev) => {
      const card = prev[i];
      if (!card.isFlipped) {
        const otherFaceUpIds = prev
          .map((c, idx) => (idx !== i && c.isFlipped && c.product ? c.product.id : null))
          .filter(Boolean);
        const newProduct = pickRandom(otherFaceUpIds);
        if (!newProduct) return prev;
        const next = [...prev];
        next[i] = { product: newProduct, isFlipped: true };
        return next;
      }
      const next = [...prev];
      next[i] = { ...card, isFlipped: false };
      return next;
    });
  };

  const shuffle = () => {
    setCards((prev) => prev.map((c) => ({ ...c, isFlipped: false })));
    window.setTimeout(() => {
      setCards((prev) => {
        const used = [];
        return prev.map(() => {
          const product = pickRandom(used);
          if (product) used.push(product.id);
          return { product, isFlipped: false };
        });
      });
    }, FLIP_MS + 60);
  };

  const borderColor =
    accent === "teal" ? "rgba(90, 166, 166, 0.4)" : "rgba(181, 154, 104, 0.55)";

  return (
    <section className="relative">
      <div className="text-center mb-6 sm:mb-10">
        <div className="flex items-center justify-center gap-4 text-brass-light mb-3">
          <span className="hairline-parchment w-16 sm:w-24" />
          <SparkleMark />
          <h2
            className="font-chancery text-parchment"
            style={{
              fontSize: "clamp(22px, 1.8vw, 30px)",
              letterSpacing: "0.02em",
            }}
          >
            The Relic Chose You
          </h2>
          <SparkleMark />
          <span className="hairline-parchment w-16 sm:w-24" />
        </div>
      </div>

      {/* Mobile: 3 cards in a tight row, no scroll. Desktop: 5-col grid. */}
      <div className="flex sm:grid sm:grid-cols-5 gap-2 sm:gap-5 px-2 sm:px-4 max-w-5xl mx-auto justify-center">
        {cards.map((card, i) => (
          <div
            key={i}
            className="flex-1 max-w-[120px] sm:max-w-none sm:w-auto"
          >
            <FlipCard
              card={card}
              symbol={SYMBOLS[i]}
              onFlip={() => handleFlip(i)}
              borderColor={borderColor}
            />
          </div>
        ))}
      </div>

      <p className="mt-7 sm:mt-9 text-center text-cream-dim italic font-serif text-sm sm:text-base">
        {subtitle}
      </p>

      {hasMounted && (
        <div className="text-center mt-5">
          <button
            onClick={shuffle}
            className="text-[11px] uppercase tracking-[0.22em] text-cream-dim/70 hover:text-labradorite-light transition-colors"
          >
            ↻ Shuffle the deck
          </button>
        </div>
      )}
    </section>
  );
}

function FlipCard({ card, symbol, onFlip, borderColor }) {
  const { product, isFlipped } = card;
  return (
    <button
      type="button"
      onClick={onFlip}
      className="relative w-full aspect-[2/3] cursor-pointer group"
      style={{ perspective: "1200px" }}
      aria-label={
        isFlipped && product
          ? `${product.name} — click to flip back`
          : "Flip to reveal a relic"
      }
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: `transform ${FLIP_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
        }}
      >
        {/* Back of card */}
        <div
          className="absolute inset-0 rounded-[6px] overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background:
              "linear-gradient(160deg, #1a2520 0%, #0d1611 60%, #050a08 100%)",
            border: `1px solid ${borderColor}`,
            boxShadow:
              "inset 0 0 40px rgba(0,0,0,0.6), 0 12px 30px rgba(0,0,0,0.5)",
          }}
        >
          <BackOrnament symbol={symbol} />
        </div>

        {/* Front of card — relic reveal */}
        <div
          className="absolute inset-0 rounded-[6px] overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "#18241b",
            border: `1px solid ${borderColor}`,
            boxShadow:
              "inset 0 0 30px rgba(63, 143, 145, 0.18), 0 0 30px rgba(63, 143, 145, 0.22), 0 12px 30px rgba(0,0,0,0.5)",
          }}
        >
          {product ? <FrontCard relic={product} /> : null}
        </div>
      </div>

      <span
        aria-hidden
        className={`absolute inset-0 rounded-[6px] pointer-events-none transition-opacity duration-500 ${
          isFlipped ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ boxShadow: "0 0 28px rgba(63, 143, 145, 0.28)" }}
      />
    </button>
  );
}

/* ============================================================
 * Back of card — frame + corners + a unique symbol per slot.
 * ============================================================ */
function BackOrnament({ symbol }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* gold rectangular inner frame */}
      <div
        className="absolute"
        style={{
          inset: "10px",
          border: "1px solid rgba(181, 154, 104, 0.32)",
          borderRadius: "4px",
        }}
        aria-hidden
      />
      {/* corner ornaments */}
      {[
        { top: 12, left: 12, rotate: 0 },
        { top: 12, right: 12, rotate: 90 },
        { bottom: 12, right: 12, rotate: 180 },
        { bottom: 12, left: 12, rotate: 270 },
      ].map((pos, i) => (
        <svg
          key={i}
          width="18"
          height="18"
          viewBox="0 0 18 18"
          className="absolute"
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
            bottom: pos.bottom,
            transform: `rotate(${pos.rotate}deg)`,
          }}
          aria-hidden
        >
          <path d="M2 8 Q 4 4, 8 2" stroke="rgba(181, 154, 104, 0.55)" strokeWidth="0.9" fill="none" />
          <circle cx="2" cy="2" r="0.8" fill="rgba(181, 154, 104, 0.55)" />
        </svg>
      ))}

      {/* Center: symbol + tiny accent star + a hairline tail */}
      <div className="relative flex flex-col items-center gap-3">
        <Symbol kind={symbol} />
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M7 0 L 8.4 5.2 L 14 7 L 8.4 8.8 L 7 14 L 5.6 8.8 L 0 7 L 5.6 5.2 Z"
            fill="rgba(181, 154, 104, 0.6)"
          />
        </svg>
        <span className="block h-8 w-px" style={{ background: "rgba(181, 154, 104, 0.35)" }} />
      </div>
    </div>
  );
}

/* ============================================================
 * Symbol library — one per slot.
 * Each renders inside a ~56x56 box, brass-tinted, slightly varied.
 * ============================================================ */
function Symbol({ kind }) {
  switch (kind) {
    case "moon":
      return <SymbolMoon />;
    case "sun":
      return <SymbolSun />;
    case "star":
      return <SymbolStar />;
    case "eye":
      return <SymbolEye />;
    case "hand":
      return <SymbolHand />;
    default:
      return <SymbolMoon />;
  }
}

const BRASS = "rgba(181, 154, 104, 0.88)";
const BRASS_DIM = "rgba(181, 154, 104, 0.55)";

function SymbolMoon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <path
        d="M40 36 A 17 17 0 1 1 22 12 A 12.5 12.5 0 0 0 40 36 Z"
        fill={BRASS}
      />
    </svg>
  );
}

function SymbolSun() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <circle cx="28" cy="28" r="8.5" fill={BRASS} />
      {/* 8 rays */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = (28 + Math.cos(a) * 13).toFixed(2);
        const y1 = (28 + Math.sin(a) * 13).toFixed(2);
        const x2 = (28 + Math.cos(a) * 22).toFixed(2);
        const y2 = (28 + Math.sin(a) * 22).toFixed(2);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={BRASS}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
      {/* 8 small ray dots between */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = ((i + 0.5) * Math.PI) / 4;
        const cx = (28 + Math.cos(a) * 19).toFixed(2);
        const cy = (28 + Math.sin(a) * 19).toFixed(2);
        return <circle key={i} cx={cx} cy={cy} r="1" fill={BRASS_DIM} />;
      })}
    </svg>
  );
}

function SymbolStar() {
  // 8-point compass star: two overlapping rotated diamonds.
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <path
        d="M28 4 L 33 23 L 52 28 L 33 33 L 28 52 L 23 33 L 4 28 L 23 23 Z"
        fill={BRASS}
      />
      <path
        d="M14 14 L 28 22 L 42 14 L 34 28 L 42 42 L 28 34 L 14 42 L 22 28 Z"
        fill={BRASS_DIM}
      />
      <circle cx="28" cy="28" r="2.2" fill="#0d1611" />
    </svg>
  );
}

function SymbolEye() {
  return (
    <svg width="60" height="40" viewBox="0 0 60 40" aria-hidden>
      {/* eye outline (almond) */}
      <path
        d="M2 20 Q 30 -2, 58 20 Q 30 42, 2 20 Z"
        fill="none"
        stroke={BRASS}
        strokeWidth="1.4"
      />
      {/* iris */}
      <circle cx="30" cy="20" r="9" fill={BRASS} />
      {/* pupil */}
      <circle cx="30" cy="20" r="3.5" fill="#0d1611" />
      {/* a small light highlight */}
      <circle cx="32" cy="17.5" r="1.1" fill="rgba(232, 230, 210, 0.9)" />
      {/* tiny lashes / sparkle dots */}
      <circle cx="6" cy="20" r="0.9" fill={BRASS_DIM} />
      <circle cx="54" cy="20" r="0.9" fill={BRASS_DIM} />
    </svg>
  );
}

function SymbolHand() {
  // Stylized palmistry hand: palm shape + 5 finger pads.
  return (
    <svg width="48" height="60" viewBox="0 0 48 60" aria-hidden>
      {/* palm */}
      <path
        d="M14 58
           Q 8 50, 8 38
           Q 8 26, 14 22
           L 14 12
           Q 14 7, 18 7
           Q 22 7, 22 12
           L 22 22
           Q 24 22, 24 24
           L 24 8
           Q 24 3, 28 3
           Q 32 3, 32 8
           L 32 24
           Q 34 24, 34 26
           L 34 12
           Q 34 7, 38 7
           Q 42 7, 42 12
           L 42 32
           Q 42 50, 36 58 Z"
        fill={BRASS}
      />
      {/* center palm line / "fate line" */}
      <path
        d="M24 30 Q 26 40, 25 52"
        stroke="rgba(13, 22, 17, 0.5)"
        strokeWidth="0.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* a tiny star in the palm */}
      <path
        d="M28 38 L 28.7 40 L 30.5 40.3 L 29 41.5 L 29.4 43.4 L 28 42.3 L 26.6 43.4 L 27 41.5 L 25.5 40.3 L 27.3 40 Z"
        fill="rgba(13, 22, 17, 0.5)"
      />
    </svg>
  );
}

function FrontCard({ relic }) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <Image
          src={relic.image}
          alt={relic.name}
          fill
          className="object-cover"
          sizes="280px"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 50%, rgba(13, 22, 17, 0.95) 100%)",
          }}
        />
        <div
          className="absolute pointer-events-none animate-glow"
          aria-hidden
          style={{
            width: "60%",
            height: "60%",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(111,198,200,0.32) 0%, rgba(63,143,145,0) 70%)",
            mixBlendMode: "screen",
          }}
        />
      </div>
      <div className="px-2 sm:px-3 py-3 text-center">
        <p className="font-chancery text-cream text-[18px] sm:text-[20px] leading-tight">
          {relic.name}
        </p>
        <p className="text-[10px] sm:text-[10px] uppercase tracking-[0.18em] text-brass-light mt-1">
          <span className="font-chancery normal-case tracking-normal text-[15px] text-labradorite-light">${relic.price}</span> · One of One
        </p>
        <a
          href={links.depop}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            trackDepopClick(relic.id);
          }}
          className="inline-block mt-2 text-[10px] sm:text-[10px] uppercase tracking-[0.18em] text-labradorite-light hover:text-labradorite-glow"
        >
          Claim →
        </a>
      </div>
    </div>
  );
}

function SparkleMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path
        d="M5 0 L 6 4 L 10 5 L 6 6 L 5 10 L 4 6 L 0 5 L 4 4 Z"
        fill="rgba(181, 154, 104, 0.7)"
      />
    </svg>
  );
}
