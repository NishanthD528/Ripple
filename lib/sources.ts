import type { EventType } from "@/lib/types";

/** A raw event candidate before it is deduped/inserted. */
export interface EventCandidate {
  source: string;
  source_url: string | null;
  title: string;
  raw_text: string;
  event_type: EventType;
  region: string;
}

const FR_URL = "https://www.federalregister.gov/api/v1/documents.json";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

async function fetchJson(url: string, timeoutMs = 15_000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Ripple/1.0 (+ripple-hq)" },
    });
    if (!res.ok) {
      console.warn(`[sources] HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[sources] fetch failed for ${url}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Federal Register: tariff / trade policy documents from the last 24h.
// ---------------------------------------------------------------------------
export async function fetchFederalRegister(): Promise<EventCandidate[]> {
  const terms = [
    "tariff",
    "Section 301",
    "antidumping",
    "countervailing",
    "import restriction",
  ];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const params = new URLSearchParams();
  params.set("conditions[term]", terms.join(" "));
  params.set("conditions[publication_date][gte]", since);
  params.set("per_page", "40");
  params.set("order", "newest");
  for (const f of ["title", "abstract", "html_url", "publication_date", "document_number"]) {
    params.append("fields[]", f);
  }

  const json = (await fetchJson(`${FR_URL}?${params.toString()}`)) as {
    results?: {
      title?: string;
      abstract?: string;
      html_url?: string;
      publication_date?: string;
    }[];
  } | null;

  if (!json?.results) return [];

  return json.results.map((r) => ({
    source: "federal_register",
    source_url: r.html_url ?? null,
    title: r.title ?? "Federal Register document",
    raw_text: r.abstract ?? r.title ?? "",
    event_type: "tariff" as const,
    region: "United States", // Regulatory origin; relevance matched via materials/HS.
  }));
}

// ---------------------------------------------------------------------------
// GDELT DOC API: disruption news for a supplier region.
// ---------------------------------------------------------------------------
export async function fetchGdeltForRegion(
  country: string,
  city: string | null
): Promise<EventCandidate[]> {
  const disruption =
    '(strike OR fire OR flood OR "port congestion" OR protest OR "factory shutdown" OR earthquake OR blackout)';
  const place = city ? `"${city}"` : `"${country}"`;
  const query = `${place} ${disruption}`;

  const params = new URLSearchParams();
  params.set("query", query);
  params.set("mode", "artlist");
  params.set("format", "json");
  params.set("maxrecords", "15");
  params.set("timespan", "1d");
  params.set("sort", "datedesc");

  const json = (await fetchJson(`${GDELT_URL}?${params.toString()}`)) as {
    articles?: { title?: string; url?: string; seendate?: string }[];
  } | null;

  if (!json?.articles) return [];

  const region = city ? `${city}, ${country}` : country;
  return json.articles
    .filter((a) => a.url && a.title)
    .map((a) => ({
      source: "gdelt",
      source_url: a.url ?? null,
      title: a.title ?? "",
      raw_text: a.title ?? "",
      event_type: "news" as const,
      region,
    }));
}

// ---------------------------------------------------------------------------
// Open-Meteo: severe weather for a supplier city (needs geocoding first).
// ---------------------------------------------------------------------------
interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

async function geocode(city: string, country: string): Promise<GeoResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=en&format=json`;
  const json = (await fetchJson(url)) as { results?: GeoResult[] } | null;
  const first = json?.results?.[0];
  if (!first) return null;
  // Best-effort country sanity check; keep result even if country string differs.
  return first;
}

// WMO weather codes considered severe (thunderstorm / heavy precip / snow).
const SEVERE_CODES = new Set([65, 67, 75, 82, 86, 95, 96, 99]);

export async function fetchWeatherForCity(
  city: string,
  country: string
): Promise<EventCandidate[]> {
  const geo = await geocode(city, country);
  if (!geo) return [];

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
    `&daily=weather_code,precipitation_sum,wind_speed_10m_max&forecast_days=2&timezone=auto`;
  const json = (await fetchJson(url)) as {
    daily?: {
      time?: string[];
      weather_code?: number[];
      precipitation_sum?: number[];
      wind_speed_10m_max?: number[];
    };
  } | null;

  const daily = json?.daily;
  if (!daily?.weather_code) return [];

  const candidates: EventCandidate[] = [];
  for (let i = 0; i < daily.weather_code.length; i++) {
    const code = daily.weather_code[i];
    const wind = daily.wind_speed_10m_max?.[i] ?? 0;
    const precip = daily.precipitation_sum?.[i] ?? 0;
    const date = daily.time?.[i] ?? "";
    const severe = (code !== undefined && SEVERE_CODES.has(code)) || wind >= 60 || precip >= 50;
    if (!severe) continue;

    candidates.push({
      source: "open_meteo",
      source_url: `https://open-meteo.com/en/docs#latitude=${geo.latitude}&longitude=${geo.longitude}`,
      title: `Severe weather forecast for ${city}, ${country} (${date})`,
      raw_text: `Forecast for ${city}, ${country} on ${date}: WMO weather code ${code}, max wind ${wind} km/h, precipitation ${precip} mm. Potential disruption to local operations and logistics.`,
      event_type: "weather" as const,
      region: `${city}, ${country}`,
    });
    // One alert per city is enough; break after first severe day.
    break;
  }
  return candidates;
}
