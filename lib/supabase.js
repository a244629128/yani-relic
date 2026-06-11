// lib/supabase.js
//
// Two clients:
//   - createServerSupabase() — uses anon key, RLS-enforced, for public reads
//     (RLS allows public SELECT on products).
//   - createAdminSupabase() — uses SERVICE ROLE key, bypasses RLS.
//     Use ONLY in Server Actions / API routes / scripts. Never import into a
//     client component.

import { createClient } from "@supabase/supabase-js";

export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return createClient(url, anon, { auth: { persistSession: false } });
}

export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, service, { auth: { persistSession: false } });
}
