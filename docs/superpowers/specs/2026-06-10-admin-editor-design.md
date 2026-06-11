# Admin Product Editor — Yani Relics

**Date**: 2026-06-10
**Status**: Approved (design), pending implementation plan
**Sub-project**: 1 of 3 (Admin → Analytics → PayPal)

---

## Goal

Move product data out of `data/products.js` into Supabase Postgres so the shop owner can edit prices, descriptions, image lists, and sold/featured state — including creating brand new products and deleting old ones — from a password-protected admin UI accessible on desktop and mobile. Site reads from Supabase with on-demand revalidation, so admin saves reflect on the public site within ~1-2 seconds. Free tier only.

## Non-goals (v1)

- Multi-admin / role-based access (single owner — you)
- Image upload UI (images still committed to `/public/relics/` manually for v1)
- Order management / inventory beyond binary `sold`
- Drafts / scheduled publishing
- Audit log / edit history
- i18n / translations

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Vercel (Next.js 15)                    │
│                                                         │
│   Public routes              Admin routes               │
│   /, /shop, ...              /admin/login               │
│                              /admin (list)              │
│                              /admin/new                 │
│                              /admin/[id] (edit)         │
│       │                            │                    │
│       │ getProducts() etc          │ Server Actions     │
│       │ (cached, revalidated       │ (auth-gated, use   │
│       │  on admin saves)           │  service-role key) │
│       └─────────────┬──────────────┘                    │
│                     ▼                                   │
└─────────────────────│───────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────────┐
         │      Supabase (free tier)  │
         │   products table           │
         │   RLS: public SELECT only  │
         │   service role: full       │
         └────────────────────────────┘
```

- **Data flow**: Public reads via server-side anon client. Admin writes via Server Actions using the service-role key (never sent to browser).
- **Cache**: Public pages use Next.js cache (`getProducts()` is wrapped in `unstable_cache`). After a write, the Server Action calls `revalidatePath('/')`, `revalidatePath('/shop')`, and `revalidateTag('products')` so changes propagate instantly.
- **Auth**: Cookie-based session. Cookie holds a signed token (HMAC of timestamp + nonce, not the password itself), HttpOnly, Secure, SameSite=Lax, 30-day expiry. Single `ADMIN_PASSWORD` env var.

## Schema

```sql
create table products (
  id            text primary key,                         -- e.g. "r-09" — manually assigned or auto-incremented as "r-{n}"
  name          text not null,
  price         numeric(10, 2) not null,                  -- e.g. 68.00
  currency      text not null default 'USD',
  stone         text not null default 'Labradorite',
  description   text not null,
  field_note    text,
  cord_type     text,
  aspect_ratio  numeric(4, 2) default 1.0,                -- 0.5 to 2.0 — image proportion hint
  sold          boolean not null default false,
  featured      boolean not null default false,
  images        text[] not null default '{}',             -- array of paths like '/relics/first-frost-1.jpg' (3-5 expected)
  video         jsonb default null,                       -- { src: text, poster: text } | null
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Row Level Security
alter table products enable row level security;

-- Anyone can read
create policy "Public can read products"
  on products for select
  to anon
  using (true);

-- Only service role can write (service role bypasses RLS)
-- No INSERT/UPDATE/DELETE policy for anon → public can't mutate
```

**Field notes**:
- `id` is text not auto-generated UUID — we keep human-readable IDs like `r-09` so URLs like `/shop?relic=r-09` stay legible. Admin "Create New" auto-suggests next available `r-{n}` but is editable.
- `images` is a Postgres text array — clean indexing, ordered, easy to validate length in admin.
- `video` is jsonb — single optional object. Nullable.
- `updated_at` is auto-updated by a trigger (so we can detect concurrent edits later if needed).

## Auth flow

1. User visits `/admin` → middleware checks for `admin_session` cookie
2. No cookie / invalid cookie → redirect to `/admin/login`
3. `/admin/login` form posts to `/api/admin/login`
4. Server compares submitted password to `ADMIN_PASSWORD` env var (constant-time compare via `crypto.timingSafeEqual`)
5. If match: generate signed session token (`HMAC(ADMIN_SECRET, timestamp + nonce)`), set as HttpOnly cookie, redirect to `/admin`
6. Subsequent requests: middleware verifies the cookie's signature and expiry
7. `/api/admin/logout` clears the cookie

**Why not bcrypt the password?** Single shared admin password, env-stored, no user accounts. Constant-time compare is sufficient.

## Public-site reads

A new `lib/products-db.js` provides:

```js
import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase";

export const getProducts = unstable_cache(
  async () => {
    const sb = createServerSupabase();
    const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(rowToProduct);
  },
  ["products"],
  { tags: ["products"] }
);

export const getProduct = unstable_cache(
  async (id) => {
    const sb = createServerSupabase();
    const { data } = await sb.from("products").select("*").eq("id", id).single();
    return data ? rowToProduct(data) : null;
  },
  ["product"],
  { tags: ["products"] }
);

function rowToProduct(row) {
  // Build legacy `media` array for code that uses it (gallery, etc.) — hero image first,
  // then video as 2nd slide, then remaining images.
  const images = row.images || [];
  const media = [];
  if (images.length > 0) media.push({ type: "image", src: images[0] });
  if (row.video) media.push({ type: "video", src: row.video.src, poster: row.video.poster || images[0] });
  for (let i = 1; i < images.length; i++) media.push({ type: "image", src: images[i] });
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    currency: row.currency,
    stone: row.stone,
    description: row.description,
    fieldNote: row.field_note,
    cordType: row.cord_type,
    aspectRatio: Number(row.aspect_ratio),
    sold: row.sold,
    featured: row.featured,
    images,
    video: row.video,
    media,
    image: images[0] || null,
  };
}
```

All existing consumers of `products` get the same JS shape they have today — no component-level changes needed (only the import).

`featuredProducts` helper:
```js
export const getFeaturedProducts = async () => (await getProducts()).filter((p) => p.featured);
```

**Cache invalidation**: Server Actions call `revalidateTag("products")` after each write.

## Admin routes

### `/admin/login` (mobile-first)

```
┌────────────────────────────┐
│        Yani Relics         │  ← chancery serif
│           Vault            │
│                            │
│   ┌────────────────────┐   │
│   │ password           │   │
│   └────────────────────┘   │
│                            │
│   [ Enter the Vault ]      │  ← btn-relic
└────────────────────────────┘
```

- Single password input + Enter button
- On wrong password: shake animation + small error text
- Already-authed user visiting login: skip to `/admin`

### `/admin` (list view)

Mobile: stacked card list. Desktop: table.

Header:
- Title "Vault" + subtitle "8 relics, 6 available, 2 found home"
- Top-right: `+ New` button (large, prominent) and `Sign out`
- Filter chips below: `All (8)` `Available (6)` `Sold (2)` `Featured (3)`
- Search input (text — name/stone)

List row (mobile):
```
┌───────────────────────────────────────┐
│  [img]   First Frost                  │
│          $68 · Available · Featured ✦ │
│          [ Mark Sold ] [ Edit ] [ × ] │
└───────────────────────────────────────┘
```

`× Delete` shows a confirmation dialog ("This permanently removes First Frost. Type the name to confirm.") to prevent accidental deletes.

### `/admin/new` and `/admin/[id]` (form)

Single-column mobile, two-column on `lg:` desktop.

```
┌─────────────────────────────────────┐
│  ← Back to vault          [ Save ]  │  ← sticky top
├─────────────────────────────────────┤
│                                     │
│  ID  r-09  (read-only, suggested)   │
│                                     │
│  Name           [ ____________ ]    │
│  Price          [ ____________ ]    │
│  Stone          [ Labradorite ]     │
│                                     │
│  Description    [ ____________ ]    │
│                 [               ]    │
│                                     │
│  Field note     [ ____________ ]    │
│                                     │
│  Cord type      [ ____________ ]    │
│  Aspect ratio   [ 0.75       ]      │
│                                     │
│  [ ] Sold        [ ] Featured       │
│                                     │
│  ── Images (3–5) ────────────────   │
│  [img] /relics/first-frost-1.jpg ↑↓×│
│  [img] /relics/first-frost-2.jpg ↑↓×│
│  [img] /relics/first-frost-3.jpg ↑↓×│
│  [+] Paste path:  [ ____________ ]  │
│                                     │
│  ── Video (1) ───────────────────   │
│  src:    [ /relics/.....mp4 ]       │
│  poster: [ /relics/.....jpg ]       │
│  (or empty = use first image)       │
│  [ Remove video ]                   │
│                                     │
│  [ Save ]   [ Cancel ]              │  ← sticky bottom on mobile
│                                     │
│  ── Danger zone ─────────────       │
│  [ Delete this relic ]              │  ← bottom of page, secondary
└─────────────────────────────────────┘
```

**Validation** (client + server, both):
- `name`, `price`, `description` required (non-empty)
- `price > 0`
- `id` — only on /admin/new — required, must match `^r-\d+$`, must not already exist
- `images.length >= 1` required to save; warn (yellow) if `< 3`; cap at 8
- If `video.src` present, also require `video.poster` (or default to images[0])
- Aspect ratio between 0.5 and 2.0

**Save behavior**:
- Server Action validates again, writes via service-role client
- On success: `revalidateTag('products')`, toast "Saved", stay on edit page
- On error: toast with the error message, form remains editable

**Image management**:
- Each row shows a small `<img>` preview (the path resolves to /public/relics/foo.jpg)
- If the file doesn't exist yet, show a placeholder + warning text
- Reorder via ↑↓ buttons (drag-and-drop not in v1 — simpler)
- First image gets a tiny "Hero" badge

## File structure

```
NEW
  lib/
    supabase.js                  ← createServerSupabase() + createBrowserSupabase()
    products-db.js               ← getProducts(), getProduct(id), createProduct(), updateProduct(), deleteProduct()
    auth.js                      ← sign/verify session token, get session from cookies
  app/
    admin/
      layout.js                  ← admin chrome (header, sign-out), enforces auth check
      page.js                    ← list view (server component fetches products)
      new/page.js                ← create form
      [id]/page.js               ← edit form (404 if id doesn't exist)
      _components/
        ProductForm.js           ← shared form (client component) for new + edit
        ImageList.js             ← dynamic image-path list
        VideoFields.js           ← video src + poster inputs
        DeleteButton.js          ← confirm-by-typing-name dialog
        Toast.js                 ← simple in-page toast for save success/error
      _actions/
        save-product.js          ← Server Action: validate + upsert + revalidate
        delete-product.js        ← Server Action: delete + revalidate
    api/admin/
      login/route.js             ← POST password → cookie
      logout/route.js            ← clear cookie
    admin/login/page.js          ← login form (public — no auth required)
  middleware.js                  ← protect /admin/* (allow /admin/login)
  scripts/
    seed-products.mjs            ← one-time: read data/products.js → upsert into Supabase
    supabase-schema.sql          ← create table + RLS policies (run once in Supabase SQL editor)

EDIT
  app/page.js                    ← `const products = await getProducts()` instead of import
  app/shop/page.js               ← same
  components/RelicFlipDeck.js    ← receives products as a prop now (or fetches client-side via API)
  data/products.js               ← keep only `links` + `BLUR_DATA_URL`, remove products array
  next.config.mjs                ← (no change needed for v1 — images still local)

ENV (.env.local + Vercel project env)
  NEXT_PUBLIC_SUPABASE_URL       ← public, browser-safe
  NEXT_PUBLIC_SUPABASE_ANON_KEY  ← public, RLS-protected
  SUPABASE_SERVICE_ROLE_KEY      ← SERVER ONLY — never exposed to browser
  ADMIN_PASSWORD                 ← single password for /admin/login
  ADMIN_SESSION_SECRET           ← 32+ char random string, used to sign session cookies
```

### `RelicFlipDeck` consideration

Currently `RelicFlipDeck` imports `products` directly. Once products live in Supabase, the deck has two options:

1. **Prop-drill from a server component** — `app/page.js` fetches `getProducts()`, passes it as a prop. Cleaner.
2. **Client fetch** — deck mounts, calls a `/api/products` route, picks random. More API surface.

Plan picks option 1 — pass `products` as a prop to `RelicFlipDeck`. Simpler, no extra API route.

## Migration & deploy steps

These run ONCE during the implementation pass:

1. Create a Supabase project at supabase.com (free, 1 click)
2. In the Supabase SQL editor, paste + run `scripts/supabase-schema.sql` (creates table + RLS)
3. Add 5 env vars to `.env.local` AND to Vercel project settings
4. Locally: `npm run seed` (runs `scripts/seed-products.mjs`) — copies current 8 products into Supabase
5. Deploy. Public site now reads from Supabase. Admin works at `/admin`.
6. Verify: open `/admin`, log in, edit a price, watch the public page update on next reload.

## Risks (and mitigations)

| Risk | Mitigation |
|---|---|
| Service-role key leaks to browser | Only used in Server Actions + API routes. Never imported into client components. Linted via a code-grep in the test plan. |
| Cookie session forgery | HMAC-signed token with `ADMIN_SESSION_SECRET`. Constant-time verify. Timestamp expires after 30 days. |
| Concurrent edits overwrite each other | Single admin, low risk. Add `updated_at` to form on load; on save, server compares — if newer in DB, return 409 with "edit conflict, refresh". |
| Migration script run twice creates duplicates | Use `.upsert({ ... }, { onConflict: 'id' })` so re-runs are idempotent. |
| Stale cache after admin edit | `revalidateTag("products")` after every write. If revalidation fails silently, public pages auto-refresh on next request via Next.js cache validation. |
| Deleting a relic that's in someone's shared link | Soft-delete first? v1: hard delete with confirm-by-typing-name. Future: add `archived` boolean. |
| Free-tier limits hit | At 8 products + a handful of admin edits per day, we're at <1% of free tier. Not a realistic concern. |
| Image path typed wrong in admin | Preview thumbnail renders the path — broken image immediately visible. Server-side validation only checks string shape, not file existence (would need filesystem access on Vercel). |
| Admin login over plain HTTP in local dev | Cookie set with `Secure` in production only (env-aware). Dev uses cookie without `Secure`. |

## Test plan (manual, no automated suite)

After implementation:

1. **Seed**: confirm all 8 products are in Supabase, public site renders identically to before
2. **Login**: visit `/admin`, get redirected to `/admin/login`. Wrong password → error. Right password → land on `/admin`
3. **List**: see all 8 products, filter chips work, search filters correctly
4. **Edit**: pick First Frost, change price from $68 to $72, save. Public `/shop` shows $72 within ~2s
5. **Mark sold**: toggle the sold flag in the list view, public page reflects "Found her person" badge
6. **Create**: add a new product r-09, fill all fields, save. Public page shows it
7. **Delete**: delete a test product, confirm dialog requires name. Public page no longer shows it
8. **Mobile**: do steps 2-5 on an iPhone-sized viewport. Form is usable single-thumb
9. **Security**: open browser devtools, check `SUPABASE_SERVICE_ROLE_KEY` is NOT in the page bundle (grep). Confirm `admin_session` cookie is HttpOnly
10. **Concurrent edit**: open same product in two tabs, edit and save in both. Second save should fail with 409
11. **Revalidation**: edit a product, confirm it shows on public site without a full deploy
12. **Logout**: sign out, confirm cookie cleared, `/admin` requires re-login

## Out of scope (deferred to v2)

- Image upload UI (manual git-push for v1)
- Drag-and-drop image reorder (use ↑↓ buttons for v1)
- Edit history / audit log
- Multiple admins
- Bulk operations (mark multiple sold at once)
- Search by description / field-note text
- Filter by date created
- Soft delete / archive
- Image existence validation (check file is in /public/relics)
- Currency picker (USD only for v1)
