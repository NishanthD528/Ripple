/**
 * Seed demo events into the events table so "Run demo scan" produces a full
 * alert feed instantly. Idempotent — dedupes by source_url.
 *
 *   npm run seed
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DEMO_EVENTS } from "../lib/demo-events";

// Prefer .env.local (Next.js convention) if present.
loadEnv({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
    );
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let inserted = 0;
  for (const e of DEMO_EVENTS) {
    const { data: existing } = await admin
      .from("events")
      .select("id")
      .eq("source_url", e.source_url)
      .maybeSingle();
    if (existing) {
      console.log(`· exists: ${e.title}`);
      continue;
    }
    const { error } = await admin.from("events").insert(e);
    if (error) {
      console.error(`✗ failed: ${e.title}`, error.message);
    } else {
      inserted += 1;
      console.log(`✓ inserted: ${e.title}`);
    }
  }

  console.log(`\nDone. ${inserted} new demo event(s) inserted.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
