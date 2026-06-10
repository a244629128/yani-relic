// Sample relic catalog.
//
// === HOW TO ADD YOUR OWN PHOTOS + VIDEOS ===
//
// 1. Drop files into  /public/relics/   (e.g. /public/relics/first-frost-1.jpg,
//    /public/relics/first-frost-spin.mp4).
//    Photos:
//      - 3 to 5 per piece (hero, side, in-hand, detail close-up, on-model).
//      - Square or 4:5 portrait, 1200-1600px long edge, JPG or WebP.
//    Videos:
//      - Optional. MP4 (H.264), under ~5MB, 720p max, muted (no audio needed —
//        videos in the gallery autoplay muted and loop).
//      - Provide a `poster` image so the card preview and thumbnail strip
//        show a still frame instead of a black box.
//      - To compress with ffmpeg:
//          ffmpeg -i in.mov -vf scale=-2:720 -crf 28 -an -movflags +faststart out.mp4
//
// 2. Update the `media` array on each product. Each item is either:
//        { type: "image", src: "/relics/first-frost-1.jpg" }
//        { type: "video", src: "/relics/first-frost-spin.mp4",
//          poster: "/relics/first-frost-1.jpg" }
//    The first item is used for the product card preview.
//
// 3. If you only want images, you can keep using the simpler `images: string[]`
//    field. It auto-converts to `media` below.
//
// 4. Local /public paths work without any next.config change. For remote URLs
//    (Cloudinary, S3, etc.), add the hostname to next.config.mjs ->
//    images.remotePatterns.

export const products = [
  {
    id: "r-01",
    name: "First Frost",
    price: 68,
    currency: "USD",
    stone: "Labradorite",
    description:
      "A pale labradorite, wrapped in antique brass wire. Flashes a pale teal under candlelight — like breath on a cold window.",
    fieldNote: "Found her flash by the kitchen window on a rainy Tuesday.",
    images: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
    ],
    aspectRatio: 0.75,
    cordType: "Waxed cotton cord, adjustable to 24in",
    sold: false,
    featured: true,
  },
  {
    id: "r-02",
    name: "Moss Heart",
    price: 74,
    currency: "USD",
    stone: "Labradorite",
    description:
      "Deep green-blue with a wide blue flash. Wrapped tight, knotted twice, kept close.",
    fieldNote: "Wrapped this one twice. Felt like a heart that needed holding.",
    // Mixed images + a video. Replace /relics/sample-spin.mp4 with your own clip
    // (e.g. a short 360° spin or wrapping-by-hand close-up).
    media: [
      { type: "image", src: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=80" },
      { type: "video",
        src: "/relics/sample-spin.mp4",
        poster: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80" },
      { type: "image", src: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80" },
      { type: "image", src: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80" },
      { type: "image", src: "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80" },
    ],
    aspectRatio: 1.25,
    cordType: "Antique brass chain, 18in + 2in extender",
    sold: false,
    featured: true,
  },
  {
    id: "r-03",
    name: "Owl Hour",
    price: 82,
    currency: "USD",
    stone: "Labradorite",
    description:
      "Almost black until you tilt it — then a slow blue river runs through. For late-night writers.",
    fieldNote: "Made between 11pm and 1am. The stone wanted that hour.",
    images: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
    ],
    aspectRatio: 0.9,
    cordType: "Waxed cotton cord, adjustable to 26in",
    sold: false,
    featured: true,
  },
  {
    id: "r-04",
    name: "Quiet Spell",
    price: 64,
    currency: "USD",
    stone: "Labradorite",
    description:
      "Small, palm-warm, with a single teal flash that comes and goes like a thought you almost remember.",
    fieldNote: "She fit in the hollow of my hand. That's how I knew.",
    images: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
    ],
    aspectRatio: 1.1,
    cordType: "Black cotton cord, knotted to 22in",
    sold: true,
    featured: false,
  },
  {
    id: "r-05",
    name: "Fern & Lichen",
    price: 78,
    currency: "USD",
    stone: "Labradorite",
    description:
      "Wrapped with a small fern motif at the bail. Green-gold flash, soft and forest-floor.",
    fieldNote: "Tucked a pressed fern into the box. Don't tell anyone.",
    images: [
      "https://images.unsplash.com/photo-1518228684816-9135c15ab4ea?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
    ],
    aspectRatio: 0.8,
    cordType: "Hand-twisted hemp, 20in",
    sold: false,
    featured: true,
  },
  {
    id: "r-06",
    name: "River Sister",
    price: 70,
    currency: "USD",
    stone: "Labradorite",
    description:
      "Pebble-smooth, river-shaped. Holds a sliver of cold blue under sunlight.",
    fieldNote: "Sister stone to a piece I kept. She'll find her person.",
    images: [
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80",
    ],
    aspectRatio: 1.0,
    cordType: "Waxed linen cord, adjustable to 24in",
    sold: false,
    featured: false,
  },
  {
    id: "r-07",
    name: "Old Lantern",
    price: 88,
    currency: "USD",
    stone: "Labradorite",
    description:
      "A larger piece with a warm gold rim. Flashes amber-teal under candle. Heavy in a comforting way.",
    fieldNote: "Lit a beeswax candle while I wrapped this. Twice.",
    images: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
    ],
    aspectRatio: 1.35,
    cordType: "Antique brass chain, 20in",
    sold: false,
    featured: false,
  },
  {
    id: "r-08",
    name: "Hush",
    price: 60,
    currency: "USD",
    stone: "Labradorite",
    description:
      "The smallest piece this season. A finger-tip flash. For carrying close.",
    fieldNote: "For the people who whisper instead of speak.",
    images: [
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=80",
    ],
    aspectRatio: 0.7,
    cordType: "Fine cotton cord, knotted to 18in",
    sold: false,
    featured: false,
  },
];

// Derive `media`, `images`, and `image` so consumers can read whichever they want:
//   - `media` (canonical): array of { type, src, poster? } — used by the gallery.
//   - `images`: image-only URLs — used by code that doesn't care about videos.
//   - `image`: single hero — used by product cards and the flip deck.
products.forEach((p) => {
  if (!p.media) {
    p.media = (p.images || [p.image]).map((src) => ({ type: "image", src }));
  }
  if (!p.images || p.images.length === 0) {
    p.images = p.media.filter((m) => m.type === "image").map((m) => m.src);
  }
  if (!p.image) {
    // First image we can find — prefer media[0] if it's an image, then media[0].poster, then images[0]
    const m0 = p.media[0];
    p.image =
      (m0 && m0.type === "image" && m0.src) ||
      (m0 && m0.poster) ||
      p.images[0];
  }
});

export const featuredProducts = products.filter((p) => p.featured);

export const links = {
  depop: "https://www.depop.com/yanirelics",
  tiktok: "https://www.tiktok.com/@yanirelics",
  instagram: "https://www.instagram.com/yanirelics",
  email: "hello@yanirelics.com",
};
