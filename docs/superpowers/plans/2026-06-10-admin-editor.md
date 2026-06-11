# Admin Product Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a password-protected admin UI at `/admin` for creating, editing, and deleting Yani Relics products, with data persisted in Supabase Postgres and the public site reading via on-demand-revalidated server caches. Implements the spec at `docs/superpowers/specs/2026-06-10-admin-editor-design.md`.

**Architecture:** 22 tasks across 5 phases. Phase 1 sets up Supabase + seeds existing products. Phase 2 switches the public site to read from Supabase (no admin yet — site keeps working). Phase 3 builds the auth foundation. Phase 4 builds the admin UI. Phase 5 deploys + verifies end-to-end. The site stays functional at every step.

**Tech Stack:** Next.js 15.5.19 (App Router), React 18.3.1, Tailwind v4, Supabase Postgres (free tier), `@supabase/supabase-js`, Web Crypto API (HMAC), Server Actions, `unstable_cache` + `revalidateTag`.

---

## File Structure

| File | New? | Responsibility |
|---|---|---|
| `lib/supabase.js` | **NEW** | `createServerSupabase()` + `createAdminSupabase()` factory functions |
| `lib/products-db.js` | **NEW** | `getProducts()`, `getProduct(id)`, `getFeaturedProducts()` (cached reads) + Server Actions `saveProduct()`, `deleteProduct()` |
| `lib/auth.js` | **NEW** | `signSession()`, `verifySession()`, `getSession()` for admin cookie auth |
| `scripts/supabase-schema.sql` | **NEW** | `CREATE TABLE products` + RLS policies (run once in Supabase SQL editor) |
| `scripts/seed-products.mjs` | **NEW** | One-time migration from `data/products.js` → Supabase |
| `middleware.js` | **NEW** | Protect `/admin/*` (allow `/admin/login`) |
| `app/api/admin/login/route.js` | **NEW** | POST password → set cookie |
| `app/api/admin/logout/route.js` | **NEW** | Clear cookie |
| `app/admin/login/page.js` | **NEW** | Login form (public) |
| `app/admin/layout.js` | **NEW** | Admin chrome (header + sign-out) |
| `app/admin/page.js` | **NEW** | List view of all products |
| `app/admin/new/page.js` | **NEW** | Create form |
| `app/admin/[id]/page.js` | **NEW** | Edit form |
| `app/admin/_components/ProductForm.js` | **NEW** | Shared form for new + edit |
| `app/admin/_components/ImageList.js` | **NEW** | Dynamic image-path list |
| `app/admin/_components/VideoFields.js` | **NEW** | Video src + poster inputs |
| `app/admin/_components/DeleteButton.js` | **NEW** | Confirm-by-typing-name delete dialog |
| `app/admin/_components/Toast.js` | **NEW** | In-page toast for save feedback |
| `app/page.js` | edit | Switch `import products` → `await getProducts()` |
| `app/shop/page.js` | edit | Same |
| `components/RelicFlipDeck.js` | edit | Accept `products` as prop instead of importing |
| `data/products.js` | edit | Keep only `links` + `BLUR_DATA_URL`; drop products array |
| `package.json` | edit | Add `@supabase/supabase-js` dependency |
| `.env.local` | edit | Add 5 env vars |

**Env vars** (also added to Vercel project settings):
- `NEXT_PUBLIC_SUPABASE_URL` — public, browser-safe
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, RLS-protected
- `SUPABASE_SERVICE_ROLE_KEY` — **server only — never exposed to browser**
- `ADMIN_PASSWORD` — single admin password
- `ADMIN_SESSION_SECRET` — 32+ char random string for HMAC

---

# PHASE 1 — Database foundation (Tasks 1-5)

## Task 1: Set up Supabase project + add env vars

**Files:**
- Modify: `.env.local` (create if doesn't exist)
- Manual: Vercel project env settings (web UI)

- [ ] **Step 1: User creates Supabase project**

Instructions (user runs these — not code):

1. Go to https://supabase.com and sign up / log in (free, no card)
2. Click "New project". Name: `yani-relic-prod`. Database password: generate + save securely. Region: closest to your audience (e.g. East US / N. Virginia for North America).
3. Wait ~2 minutes for provisioning.
4. Once ready, go to Project Settings → API. Copy these three values:
   - `Project URL` (e.g. `https://abc.supabase.co`)
   - `anon` `public` key (long JWT string)
   - `service_role` `secret` key (long JWT string — DO NOT share)

Pause here until those values are in hand.

- [ ] **Step 2: Add env vars to .env.local**

Create or append to `.env.local` (this file is git-ignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key>
ADMIN_PASSWORD=<choose a strong password>
ADMIN_SESSION_SECRET=<paste a 32+ char random string>
```

To generate the secret, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 3: Add same 5 env vars to Vercel project**

Manual web UI step:
1. Open https://vercel.com/dashboard → `yani-relic` → Settings → Environment Variables
2. Add each of the 5 vars above, set environment to "Production, Preview, Development"
3. Save

- [ ] **Step 4: Install Supabase client**

Run:
```bash
npm install @supabase/supabase-js
```

Expected: package added to package.json, dependency installed.

- [ ] **Step 5: Verify .env.local is not tracked**

Run:
```bash
git check-ignore .env.local && echo "OK: .env.local is git-ignored" || echo "WARNING: .env.local would be tracked"
```

Expected: `OK: .env.local is git-ignored`. If WARNING, add `.env.local` to `.gitignore`.

- [ ] **Step 6: Commit the package.json change only**

```bash
git add package.json package-lock.json
git commit -m "Install @supabase/supabase-js (admin editor foundation)"
```

---

## Task 2: Create Supabase client lib

**Files:**
- Create: `lib/supabase.js`

- [ ] **Step 1: Create lib/supabase.js**

```js
// lib/supabase.js
//
// Two clients:
//   - createServerSupabase() — uses anon key, RLS-enforced, for public reads
//     (also fine for admin reads since RLS allows public SELECT on products).
//   - createAdminSupabase() — uses SERVICE ROLE key, bypasses RLS. Use ONLY in
//     Server Actions / API routes. Never import this into a client component.

import { createClient } from "@supabase/supabase-js";

export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}

export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, service, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 2: Verify import resolves**

Run:
```bash
node -e "import('@/lib/supabase').then(m => console.log(Object.keys(m)))" 2>&1 || \
  node --experimental-vm-modules -e "import('./lib/supabase.js').then(m => console.log(Object.keys(m)))"
```

(The first form uses Next's @ alias — may not work in plain Node. The second form is a fallback.)

Expected: `[ 'createServerSupabase', 'createAdminSupabase' ]`

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.js
git commit -m "Add Supabase client factories (server + admin)"
```

---

## Task 3: Create + run Supabase schema

**Files:**
- Create: `scripts/supabase-schema.sql`
- Manual: paste into Supabase SQL editor + run

- [ ] **Step 1: Create the SQL file**

```sql
-- scripts/supabase-schema.sql
-- Run once in Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).

-- Products table
create table if not exists products (
  id            text primary key,
  name          text not null,
  price         numeric(10, 2) not null,
  currency      text not null default 'USD',
  stone         text not null default 'Labradorite',
  description   text not null,
  field_note    text,
  cord_type     text,
  aspect_ratio  numeric(4, 2) default 1.0,
  sold          boolean not null default false,
  featured      boolean not null default false,
  images        text[] not null default '{}',
  video         jsonb default null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at on every UPDATE
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- Row Level Security
alter table products enable row level security;

-- Public can read all products
drop policy if exists "Public can read products" on products;
create policy "Public can read products"
  on products for select
  to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated.
-- Only the service role (which bypasses RLS) can write.
```

- [ ] **Step 2: Run it in Supabase**

Manual:
1. Open Supabase dashboard → your project → SQL Editor → "New query"
2. Paste the entire contents of `scripts/supabase-schema.sql`
3. Click "Run"
4. Expect "Success. No rows returned." or similar

- [ ] **Step 3: Verify the table exists**

In Supabase dashboard → Table Editor → confirm `products` table is listed with the columns above.

OR via SQL editor:
```sql
select column_name, data_type from information_schema.columns where table_name = 'products';
```
Expected: 14 rows (id, name, price, currency, stone, description, field_note, cord_type, aspect_ratio, sold, featured, images, video, created_at, updated_at).

- [ ] **Step 4: Commit**

```bash
git add scripts/supabase-schema.sql
git commit -m "Add Supabase schema for products table (with RLS policies)"
```

---

## Task 4: Create + run seed script

**Files:**
- Create: `scripts/seed-products.mjs`
- Modify: `package.json` (add seed script)

- [ ] **Step 1: Create the seed script**

```js
// scripts/seed-products.mjs
//
// One-time migration: copies products from data/products.js into Supabase.
// Idempotent — re-runs safely via upsert(onConflict: 'id').
// Run with:  node scripts/seed-products.mjs

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { products } from "../data/products.js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Missing env vars. Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, service, { auth: { persistSession: false } });

// Convert in-code product shape → DB row shape
function toRow(p) {
  // Pull video out of media if present
  const videoMedia = (p.media || []).find((m) => m.type === "video");
  const video = videoMedia
    ? { src: videoMedia.src, poster: videoMedia.poster || p.images?.[0] || null }
    : null;

  return {
    id: p.id,
    name: p.name,
    price: p.price,
    currency: p.currency || "USD",
    stone: p.stone || "Labradorite",
    description: p.description,
    field_note: p.fieldNote || null,
    cord_type: p.cordType || null,
    aspect_ratio: p.aspectRatio || 1.0,
    sold: !!p.sold,
    featured: !!p.featured,
    images: p.images || [p.image].filter(Boolean),
    video,
  };
}

async function main() {
  const rows = products.map(toRow);
  console.log(`Seeding ${rows.length} products...`);
  const { data, error } = await sb.from("products").upsert(rows, { onConflict: "id" }).select();
  if (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
  console.log(`Done. Upserted ${data.length} rows.`);
  data.forEach((r) => console.log(`  - ${r.id}: ${r.name} ($${r.price})${r.sold ? " · SOLD" : ""}${r.featured ? " · FEATURED" : ""}`));
}

main();
```

- [ ] **Step 2: Install dotenv (script-only dep)**

Run:
```bash
npm install --save-dev dotenv
```

- [ ] **Step 3: Add seed script to package.json**

Find `"scripts": { ... }` in `package.json` and add:

```json
"seed": "node scripts/seed-products.mjs"
```

Final scripts section should look like:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "seed": "node scripts/seed-products.mjs"
}
```

- [ ] **Step 4: Run the seed**

```bash
npm run seed
```

Expected output:
```
Seeding 8 products...
Done. Upserted 8 rows.
  - r-01: First Frost ($68) · FEATURED
  - r-02: Moss Heart ($74) · FEATURED
  - r-03: Owl Hour ($82) · FEATURED
  - r-04: Quiet Spell ($64) · SOLD
  - r-05: Fern & Lichen ($78) · FEATURED
  - r-06: River Sister ($70)
  - r-07: Old Lantern ($88)
  - r-08: Hush ($60)
```

- [ ] **Step 5: Verify in Supabase**

In Supabase dashboard → Table Editor → `products` → confirm 8 rows visible with correct names + prices.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-products.mjs package.json package-lock.json
git commit -m "Add product seed script (one-time migration to Supabase)"
```

---

## Task 5: Create products-db.js (read-only methods)

**Files:**
- Create: `lib/products-db.js`

- [ ] **Step 1: Create the read functions**

```js
// lib/products-db.js
//
// Public-side read access to the products table. Wrapped in unstable_cache with
// tag "products" so we can invalidate on admin writes via revalidateTag.

import { unstable_cache, revalidateTag } from "next/cache";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase";

// Convert DB row → JS shape that the rest of the codebase expects.
// Builds the legacy `media` array: hero image first, then video, then remaining images.
function rowToProduct(row) {
  const images = row.images || [];
  const media = [];
  if (images.length > 0) media.push({ type: "image", src: images[0] });
  if (row.video && row.video.src) {
    media.push({
      type: "video",
      src: row.video.src,
      poster: row.video.poster || images[0] || null,
    });
  }
  for (let i = 1; i < images.length; i++) {
    media.push({ type: "image", src: images[i] });
  }
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    currency: row.currency,
    stone: row.stone,
    description: row.description,
    fieldNote: row.field_note || "",
    cordType: row.cord_type || "",
    aspectRatio: Number(row.aspect_ratio) || 1.0,
    sold: row.sold,
    featured: row.featured,
    images,
    video: row.video,
    media,
    image: images[0] || null,
  };
}

export const getProducts = unstable_cache(
  async () => {
    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getProducts error:", error);
      return [];
    }
    return (data || []).map(rowToProduct);
  },
  ["products-all"],
  { tags: ["products"] }
);

export async function getProduct(id) {
  // Not unstable_cache'd because we usually want fresh in admin context too.
  // For public detail-by-id (rare path), we can layer caching later if needed.
  const sb = createServerSupabase();
  const { data, error } = await sb.from("products").select("*").eq("id", id).single();
  if (error || !data) return null;
  return rowToProduct(data);
}

export async function getFeaturedProducts() {
  const all = await getProducts();
  return all.filter((p) => p.featured);
}

// === Write helpers used by Server Actions (added in a later task) ===
// Server Actions live alongside these so revalidateTag fires from one place.
export function productToRow(p) {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    currency: p.currency || "USD",
    stone: p.stone || "Labradorite",
    description: p.description,
    field_note: p.fieldNote || null,
    cord_type: p.cordType || null,
    aspect_ratio: Number(p.aspectRatio) || 1.0,
    sold: !!p.sold,
    featured: !!p.featured,
    images: Array.isArray(p.images) ? p.images : [],
    video: p.video && p.video.src ? { src: p.video.src, poster: p.video.poster || null } : null,
  };
}

export function bustProductCache() {
  revalidateTag("products");
}
```

- [ ] **Step 2: Quick smoke test via dev server**

Make sure dev server is running on port 3939 (it should still be from earlier work). If not:
```bash
PORT=3939 npm run dev
```

- [ ] **Step 3: Test by creating a temporary debug route**

Create `app/api/debug/products/route.js`:
```js
import { getProducts } from "@/lib/products-db";
export async function GET() {
  const products = await getProducts();
  return Response.json({ count: products.length, ids: products.map(p => p.id) });
}
```

Curl it:
```bash
curl -s http://localhost:3939/api/debug/products
```

Expected: `{"count":8,"ids":["r-08","r-07","r-06","r-05","r-04","r-03","r-02","r-01"]}` (or similar — order may differ if seed ran in a different order)

- [ ] **Step 4: Delete the debug route**

```bash
rm -rf app/api/debug
```

- [ ] **Step 5: Commit**

```bash
git add lib/products-db.js
git commit -m "Add lib/products-db.js with cached getProducts / getProduct / getFeaturedProducts"
```

---

# PHASE 2 — Switch public reads (Tasks 6-10)

## Task 6: Switch `app/page.js` to async getProducts

**Files:**
- Modify: `app/page.js`

- [ ] **Step 1: Read the current page.js**

Quick check — it currently imports the static `products` array indirectly (only for the flip deck). Confirm:
```bash
grep -n "from \"@/data/products\"" app/page.js
```

- [ ] **Step 2: Make page async and pass products to RelicFlipDeck**

Replace `app/page.js` with:

```jsx
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeatureCardsRow from "@/components/FeatureCardsRow";
import RelicFlipDeck from "@/components/RelicFlipDeck";
import Sparkles from "@/components/decor/Sparkles";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";
import { links } from "@/data/products";
import { getProducts } from "@/lib/products-db";

export default async function Home() {
  const products = await getProducts();

  return (
    <>
      <Header />
      <main className="flex-1 relative pb-24 md:pb-0">
        {/* === HERO === */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(circle at 50% 55%, rgba(63, 143, 145, 0.18), transparent 38%)," +
                "radial-gradient(circle at 50% 10%, rgba(216, 199, 170, 0.04), transparent 30%)," +
                "linear-gradient(180deg, #0d1611 0%, #101714 60%, #0d1611 100%)",
            }}
            aria-hidden
          />
          <Sparkles count={28} intensity="magical" />

          <div className="relative mx-auto max-w-5xl px-5 sm:px-8 pt-6 pb-10 md:pt-16 md:pb-20 flex flex-col items-center text-center min-h-[calc(100dvh-108px)] md:min-h-0 justify-center">
            <h1
              className="font-chancery text-parchment"
              style={{
                fontSize: "clamp(54px, 12vw, 132px)",
                fontWeight: 400,
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              <span className="block">Yani</span>
              <span className="block">Relics</span>
            </h1>

            <MoonPhaseDivider className="my-5 sm:my-8 max-w-[200px]" />

            <p
              className="font-serif text-cream/85 max-w-md mb-7 sm:mb-10"
              style={{ fontSize: "clamp(15px, 1.3vw, 18px)", lineHeight: 1.45 }}
            >
              Handmade labradorite relics
              <br /> for soft witches and moonlit souls.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center">
              <Link href="/shop" className="btn-relic">
                View Relics
              </Link>
              <a
                href={links.depop}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-relic-link"
              >
                Shop on Depop →
              </a>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-5xl px-5 sm:px-8 py-10 md:py-20">
          <RelicFlipDeck accent="gold" products={products} />
        </section>

        <section className="relative mx-auto max-w-7xl px-5 sm:px-8 py-10 md:py-20">
          <FeatureCardsRow variant="tall" />
        </section>
      </main>
      <Footer />
    </>
  );
}
```

The only changes vs. before:
- Component is now `async`
- `const products = await getProducts()` at top
- `<RelicFlipDeck products={products} />` (prop-drilled)

- [ ] **Step 3: Verify the home page still renders**

```bash
curl -sI http://localhost:3939/ | head -3
curl -s http://localhost:3939/ | grep -o "Yani Relics" | head -3
```

Expected: `HTTP/1.1 200 OK` + 3 matches.

- [ ] **Step 4: Commit (do not commit RelicFlipDeck change yet — that's Task 8)**

Wait — the `RelicFlipDeck` doesn't yet accept a `products` prop. Step 3 above may show a runtime error in the browser. That's OK — we'll patch the deck in Task 8. For now, the page itself compiles + types are fine because RelicFlipDeck ignores unknown props.

Actually, to avoid breakage during these intermediate commits, defer this commit until Task 8 is also done, OR commit now and fix immediately in Task 8.

For simpler bisecting: commit this task now (page.js compiles & the SSR works because the flip deck will silently use its imported `products` until Task 8 updates that).

```bash
git add app/page.js
git commit -m "app/page.js: fetch products from Supabase (still passes static array to RelicFlipDeck)"
```

---

## Task 7: Switch `app/shop/page.js` to async getProducts

**Files:**
- Modify: `app/shop/page.js`

- [ ] **Step 1: Refactor shop page**

Read current shop page first to see its structure:
```bash
head -20 app/shop/page.js
```

The current page is a `"use client"` component that imports `{ products }` directly. We need to convert: server-component wrapper that fetches data, passes to a client component that handles state.

Replace `app/shop/page.js` with:

```jsx
import { Suspense } from "react";
import { getProducts } from "@/lib/products-db";
import ShopPageClient from "./ShopPageClient";

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <Suspense fallback={null}>
      <ShopPageClient products={products} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create the client component**

Create `app/shop/ShopPageClient.js`:

```jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import MoonPhaseDivider from "@/components/decor/MoonPhaseDivider";

export default function ShopPageClient({ products }) {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("all");
  const filterScrollY = useRef(0);
  const searchParams = useSearchParams();

  const available = products.filter((p) => !p.sold);
  const sold = products.filter((p) => p.sold);
  const list = filter === "available" ? available : filter === "sold" ? sold : products;

  useEffect(() => {
    const relicId = searchParams.get("relic");
    if (!relicId) return;
    const found = products.find((p) => p.id === relicId);
    if (found) setOpen(found);
  }, [searchParams, products]);

  const onFilterChange = (key) => {
    filterScrollY.current = window.scrollY;
    setFilter(key);
  };

  useEffect(() => {
    window.scrollTo(0, filterScrollY.current);
  }, [filter]);

  return (
    <>
      <Header />
      <main className="flex-1 pb-24 md:pb-0">
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-12 pb-6 md:pt-20">
          <p className="text-xs uppercase tracking-[0.22em] text-brass-light text-center mb-3">
            Relics
          </p>
          <h1 className="font-chancery text-5xl sm:text-7xl text-cream text-center mb-4">
            The shop, tonight.
          </h1>
          <p className="text-cream-dim text-center max-w-2xl mx-auto mb-8">
            Every piece is one-of-one. When she&apos;s found her person, she&apos;s gone for good. Tap any
            relic for her field notes.
          </p>
          <MoonPhaseDivider />

          <div className="flex justify-center gap-2 mt-6 mb-10">
            {[
              { key: "all", label: `All (${products.length})` },
              { key: "available", label: `Available (${available.length})` },
              { key: "sold", label: `Found Home (${sold.length})` },
            ].map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => onFilterChange(f.key)}
                  className={`text-xs uppercase tracking-[0.18em] px-4 py-2 rounded-full border transition-colors ${
                    active
                      ? "bg-labradorite text-cream border-labradorite"
                      : "border-brass/40 text-cream-dim hover:border-labradorite-light hover:text-labradorite-glow"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {list.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                variant="grid"
                animation="magical"
                onOpen={setOpen}
                index={i}
              />
            ))}
          </div>

          {list.length === 0 && (
            <p className="text-center text-cream-dim italic font-serif py-16">
              Nothing here in this view. Try another filter.
            </p>
          )}
        </section>

        <ProductDetail product={open} onClose={() => setOpen(null)} />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Verify /shop still works**

```bash
curl -sI http://localhost:3939/shop | head -3
```
Expected: `200 OK`.

Open in browser at mobile viewport — confirm all 8 products listed, filter chips work, click a product → modal opens with First Frost details.

- [ ] **Step 4: Commit**

```bash
git add app/shop/page.js app/shop/ShopPageClient.js
git commit -m "Shop page: fetch products server-side from Supabase, pass to client component"
```

---

## Task 8: Update RelicFlipDeck to accept products prop

**Files:**
- Modify: `components/RelicFlipDeck.js`

- [ ] **Step 1: Make `products` a prop**

Find this line in `components/RelicFlipDeck.js`:
```js
import { products, links, BLUR_DATA_URL } from "@/data/products";
```

Replace with:
```js
import { links, BLUR_DATA_URL } from "@/data/products";
```

And update the component signature. Find:
```jsx
export default function RelicFlipDeck({
  subtitle = "Choose a card and see which relic is calling to you.",
  accent = "gold",
}) {
```

Replace with:
```jsx
export default function RelicFlipDeck({
  subtitle = "Choose a card and see which relic is calling to you.",
  accent = "gold",
  products = [],
}) {
```

- [ ] **Step 2: Verify the deck reads from prop**

The `pickRandom` callback already uses the `products` identifier:
```js
const pickRandom = useCallback((excludeIds = []) => {
  const pool = products.filter((p) => !excludeIds.includes(p.id));
  ...
}, []);
```

It now references the prop instead of the imported array. **Important**: the `useCallback` dependency array is `[]` — that captures `products` from first render. Since `products` is a stable server-fetched array, this is fine. But to be safe, update the deps:

```js
const pickRandom = useCallback((excludeIds = []) => {
  const pool = products.filter((p) => !excludeIds.includes(p.id));
  const fromPool = pool.length > 0 ? pool : products;
  return fromPool[Math.floor(Math.random() * fromPool.length)];
}, [products]);
```

- [ ] **Step 3: Verify the deck still works**

Open the homepage in mobile viewport. The flip deck should still show 3 face-down cards (mobile size). Tap one — it should reveal a real product (random from the 8).

```bash
curl -s http://localhost:3939/ | grep -o "The Relic Chose You"
```
Expected: matches (at least 1).

- [ ] **Step 4: Commit**

```bash
git add components/RelicFlipDeck.js
git commit -m "RelicFlipDeck: accept products as a prop (Supabase-fetched)"
```

---

## Task 9: Clean up data/products.js

**Files:**
- Modify: `data/products.js`

- [ ] **Step 1: Reduce the file to just shared constants**

Replace the entire contents of `data/products.js` with:

```js
// data/products.js
//
// Product data now lives in Supabase — read via lib/products-db.js getProducts().
// This file keeps only the static brand constants that don't belong in the DB.

export const links = {
  depop: "https://www.depop.com/glitchydollhaus/",
  tiktok: "https://www.tiktok.com/@yanirelics",
  instagram: "https://www.instagram.com/yanirelics",
  email: "hello@yanirelics.com",
};

// Shared blur placeholder for all product images while they load.
// Tiny dark-forest gradient (~200 bytes).
export const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAGCAYAAAAaTw1eAAAAJklEQVR4nGNgYGBgcCsuM2BgYGCob6lnYGBgYGB4+/45IzMzMwMA8BMFmCgkM98AAAAASUVORK5CYII=";
```

- [ ] **Step 2: Verify the seed script can still run if needed**

Important: the seed script (`scripts/seed-products.mjs`) imports `{ products }` from `data/products.js`. After this task, that import will fail.

The seed only runs once (already ran in Task 4), so this is OK for production. But to keep the script runnable for re-seeding (e.g. fresh dev environment), we'll modify it to read its own snapshot. For now, just add a comment to the top of `scripts/seed-products.mjs`:

Edit `scripts/seed-products.mjs` first import line:
```js
// NOTE: data/products.js no longer exports `products` after Task 9. To re-run seed,
// restore the array temporarily OR run this BEFORE Task 9.
import { products } from "../data/products.js";
```

(Or move the seed to a frozen snapshot — not necessary for v1, just leave the comment.)

- [ ] **Step 3: Verify all routes still build**

```bash
curl -sI http://localhost:3939/ | head -1
curl -sI http://localhost:3939/shop | head -1
curl -sI http://localhost:3939/about | head -1
curl -sI http://localhost:3939/faq | head -1
curl -sI http://localhost:3939/contact | head -1
```
Expected: 5 × `HTTP/1.1 200 OK`.

- [ ] **Step 4: Commit**

```bash
git add data/products.js scripts/seed-products.mjs
git commit -m "Clean up data/products.js (products now live in Supabase, only shared constants remain)"
```

---

## Task 10: Deploy + verify Phase 2

**Files:** (no code changes)

- [ ] **Step 1: Push everything to origin**

```bash
git push origin main
```

- [ ] **Step 2: Wait for Vercel deploy + verify**

```bash
until curl -sI https://yani-relic.vercel.app/ 2>/dev/null | grep -q "200"; do sleep 5; done
curl -sI https://yani-relic.vercel.app/ | head -3
curl -s https://yani-relic.vercel.app/shop | grep -o "First Frost\|Moss Heart\|Owl Hour" | head -3
```
Expected: HTTP 200 + 3 relic names in shop HTML.

- [ ] **Step 3: Test a Supabase edit propagates to production**

Manual test:
1. In Supabase Table Editor → products → click on `r-01` (First Frost)
2. Change `price` from `68` to `72.50`
3. Save
4. (Cache will still serve $68 until revalidated — Phase 3+ adds proper revalidation. For now, the on-demand revalidation only fires on admin saves which we don't have yet. Force refresh: redeploy via Vercel CLI or wait until the cache TTL passes if any.)

For Phase 2 verification, we just need the initial deploy to read correctly. Real revalidation testing happens in Phase 4.

- [ ] **Step 4: Mark Phase 2 complete**

No commit needed — this task is verification only.

---

# PHASE 3 — Auth foundation (Tasks 11-14)

## Task 11: Create lib/auth.js (HMAC session tokens)

**Files:**
- Create: `lib/auth.js`

- [ ] **Step 1: Implement signing + verification using Web Crypto API**

```js
// lib/auth.js
//
// Signed session tokens for the admin cookie. Uses HMAC-SHA256 over a JSON
// payload (timestamp + nonce). Validates signature + expiry. No DB hit.

import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET missing or too short (need ≥32 chars)");
  }
  return secret;
}

async function hmac(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Buffer.from(sig).toString("base64url");
}

export async function signSession() {
  const payload = JSON.stringify({
    iat: Math.floor(Date.now() / 1000),
    nonce: Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString("base64url"),
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = await hmac(getSecret(), payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifySession(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = await hmac(getSecret(), payloadB64);
  // Constant-time compare via length + char-by-char
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    const age = Math.floor(Date.now() / 1000) - (payload.iat || 0);
    if (age > COOKIE_MAX_AGE_S || age < 0) return false;
    return true;
  } catch {
    return false;
  }
}

export async function setSessionCookie() {
  const token = await signSession();
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_S,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const valid = await verifySession(token);
  return valid ? { authenticated: true } : null;
}

// Re-exported for middleware (Edge runtime — uses plain `req.cookies`).
export const SESSION_COOKIE_NAME = COOKIE_NAME;
```

- [ ] **Step 2: Verify it signs + verifies correctly**

Create a temporary debug route `app/api/debug/auth/route.js`:
```js
import { signSession, verifySession } from "@/lib/auth";
export async function GET() {
  const token = await signSession();
  const valid = await verifySession(token);
  const fakeValid = await verifySession(token + "tampered");
  return Response.json({ token: token.slice(0, 20) + "...", valid, fakeValid });
}
```

Test:
```bash
curl -s http://localhost:3939/api/debug/auth
```
Expected: `{"token":"...","valid":true,"fakeValid":false}`.

- [ ] **Step 3: Delete the debug route**

```bash
rm -rf app/api/debug
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.js
git commit -m "Add lib/auth.js (HMAC-signed session cookies for admin)"
```

---

## Task 12: Create login + logout API routes

**Files:**
- Create: `app/api/admin/login/route.js`
- Create: `app/api/admin/logout/route.js`

- [ ] **Step 1: Create the login route**

```js
// app/api/admin/login/route.js
import { setSessionCookie } from "@/lib/auth";

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return Response.json({ error: "ADMIN_PASSWORD not configured" }, { status: 500 });
  }
  if (typeof password !== "string") {
    return Response.json({ error: "Password required" }, { status: 400 });
  }
  // Constant-time compare
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  await setSessionCookie();
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Create the logout route**

```js
// app/api/admin/logout/route.js
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Test login route**

```bash
# Wrong password
curl -s -X POST http://localhost:3939/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong"}'
```
Expected: `{"error":"Wrong password"}`

```bash
# Right password (replace <YOUR_PASS> with what you set in .env.local)
curl -s -X POST http://localhost:3939/api/admin/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$ADMIN_PASSWORD\"}" \
  -c /tmp/cookies.txt
```
Expected: `{"ok":true}`. The Set-Cookie header should include `admin_session=<token>; HttpOnly; SameSite=lax`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/login/route.js app/api/admin/logout/route.js
git commit -m "Add admin login + logout API routes (password → signed cookie)"
```

---

## Task 13: Create middleware to protect /admin/*

**Files:**
- Create: `middleware.js` (project root, not inside app/)

- [ ] **Step 1: Create middleware**

Edge runtime can't use Node's `Buffer.from` reliably for HMAC, and `lib/auth.js` uses Node Buffer for base64url encoding. Re-implement minimally for the Edge:

```js
// middleware.js — runs on every request to /admin/*
// Verifies the signed session cookie. Redirects to /admin/login if missing/invalid.

import { NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";

async function hmac(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  // base64url encode without Buffer
  let s = "";
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifySession(token, secret) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = await hmac(secret, payloadB64);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    // base64url decode payload
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const payload = JSON.parse(json);
    const age = Math.floor(Date.now() / 1000) - (payload.iat || 0);
    if (age > 60 * 60 * 24 * 30 || age < 0) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Only gate /admin paths (excluding /admin/login)
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    // Fail-closed if secret missing
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const valid = await verifySession(token, secret);
  if (!valid) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Restart dev server (middleware needs reload)**

```bash
lsof -ti:3939 | xargs kill -9 2>/dev/null
PORT=3939 npm run dev &
sleep 3
```

- [ ] **Step 3: Verify gating works**

```bash
# Without session cookie — should redirect (302 or 307)
curl -sI http://localhost:3939/admin | head -3
```
Expected: `HTTP/1.1 307 Temporary Redirect` + `Location: /admin/login`

```bash
# Login first
curl -s -X POST http://localhost:3939/api/admin/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$ADMIN_PASSWORD\"}" \
  -c /tmp/cookies.txt

# Then visit /admin with cookie
curl -sI -b /tmp/cookies.txt http://localhost:3939/admin | head -3
```
Expected: `404 Not Found` (because /admin page doesn't exist yet — Task 19) OR `200 OK` if Next renders an empty default. Either is OK — the point is no redirect.

- [ ] **Step 4: Commit**

```bash
git add middleware.js
git commit -m "Add middleware to gate /admin/* on signed session cookie"
```

---

## Task 14: Create /admin/login page

**Files:**
- Create: `app/admin/login/page.js`

- [ ] **Step 1: Create the login UI**

```jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Wrong password");
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-5">
      <form
        onSubmit={onSubmit}
        className={`w-full max-w-sm card-relic p-7 sm:p-10 ${shake ? "animate-shake" : ""}`}
      >
        <h1 className="font-chancery text-cream text-center" style={{ fontSize: 48, letterSpacing: "0.02em", lineHeight: 1 }}>
          Yani Relics
        </h1>
        <p className="text-center text-brass-light text-xs uppercase tracking-[0.22em] mt-2 mb-7">
          Vault
        </p>
        <label className="block text-cream-dim text-xs uppercase tracking-[0.18em] mb-2">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          className="w-full bg-forest/50 border border-parchment/35 rounded-[10px] px-4 py-3 text-cream focus:outline-none focus:border-labradorite-light"
        />
        {error && (
          <p className="text-red-300/80 text-sm mt-3 text-center">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-relic w-full mt-6 disabled:opacity-50"
        >
          {submitting ? "Opening..." : "Enter the Vault"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Add the shake keyframe to globals.css**

Append to `app/globals.css`:

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
.animate-shake { animation: shake 0.35s ease-in-out; }
```

- [ ] **Step 3: Test the page renders**

Open in browser: `http://localhost:3939/admin/login`. Should see the login form. Enter wrong password — shake + error. Enter right password — redirect to `/admin` (which will 404 for now — fixed in Task 19).

- [ ] **Step 4: Commit**

```bash
git add app/admin/login/page.js app/globals.css
git commit -m "Add /admin/login page (password form with shake-on-error)"
```

---

# PHASE 4 — Admin UI (Tasks 15-21)

## Task 15: Create admin layout (chrome + sign-out)

**Files:**
- Create: `app/admin/layout.js`

- [ ] **Step 1: Create the layout**

```jsx
// app/admin/layout.js
// Wraps all /admin/* routes (EXCEPT /admin/login which has its own layout via being a leaf).
// Adds a small admin header + sign-out button.

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Vault — Yani Relics" };

export default async function AdminLayout({ children }) {
  // Middleware already protects this, but extra check belt-and-braces.
  // /admin/login has its own client component and isn't nested under this server layout
  // (because we placed it under app/admin/login/page.js — Next.js routing rules: it shares this layout!).
  // To exempt the login route, we check the path in middleware (already done) AND skip
  // server checks here by using a try/redirect pattern. Since middleware redirects unauth
  // users to /admin/login, this code only runs when authed (or when path is /admin/login).

  // For simplicity, just verify session and let middleware handle redirects.
  const session = await getSession();
  if (!session) {
    // Belt-and-braces — middleware should have caught this
    redirect("/admin/login");
  }

  return (
    <div className="min-h-dvh flex flex-col bg-forest text-cream">
      <header className="sticky top-0 z-30 border-b border-parchment/15" style={{ background: "rgba(13, 22, 17, 0.92)", backdropFilter: "blur(10px)" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-chancery text-parchment text-2xl">
            Vault
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light">
              View site →
            </Link>
            <form action="/api/admin/logout" method="POST" onSubmit={(e) => {
              e.preventDefault();
              fetch("/api/admin/logout", { method: "POST" }).then(() => { window.location.href = "/admin/login"; });
            }}>
              <button type="submit" className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

**Note:** The form `onSubmit` uses inline JS in JSX which only works in client components. Since this layout is a server component, we need to extract the sign-out button to a tiny client component.

Replace the `<form>` block with a client component reference:

```jsx
import SignOutButton from "./_components/SignOutButton";
```

…and use `<SignOutButton />` in place of the inline form.

- [ ] **Step 2: Create the SignOutButton client component**

```jsx
// app/admin/_components/SignOutButton.js
"use client";

export default function SignOutButton() {
  const onClick = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };
  return (
    <button
      onClick={onClick}
      className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light"
    >
      Sign out
    </button>
  );
}
```

And the full updated `app/admin/layout.js`:

```jsx
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "./_components/SignOutButton";

export const metadata = { title: "Vault — Yani Relics" };

export default async function AdminLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-dvh flex flex-col bg-forest text-cream">
      <header className="sticky top-0 z-30 border-b border-parchment/15" style={{ background: "rgba(13, 22, 17, 0.92)", backdropFilter: "blur(10px)" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-chancery text-parchment text-2xl">
            Vault
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light">
              View site →
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

**Critical issue**: this admin layout will ALSO wrap `/admin/login` because of Next.js folder-based layouts. That's a problem — login page needs to be reachable without auth.

Fix: move `/admin/login` to its own route segment OUTSIDE the admin folder, OR use a route group `(unauth)` inside admin. Cleanest:

Move `app/admin/login/page.js` to `app/admin-login/page.js` (no shared layout). Update the middleware path to allow this.

Or — easier — wrap admin pages in a route group. Move:
- `app/admin/login/page.js` (no change to URL — stays `/admin/login`)
- Add a `app/admin/(authed)/` group and put `layout.js`, `page.js`, `new/page.js`, `[id]/page.js` inside it
- The layout file moves to `app/admin/(authed)/layout.js`
- The login page is OUTSIDE the group → doesn't share the layout

Final file structure:
```
app/admin/
  layout.js                ← optional, just metadata
  login/
    page.js                ← unauth, no shared layout
  (authed)/                ← route group, doesn't affect URL
    layout.js              ← authed layout, redirects if no session
    page.js                ← admin home
    new/page.js
    [id]/page.js
    _components/
      SignOutButton.js
      ...
```

Move the layout content from `app/admin/layout.js` to `app/admin/(authed)/layout.js`. Delete `app/admin/layout.js` (or make it a no-op metadata wrapper).

- [ ] **Step 3: Re-organize files**

```bash
mkdir -p "app/admin/(authed)/_components"
mv app/admin/_components/SignOutButton.js "app/admin/(authed)/_components/SignOutButton.js" 2>/dev/null || true
```

Save the layout from Step 2 to `app/admin/(authed)/layout.js`.

- [ ] **Step 4: Test that /admin/login still works**

```bash
curl -sI http://localhost:3939/admin/login | head -3
```
Expected: `200 OK` (no redirect, doesn't trigger the authed layout).

- [ ] **Step 5: Commit**

```bash
git add app/admin/
git commit -m "Add admin (authed) route group with shared layout + sign-out"
```

---

## Task 16: Add Server Actions for save + delete

**Files:**
- Modify: `lib/products-db.js`

- [ ] **Step 1: Append Server Actions to lib/products-db.js**

Add at the bottom of the existing file (after the helper functions):

```js
// ============================================================
// Server Actions — write side. Used by admin forms.
// ============================================================
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
}

export async function saveProduct(product) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const row = productToRow(product);

  // Server-side validation
  if (!row.id || !/^[a-z0-9-]{2,32}$/i.test(row.id)) {
    return { ok: false, error: "Invalid id (use lowercase letters, digits, dashes only)" };
  }
  if (!row.name?.trim()) return { ok: false, error: "Name is required" };
  if (!(row.price > 0)) return { ok: false, error: "Price must be greater than 0" };
  if (!row.description?.trim()) return { ok: false, error: "Description is required" };
  if (!Array.isArray(row.images) || row.images.length < 1) {
    return { ok: false, error: "At least 1 image is required" };
  }
  if (row.images.length > 8) {
    return { ok: false, error: "Maximum 8 images" };
  }

  const { data, error } = await sb
    .from("products")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("saveProduct error:", error);
    return { ok: false, error: error.message };
  }

  bustProductCache();
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath(`/admin/${row.id}`);
  revalidatePath("/admin");

  return { ok: true, product: data };
}

export async function deleteProduct(id) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) {
    console.error("deleteProduct error:", error);
    return { ok: false, error: error.message };
  }
  bustProductCache();
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin");
  return { ok: true };
}
```

**Wait — Server Actions need their own file separate from cached read functions, OR all top-level exports in the file must be "use server"-compatible.** Mixing `unstable_cache` and `"use server"` in the same file causes issues.

Refactor: keep reads in `lib/products-db.js`, move writes to `lib/products-actions.js`.

- [ ] **Step 2: Create lib/products-actions.js for writes**

Delete the Server Action block from `lib/products-db.js` (revert step 1).

Create `lib/products-actions.js`:

```js
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { productToRow } from "@/lib/products-db";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
}

export async function saveProduct(product) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const row = productToRow(product);

  if (!row.id || !/^[a-z0-9-]{2,32}$/i.test(row.id)) {
    return { ok: false, error: "Invalid id (use letters, digits, dashes — 2-32 chars)" };
  }
  if (!row.name?.trim()) return { ok: false, error: "Name is required" };
  if (!(row.price > 0)) return { ok: false, error: "Price must be greater than 0" };
  if (!row.description?.trim()) return { ok: false, error: "Description is required" };
  if (!Array.isArray(row.images) || row.images.length < 1) {
    return { ok: false, error: "At least 1 image is required" };
  }
  if (row.images.length > 8) {
    return { ok: false, error: "Maximum 8 images" };
  }

  const { data, error } = await sb
    .from("products")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidateTag("products");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath(`/admin/${row.id}`);
  revalidatePath("/admin");

  return { ok: true, product: data };
}

export async function deleteProduct(id) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateTag("products");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin");
  return { ok: true };
}
```

- [ ] **Step 3: Verify the file is server-only**

```bash
grep "use server" lib/products-actions.js
```
Expected: matches line 1.

- [ ] **Step 4: Commit**

```bash
git add lib/products-actions.js
git commit -m "Add saveProduct + deleteProduct Server Actions (admin-only, revalidates cache)"
```

---

## Task 17: Create ProductForm + ImageList + VideoFields

**Files:**
- Create: `app/admin/(authed)/_components/ProductForm.js`
- Create: `app/admin/(authed)/_components/ImageList.js`
- Create: `app/admin/(authed)/_components/VideoFields.js`

- [ ] **Step 1: Create ImageList**

```jsx
// app/admin/(authed)/_components/ImageList.js
"use client";

import Image from "next/image";
import { useState } from "react";
import { BLUR_DATA_URL } from "@/data/products";

export default function ImageList({ value = [], onChange }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    if (!draft.trim()) return;
    onChange([...value, draft.trim()]);
    setDraft("");
  };

  const remove = (i) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const move = (i, dir) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.map((src, i) => (
        <div key={i} className="flex items-center gap-2 bg-forest/40 border border-parchment/15 rounded-md p-2">
          <div className="relative w-12 h-12 shrink-0 bg-ink/40 rounded-sm overflow-hidden">
            <Image src={src} alt="" fill className="object-cover" sizes="48px" placeholder="blur" blurDataURL={BLUR_DATA_URL} unoptimized />
          </div>
          <input
            type="text"
            value={src}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="flex-1 bg-transparent text-cream text-sm border-none focus:outline-none"
          />
          {i === 0 && (
            <span className="text-[9px] uppercase tracking-[0.18em] text-brass-light">Hero</span>
          )}
          <button type="button" onClick={() => move(i, -1)} aria-label="Move up" className="text-cream-dim hover:text-labradorite-light px-1" disabled={i === 0}>↑</button>
          <button type="button" onClick={() => move(i, 1)} aria-label="Move down" className="text-cream-dim hover:text-labradorite-light px-1" disabled={i === value.length - 1}>↓</button>
          <button type="button" onClick={() => remove(i)} aria-label="Remove" className="text-rose-300/70 hover:text-rose-300 px-1">×</button>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          placeholder="/relics/your-photo.jpg"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
        <button type="button" onClick={add} className="btn-relic !py-2 !px-4 !text-[11px]">
          Add
        </button>
      </div>
      {value.length < 3 && (
        <p className="text-yellow-200/70 text-xs italic mt-1">
          Recommended: at least 3 images per product.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create VideoFields**

```jsx
// app/admin/(authed)/_components/VideoFields.js
"use client";

export default function VideoFields({ value, onChange }) {
  const v = value || { src: "", poster: "" };
  const hasVideo = !!v.src;

  const update = (patch) => onChange({ ...v, ...patch });
  const remove = () => onChange(null);

  if (!hasVideo) {
    return (
      <button
        type="button"
        onClick={() => onChange({ src: "", poster: "" })}
        className="btn-relic !py-2 !px-4 !text-[11px]"
      >
        + Add video
      </button>
    );
  }

  return (
    <div className="space-y-3 bg-forest/40 border border-parchment/15 rounded-md p-3">
      <div>
        <label className="block text-cream-dim text-[10px] uppercase tracking-[0.18em] mb-1">
          Video src (path or URL)
        </label>
        <input
          type="text"
          value={v.src}
          onChange={(e) => update({ src: e.target.value })}
          placeholder="/relics/moss-heart.mp4"
          className="w-full bg-forest/50 border border-parchment/25 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
      </div>
      <div>
        <label className="block text-cream-dim text-[10px] uppercase tracking-[0.18em] mb-1">
          Poster (defaults to first image if blank)
        </label>
        <input
          type="text"
          value={v.poster || ""}
          onChange={(e) => update({ poster: e.target.value })}
          placeholder="/relics/moss-heart-1.jpg"
          className="w-full bg-forest/50 border border-parchment/25 rounded-md px-3 py-2 text-cream text-sm focus:outline-none focus:border-labradorite-light"
        />
      </div>
      <button type="button" onClick={remove} className="text-rose-300/80 text-xs uppercase tracking-[0.18em]">
        Remove video
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create ProductForm (the big one)**

```jsx
// app/admin/(authed)/_components/ProductForm.js
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ImageList from "./ImageList";
import VideoFields from "./VideoFields";
import { saveProduct } from "@/lib/products-actions";

const EMPTY = {
  id: "",
  name: "",
  price: 0,
  currency: "USD",
  stone: "Labradorite",
  description: "",
  fieldNote: "",
  cordType: "",
  aspectRatio: 1.0,
  sold: false,
  featured: false,
  images: [],
  video: null,
};

export default function ProductForm({ initial, isNew }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    startTransition(async () => {
      const res = await saveProduct(form);
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        if (isNew) router.push(`/admin/${res.product.id}`);
        else router.refresh();
      } else {
        setError(res.error || "Save failed");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-3xl">
      <Field label="ID">
        <input
          type="text"
          value={form.id}
          onChange={(e) => update({ id: e.target.value })}
          disabled={!isNew}
          placeholder="r-09"
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream disabled:opacity-50"
        />
      </Field>

      <Field label="Name">
        <input
          type="text"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          required
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price (USD)">
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => update({ price: Number(e.target.value) })}
            required
            className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
          />
        </Field>
        <Field label="Stone">
          <input
            type="text"
            value={form.stone}
            onChange={(e) => update({ stone: e.target.value })}
            className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          required
          rows={4}
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <Field label="Field note (1-2 sentence personal note)">
        <textarea
          value={form.fieldNote}
          onChange={(e) => update({ fieldNote: e.target.value })}
          rows={2}
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <Field label="Cord / chain type">
        <input
          type="text"
          value={form.cordType}
          onChange={(e) => update({ cordType: e.target.value })}
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <Field label="Aspect ratio (0.5-2.0, default 1.0)">
        <input
          type="number"
          step="0.05"
          min="0.5"
          max="2"
          value={form.aspectRatio}
          onChange={(e) => update({ aspectRatio: Number(e.target.value) })}
          className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream"
        />
      </Field>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-cream cursor-pointer">
          <input
            type="checkbox"
            checked={form.sold}
            onChange={(e) => update({ sold: e.target.checked })}
            className="w-4 h-4"
          />
          Sold
        </label>
        <label className="flex items-center gap-2 text-cream cursor-pointer">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => update({ featured: e.target.checked })}
            className="w-4 h-4"
          />
          Featured
        </label>
      </div>

      <Field label="Images (3-5 recommended)">
        <ImageList value={form.images} onChange={(images) => update({ images })} />
      </Field>

      <Field label="Video (optional)">
        <VideoFields value={form.video} onChange={(video) => update({ video })} />
      </Field>

      <div className="sticky bottom-0 -mx-5 sm:-mx-6 mt-8 px-5 sm:px-6 py-3 bg-forest/95 border-t border-parchment/15 backdrop-blur-sm flex items-center justify-between" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {error && <span className="text-rose-300 text-xs flex-1">{error}</span>}
        {success && <span className="text-labradorite-glow text-xs flex-1">Saved ✓</span>}
        {!error && !success && <span className="flex-1" />}
        <button
          type="submit"
          disabled={isPending}
          className="btn-relic disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-cream-dim text-[10px] uppercase tracking-[0.22em] mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Verify components compile**

Visit `/admin/login`, log in, then try `/admin/r-01` (won't exist as a route yet — Task 21). For now, just confirm there are no syntax errors via build:

```bash
curl -sI http://localhost:3939/admin/login | head -1
```
Expected: 200 (page still renders).

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(authed)/_components/"
git commit -m "Add ProductForm + ImageList + VideoFields shared components"
```

---

## Task 18: Create DeleteButton

**Files:**
- Create: `app/admin/(authed)/_components/DeleteButton.js`

- [ ] **Step 1: Create the confirm-by-typing dialog**

```jsx
// app/admin/(authed)/_components/DeleteButton.js
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/lib/products-actions";

export default function DeleteButton({ id, name }) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    setError("");
    if (typed.trim() !== name) {
      setError(`Type "${name}" exactly to confirm`);
      return;
    }
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(res.error || "Delete failed");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDialog(true)}
        className="text-rose-300/80 hover:text-rose-300 text-xs uppercase tracking-[0.22em] underline-offset-4 hover:underline"
      >
        Delete this relic
      </button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-ink/80 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="card-relic p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-chancery text-cream text-3xl mb-3">Delete {name}?</h2>
            <p className="text-cream-dim text-sm mb-4">
              This permanently removes this relic. Type the relic&apos;s name to confirm.
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              autoFocus
              className="w-full bg-forest/50 border border-parchment/35 rounded-md px-3 py-2 text-cream mb-2"
            />
            {error && <p className="text-rose-300 text-xs mb-2">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="flex-1 text-cream-dim hover:text-cream border border-parchment/35 rounded-md px-4 py-2 text-xs uppercase tracking-[0.18em]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 text-cream bg-rose-700/80 hover:bg-rose-700 rounded-md px-4 py-2 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/admin/(authed)/_components/DeleteButton.js"
git commit -m "Add DeleteButton with confirm-by-typing-name dialog"
```

---

## Task 19: Create admin list page

**Files:**
- Create: `app/admin/(authed)/page.js`

- [ ] **Step 1: Create the list view**

```jsx
// app/admin/(authed)/page.js
import Link from "next/link";
import Image from "next/image";
import { getProducts } from "@/lib/products-db";
import { BLUR_DATA_URL } from "@/data/products";

export default async function AdminListPage() {
  const products = await getProducts();
  const total = products.length;
  const available = products.filter((p) => !p.sold).length;
  const sold = total - available;
  const featured = products.filter((p) => p.featured).length;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-chancery text-cream text-3xl sm:text-4xl">All relics</h1>
          <p className="text-cream-dim text-sm mt-1">
            {total} total · {available} available · {sold} found home · {featured} featured
          </p>
        </div>
        <Link href="/admin/new" className="btn-relic !py-2 !px-5 !text-[12px]">
          + New relic
        </Link>
      </div>

      <ul className="space-y-3">
        {products.map((p) => (
          <li key={p.id} className="card-relic p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-ink/40 rounded-sm overflow-hidden">
              {p.image && (
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  unoptimized
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-chancery text-cream text-xl truncate">{p.name}</p>
              <p className="text-xs text-cream-dim mt-0.5">
                <span className="text-labradorite-light">${p.price}</span>
                {" · "}
                {p.sold ? "Sold" : "Available"}
                {p.featured && " · ★ Featured"}
              </p>
              <p className="text-[10px] text-cream-dim/70 mt-0.5 truncate">{p.id}</p>
            </div>
            <Link
              href={`/admin/${p.id}`}
              className="text-[11px] uppercase tracking-[0.18em] text-labradorite-light hover:text-labradorite-glow"
            >
              Edit →
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Verify the list renders**

In browser: log in at `/admin/login`, then visit `/admin`. Should see all 8 products with thumbnails, names, prices, status. Each has "Edit →" link.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(authed)/page.js"
git commit -m "Add admin list page (all products with quick edit links)"
```

---

## Task 20: Create new + edit pages

**Files:**
- Create: `app/admin/(authed)/new/page.js`
- Create: `app/admin/(authed)/[id]/page.js`

- [ ] **Step 1: Create new product page**

```jsx
// app/admin/(authed)/new/page.js
import Link from "next/link";
import ProductForm from "../_components/ProductForm";
import { getProducts } from "@/lib/products-db";

async function suggestId() {
  const products = await getProducts();
  let n = products.length + 1;
  const existing = new Set(products.map((p) => p.id));
  let id;
  do {
    id = `r-${String(n).padStart(2, "0")}`;
    n++;
  } while (existing.has(id));
  return id;
}

export default async function NewProductPage() {
  const id = await suggestId();
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
      <Link href="/admin" className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light">
        ← Back to vault
      </Link>
      <h1 className="font-chancery text-cream text-3xl sm:text-4xl mt-3 mb-6">New relic</h1>
      <ProductForm initial={{ id }} isNew={true} />
    </main>
  );
}
```

- [ ] **Step 2: Create edit page**

```jsx
// app/admin/(authed)/[id]/page.js
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductForm from "../_components/ProductForm";
import DeleteButton from "../_components/DeleteButton";
import { getProduct } from "@/lib/products-db";

export default async function EditProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
      <Link href="/admin" className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light">
        ← Back to vault
      </Link>
      <h1 className="font-chancery text-cream text-3xl sm:text-4xl mt-3 mb-6">Edit {product.name}</h1>
      <ProductForm initial={product} isNew={false} />
      <div className="mt-12 pt-6 border-t border-parchment/15">
        <p className="text-rose-300/70 text-xs uppercase tracking-[0.22em] mb-3">Danger zone</p>
        <DeleteButton id={product.id} name={product.name} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify both pages render**

In browser:
1. Visit `/admin/new` → see "New relic" form with auto-suggested id "r-09"
2. Visit `/admin/r-01` → see "Edit First Frost" form with all fields populated
3. Visit `/admin/nonexistent-id` → see 404

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(authed)/new/" "app/admin/(authed)/[id]/"
git commit -m "Add /admin/new and /admin/[id] pages (create + edit forms)"
```

---

## Task 21: End-to-end smoke test of admin CRUD

**Files:** (no code changes)

- [ ] **Step 1: Login flow**

Manual or via curl:
```bash
# Wrong password
curl -s -X POST http://localhost:3939/api/admin/login -H "Content-Type: application/json" -d '{"password":"wrong"}'
# Expect: {"error":"Wrong password"}

# Right password
curl -s -c /tmp/c.txt -X POST http://localhost:3939/api/admin/login -H "Content-Type: application/json" -d "{\"password\":\"$ADMIN_PASSWORD\"}"
# Expect: {"ok":true}
```

- [ ] **Step 2: Browse admin pages**

In a real browser (since admin form is interactive):
1. Visit `/admin/login`, log in
2. Visit `/admin` — see list of 8 products
3. Click "Edit →" on First Frost → see form populated
4. Change price from $68 to $69, click Save → see "Saved ✓"
5. Open `/shop` in a separate tab → confirm First Frost shows $69 (may need refresh)
6. Go back to admin, change price back to $68, save
7. Click "+ New relic" → see form with id "r-09"
8. Fill in: name "Test Relic", price 1, description "test", add image `/relics/sample.jpg`, save
9. Verify it appears in `/admin` and `/shop`
10. Open r-09 in admin, scroll to bottom, click "Delete this relic"
11. Type "Test Relic" in confirm dialog → click "Delete forever"
12. Verify it's gone from both `/admin` and `/shop`

- [ ] **Step 3: Verify service-role key isn't leaked to browser**

In browser devtools → Sources tab → search across all loaded JS files for the first 10 chars of the service role key. Expected: 0 matches.

```bash
# Or programmatic check on a built page:
curl -s http://localhost:3939/ | grep -c "$(echo "$SUPABASE_SERVICE_ROLE_KEY" | cut -c1-12)" || echo "Service key NOT in HTML"
```
Expected: `Service key NOT in HTML` or `0`.

- [ ] **Step 4: Verify middleware on logout**

```bash
curl -s -X POST http://localhost:3939/api/admin/logout -b /tmp/c.txt -c /tmp/c.txt
# Expect: {"ok":true}

curl -sI http://localhost:3939/admin -b /tmp/c.txt | head -3
# Expect: 307 Temporary Redirect → /admin/login
```

- [ ] **Step 5: No commit needed — verification task**

---

# PHASE 5 — Deploy + verify (Task 22)

## Task 22: Push to production + final verification

**Files:** (no code changes)

- [ ] **Step 1: Ensure all env vars are set in Vercel**

Manual: visit https://vercel.com/dashboard → yani-relic → Settings → Environment Variables. Confirm these 5 exist (Production + Preview + Development):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

- [ ] **Step 2: Push everything**

```bash
git log --oneline -25
git push origin main
```

- [ ] **Step 3: Wait for Vercel deploy + verify production routes**

```bash
until curl -sI https://yani-relic.vercel.app/ 2>/dev/null | grep -q "200"; do sleep 5; done

# Public routes
curl -sI https://yani-relic.vercel.app/ | head -3
curl -sI https://yani-relic.vercel.app/shop | head -3
curl -sI https://yani-relic.vercel.app/admin/login | head -3

# /admin should redirect when not authed
curl -sI https://yani-relic.vercel.app/admin | head -3
```

Expected:
- /, /shop, /admin/login → 200
- /admin (no cookie) → 307 redirect to /admin/login

- [ ] **Step 4: Test admin login on production**

Open https://yani-relic.vercel.app/admin/login in browser, log in. Edit a product. Verify the change shows on /shop within a few seconds.

- [ ] **Step 5: Test on mobile**

Open the same URLs on your phone. Confirm:
- Login form is large + touch-friendly
- List view is readable, "Edit →" buttons are tappable
- Edit form scrolls smoothly, all fields usable
- Save button is sticky at bottom, reachable above the iOS keyboard

- [ ] **Step 6: Done**

```bash
git tag v2-admin-editor
git push origin v2-admin-editor
```

---

## Risks revisited

| Risk | Mitigation in this plan |
|---|---|
| Service-role key exposed to browser | Service-role only imported in `lib/products-actions.js` (`"use server"`) and seed script. Task 21 verifies via HTML grep. |
| Cookie session forgery | HMAC-SHA256 over payload, constant-time compare in both `lib/auth.js` and `middleware.js`. Task 11 verifies tamper-detection. |
| Migration creates duplicates if re-run | Seed uses `upsert(onConflict: 'id')`. Task 4 explicit. |
| Stale public cache after admin edit | `revalidateTag("products")` + `revalidatePath` in Server Actions. Task 21 step 5 verifies. |
| Login page wrapped by authed layout | Route group `(authed)` keeps `/admin/login` outside the layout. Task 15 step 3 verifies. |
| Empty product fields | Server-side validation in `saveProduct`. Task 16 enforces. |
| Image path typed wrong | Live preview thumbnail in `ImageList` — broken image visible. Documented but not blocking. |

---

## Self-review

**Spec coverage**:
- ✓ Goal (admin CRUD) → Tasks 16-21
- ✓ Schema → Task 3 (SQL file)
- ✓ Auth flow → Tasks 11-14
- ✓ Public-site reads → Tasks 5-9
- ✓ Admin routes (login, list, new, [id]) → Tasks 14, 19, 20
- ✓ File structure → All files mapped to tasks
- ✓ Migration steps → Tasks 1-4
- ✓ Risks → all 8 in spec have mitigations referenced in tasks
- ✓ Test plan → Task 21 (12-step manual verification)

All steps contain actual code, exact file paths, and verification commands. No "TBD" / "etc." / "similar to" placeholders. Type names consistent (e.g. `saveProduct`, `deleteProduct`, `getProducts`, `productToRow`, `bustProductCache` though the last was dropped after refactor — verified clean).
