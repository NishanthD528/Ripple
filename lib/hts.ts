import { createAdminClient } from "@/lib/supabase/admin";
import type { HtsRate } from "@/lib/types";

// USITC HTS REST API. Free, no key. We cache every lookup in hts_rates.
const HTS_SEARCH_URL = "https://hts.usitc.gov/reqData/dataWeb/api/search";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface HtsApiRow {
  htsno?: string;
  description?: string;
  general?: string; // general (MFN) duty rate text, e.g. "2.5%" or "Free"
}

async function fetchFromUsitc(htsCode: string): Promise<HtsRate | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const url = `${HTS_SEARCH_URL}?keyword=${encodeURIComponent(htsCode)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[hts] USITC HTTP ${res.status} for ${htsCode}`);
      return null;
    }
    const json = (await res.json()) as { results?: HtsApiRow[] } | HtsApiRow[];
    const rows: HtsApiRow[] = Array.isArray(json) ? json : json.results ?? [];
    if (rows.length === 0) return null;

    // Prefer the row whose htsno matches most closely, else the first.
    const normalized = htsCode.replace(/\D/g, "");
    const best =
      rows.find((r) => (r.htsno ?? "").replace(/\D/g, "").startsWith(normalized)) ??
      rows[0];
    if (!best) return null;

    return {
      hts_code: htsCode,
      description: best.description ?? null,
      duty_rate: best.general ?? null,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[hts] lookup failed for ${htsCode}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up the current duty rate for an HTS code, using the cached value in
 * hts_rates when fresh, otherwise hitting USITC and caching the result.
 * Returns null when the code cannot be resolved.
 */
export async function getHtsRate(htsCode: string): Promise<HtsRate | null> {
  const admin = createAdminClient();
  const code = htsCode.trim();
  if (!code) return null;

  const { data: cached } = await admin
    .from("hts_rates")
    .select("*")
    .eq("hts_code", code)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) return cached as HtsRate;
  }

  const fresh = await fetchFromUsitc(code);
  if (!fresh) return (cached as HtsRate | null) ?? null;

  await admin.from("hts_rates").upsert(fresh, { onConflict: "hts_code" });
  return fresh;
}

/**
 * Parse a duty-rate string like "2.5%" or "Free" into a numeric percentage.
 * Returns 0 for "Free" and null when unparseable.
 */
export function parseDutyPercent(rate: string | null): number | null {
  if (!rate) return null;
  if (/free/i.test(rate)) return 0;
  const m = rate.match(/(\d+(?:\.\d+)?)\s*%/);
  return m && m[1] !== undefined ? Number(m[1]) : null;
}
