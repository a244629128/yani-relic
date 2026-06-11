// scripts/seed-products.mjs
//
// One-time migration: copies the static products into Supabase.
// Idempotent — re-runs safely via upsert(onConflict: 'id').
//
// Run with:  npm run seed
//
// IMPORTANT: this script uses the SNAPSHOT data below, not data/products.js,
// so it remains runnable even after data/products.js is cleaned up later.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error(
    "Missing env vars. Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const sb = createClient(url, service, { auth: { persistSession: false } });

// === Snapshot of the 8 starter products (matches data/products.js) ===
const SEED = [
  {
    id: "r-01",
    name: "First Frost",
    price: 68,
    description:
      "A pale labradorite, wrapped in antique brass wire. Flashes a pale teal under candlelight — like breath on a cold window.",
    field_note: "Found her flash by the kitchen window on a rainy Tuesday.",
    cord_type: "Waxed cotton cord, adjustable to 24in",
    aspect_ratio: 0.75,
    sold: false,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
    ],
    video: null,
  },
  {
    id: "r-02",
    name: "Moss Heart",
    price: 74,
    description:
      "Deep green-blue with a wide blue flash. Wrapped tight, knotted twice, kept close.",
    field_note: "Wrapped this one twice. Felt like a heart that needed holding.",
    cord_type: "Antique brass chain, 18in + 2in extender",
    aspect_ratio: 1.25,
    sold: false,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80",
    ],
    video: {
      src: "/relics/sample-spin.mp4",
      poster:
        "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
    },
  },
  {
    id: "r-03",
    name: "Owl Hour",
    price: 82,
    description:
      "Almost black until you tilt it — then a slow blue river runs through. For late-night writers.",
    field_note: "Made between 11pm and 1am. The stone wanted that hour.",
    cord_type: "Waxed cotton cord, adjustable to 26in",
    aspect_ratio: 0.9,
    sold: false,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
    ],
    video: null,
  },
  {
    id: "r-04",
    name: "Quiet Spell",
    price: 64,
    description:
      "Small, palm-warm, with a single teal flash that comes and goes like a thought you almost remember.",
    field_note: "She fit in the hollow of my hand. That's how I knew.",
    cord_type: "Black cotton cord, knotted to 22in",
    aspect_ratio: 1.1,
    sold: true,
    featured: false,
    images: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
    ],
    video: null,
  },
  {
    id: "r-05",
    name: "Fern & Lichen",
    price: 78,
    description:
      "Wrapped with a small fern motif at the bail. Green-gold flash, soft and forest-floor.",
    field_note: "Tucked a pressed fern into the box. Don't tell anyone.",
    cord_type: "Hand-twisted hemp, 20in",
    aspect_ratio: 0.8,
    sold: false,
    featured: true,
    images: [
      "https://images.unsplash.com/photo-1518228684816-9135c15ab4ea?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
    ],
    video: null,
  },
  {
    id: "r-06",
    name: "River Sister",
    price: 70,
    description:
      "Pebble-smooth, river-shaped. Holds a sliver of cold blue under sunlight.",
    field_note: "Sister stone to a piece I kept. She'll find her person.",
    cord_type: "Waxed linen cord, adjustable to 24in",
    aspect_ratio: 1.0,
    sold: false,
    featured: false,
    images: [
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80",
    ],
    video: null,
  },
  {
    id: "r-07",
    name: "Old Lantern",
    price: 88,
    description:
      "A larger piece with a warm gold rim. Flashes amber-teal under candle. Heavy in a comforting way.",
    field_note: "Lit a beeswax candle while I wrapped this. Twice.",
    cord_type: "Antique brass chain, 20in",
    aspect_ratio: 1.35,
    sold: false,
    featured: false,
    images: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
    ],
    video: null,
  },
  {
    id: "r-08",
    name: "Hush",
    price: 60,
    description:
      "The smallest piece this season. A finger-tip flash. For carrying close.",
    field_note: "For the people who whisper instead of speak.",
    cord_type: "Fine cotton cord, knotted to 18in",
    aspect_ratio: 0.7,
    sold: false,
    featured: false,
    images: [
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=80",
    ],
    video: null,
  },
];

async function ensureBucket() {
  const BUCKET = "relics";
  const { data: list, error: listErr } = await sb.storage.listBuckets();
  if (listErr) {
    console.error("listBuckets error:", listErr);
    process.exit(1);
  }
  if (list.find((b) => b.name === BUCKET)) {
    console.log(`✓ Storage bucket "${BUCKET}" already exists`);
    return;
  }
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ],
  });
  if (error) {
    console.error("createBucket error:", error);
    process.exit(1);
  }
  console.log(`✓ Created storage bucket "${BUCKET}" (public read access)`);
}

async function main() {
  await ensureBucket();

  console.log(`Seeding ${SEED.length} products into Supabase...`);
  const { data, error } = await sb
    .from("products")
    .upsert(SEED, { onConflict: "id" })
    .select();
  if (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
  console.log(`Done. Upserted ${data.length} rows:`);
  data.forEach((r) =>
    console.log(
      `  - ${r.id}: ${r.name} ($${r.price})${r.sold ? " · SOLD" : ""}${
        r.featured ? " · FEATURED" : ""
      }`
    )
  );
}

main();
