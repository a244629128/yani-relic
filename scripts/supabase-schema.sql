-- scripts/supabase-schema.sql
-- Run once in Supabase SQL Editor:
--   1. Open https://supabase.com/dashboard → your project → SQL Editor
--   2. Click "New query"
--   3. Paste the entire contents of this file
--   4. Click "Run"
-- Expected result: "Success. No rows returned." (or similar)

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
