"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key, respects RLS).
 *
 * NOTE: these must be *static* `process.env.NEXT_PUBLIC_*` references, not a
 * dynamic lookup, so Next.js inlines them into the client bundle at build time.
 * A dynamic read (process.env[name]) is undefined in the browser.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createBrowserClient(url, anonKey);
}
