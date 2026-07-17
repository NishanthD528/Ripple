/**
 * Prefetch USITC duty rates for the seed HS headings into the hts_rates cache
 * so the public SEO pages show real numbers. Safe to re-run.
 *
 *   npm run seed:hts
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { HTS_HEADINGS } from "../lib/hts-headings";

loadEnv({ path: ".env.local" });

const HTS_SEARCH_URL = "https://hts.usitc.gov/reqData/dataWeb/api/search";

interface HtsApiRow {
  htsno?: string;
  description?: string;
  general?: string;
}

async function fetchRate(code: string) {
  try {
    const res = await fetch(`${HTS_SEARCH_URL}?keyword=${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: HtsApiRow[] } | HtsApiRow[];
    const rows: HtsApiRow[] = Array.isArray(json) ? json : json.results ?? [];
    const normalized = code.replace(/\D/g, "");
    const best =
      rows.find((r) => (r.htsno ?? "").replace(/\D/g, "").startsWith(normalized)) ??
      rows[0];
    if (!best) return null;
    return {
      description: best.description ?? null,
      duty_rate: best.general ?? null,
    };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars.");
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seen = new Set<string>();
  let ok = 0;
  for (const h of HTS_HEADINGS) {
    if (seen.has(h.code)) continue;
    seen.add(h.code);

    const rate = await fetchRate(h.code);
    const row = {
      hts_code: h.code,
      description: rate?.description ?? h.title,
      duty_rate: rate?.duty_rate ?? null,
      fetched_at: new Date().toISOString(),
    };
    const { error } = await admin.from("hts_rates").upsert(row, {
      onConflict: "hts_code",
    });
    if (error) {
      console.error(`✗ ${h.code}`, error.message);
    } else {
      ok += 1;
      console.log(`✓ ${h.code} ${row.duty_rate ?? "(no rate)"}`);
    }
    // Be polite to the USITC endpoint.
    await sleep(500);
  }
  console.log(`\nDone. ${ok} heading(s) cached.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
