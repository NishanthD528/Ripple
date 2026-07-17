import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cookieless anon Supabase client for public, cacheable reads (SEO pages).
 * Respects RLS — only used for the publicly-readable hts_rates table.
 */
export function createPublicClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
