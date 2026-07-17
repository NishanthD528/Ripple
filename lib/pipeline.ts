import { createAdminClient } from "@/lib/supabase/admin";
import { GroqBudgetExceeded } from "@/lib/groq";
import { matchEvent, writeAlert } from "@/lib/llm";
import { prefilterSuppliers } from "@/lib/prefilter";
import { getHtsRate, parseDutyPercent } from "@/lib/hts";
import { sendEmail } from "@/lib/resend";
import { alertEmailHtml } from "@/lib/email-template";
import {
  fetchFederalRegister,
  fetchGdeltForRegion,
  fetchWeatherForCity,
  type EventCandidate,
} from "@/lib/sources";
import type { MatchResult, RippleEvent, Severity, Supplier } from "@/lib/types";

const CONFIDENCE_FLOOR = 0.7; // Below this: discard entirely.
const EMAIL_CONFIDENCE = 0.85; // Above this + severity medium/high: email.
const DAILY_ALERT_BUDGET = 3; // Per user per day.

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// ---------------------------------------------------------------------------
// Ingestion: pull from public sources and insert new (deduped) events.
// ---------------------------------------------------------------------------
async function insertCandidates(
  admin: SupabaseAdmin,
  candidates: EventCandidate[]
): Promise<number> {
  let inserted = 0;
  for (const c of candidates) {
    if (!c.source_url) continue;
    // Dedupe against existing events by source_url (unique index also guards).
    const { data: existing } = await admin
      .from("events")
      .select("id")
      .eq("source_url", c.source_url)
      .maybeSingle();
    if (existing) continue;

    const { error } = await admin.from("events").insert({
      source: c.source,
      source_url: c.source_url,
      title: c.title,
      raw_text: c.raw_text,
      event_type: c.event_type,
      region: c.region,
    });
    if (!error) inserted += 1;
  }
  return inserted;
}

export async function ingestSources(admin: SupabaseAdmin): Promise<number> {
  const candidates: EventCandidate[] = [];

  // Federal Register (tariff/trade).
  try {
    candidates.push(...(await fetchFederalRegister()));
  } catch (err) {
    console.warn("[pipeline] federal register failed", err);
  }

  // Distinct supplier regions for news + weather.
  const { data: suppliers } = await admin
    .from("suppliers")
    .select("country, city");

  const regions = new Map<string, { country: string; city: string | null }>();
  for (const s of suppliers ?? []) {
    const country = (s.country ?? "").trim();
    const city = (s.city ?? "").trim();
    if (!country && !city) continue;
    const key = `${country}|${city}`;
    if (!regions.has(key)) regions.set(key, { country, city: city || null });
  }

  for (const { country, city } of regions.values()) {
    if (country || city) {
      try {
        candidates.push(...(await fetchGdeltForRegion(country || city || "", city)));
      } catch (err) {
        console.warn("[pipeline] gdelt failed", err);
      }
    }
    if (city && country) {
      try {
        candidates.push(...(await fetchWeatherForCity(city, country)));
      } catch (err) {
        console.warn("[pipeline] weather failed", err);
      }
    }
  }

  return insertCandidates(admin, candidates);
}

// ---------------------------------------------------------------------------
// Tariff quantification string for the alert writer.
// ---------------------------------------------------------------------------
async function quantifyTariff(supplier: Supplier): Promise<string | null> {
  const code = supplier.hs_codes?.[0];
  if (!code) return null;
  const rate = await getHtsRate(code);
  if (!rate) return null;

  const pct = parseDutyPercent(rate.duty_rate);
  const orderValue = 10_000;
  const lines = [
    `HS code ${rate.hts_code}${rate.description ? ` (${rate.description})` : ""}.`,
    `Current general duty rate: ${rate.duty_rate ?? "unknown"}.`,
  ];
  if (pct !== null) {
    const currentCost = (orderValue * pct) / 100;
    lines.push(
      `On a representative $${orderValue.toLocaleString()} order the current duty is about $${currentCost.toLocaleString()}. ` +
        `If the proposed action raises the rate, the added cost scales with the new rate (e.g. a rate of 25% would be $${(
          (orderValue * 25) /
          100
        ).toLocaleString()}).`
    );
  }
  return lines.join(" ");
}

// ---------------------------------------------------------------------------
// A qualifying match awaiting alert generation.
// ---------------------------------------------------------------------------
interface Candidate {
  event: RippleEvent;
  match: MatchResult;
  suppliers: Supplier[]; // affected suppliers, resolved
}

async function alertsCreatedToday(
  admin: SupabaseAdmin,
  userId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Main pipeline. When `eventIds` is provided (demo scan), only those events are
// considered and no fresh ingestion runs.
// ---------------------------------------------------------------------------
export interface PipelineResult {
  eventsIngested: number;
  matchesEvaluated: number;
  alertsCreated: number;
  emailsSent: number;
  budgetExceeded: boolean;
}

export async function runPipeline(options?: {
  demo?: boolean;
  userId?: string;
  eventIds?: string[];
}): Promise<PipelineResult> {
  const admin = createAdminClient();
  const result: PipelineResult = {
    eventsIngested: 0,
    matchesEvaluated: 0,
    alertsCreated: 0,
    emailsSent: 0,
    budgetExceeded: false,
  };

  // 1. Ingest (skip in demo mode).
  if (!options?.demo) {
    try {
      result.eventsIngested = await ingestSources(admin);
    } catch (err) {
      console.warn("[pipeline] ingestion failed", err);
    }
  }

  // 2. Load events to consider.
  let eventsQuery = admin.from("events").select("*").order("ingested_at", { ascending: false });
  if (options?.eventIds && options.eventIds.length > 0) {
    eventsQuery = eventsQuery.in("id", options.eventIds);
  } else {
    // Only events from the last 3 days for the daily run.
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    eventsQuery = eventsQuery.gte("ingested_at", since).limit(200);
  }
  const { data: eventsData } = await eventsQuery;
  const events = (eventsData ?? []) as RippleEvent[];
  if (events.length === 0) return result;

  // 3. Load users (with profile for email + plan).
  let profileQuery = admin.from("profiles").select("id, email, plan");
  if (options?.userId) profileQuery = profileQuery.eq("id", options.userId);
  const { data: profiles } = await profileQuery;

  try {
    for (const profile of profiles ?? []) {
      const userId = profile.id as string;

      // Load this user's suppliers + suppressions.
      const [{ data: supplierRows }, { data: suppressionRows }] = await Promise.all([
        admin.from("suppliers").select("*").eq("user_id", userId),
        admin.from("suppressions").select("event_type, region").eq("user_id", userId),
      ]);
      const suppliers = (supplierRows ?? []) as Supplier[];
      if (suppliers.length === 0) continue;

      const suppressed = new Set(
        (suppressionRows ?? []).map(
          (s) => `${s.event_type}|${(s.region ?? "").toLowerCase()}`
        )
      );

      const supplierById = new Map(suppliers.map((s) => [s.id, s]));
      const candidates: Candidate[] = [];

      for (const event of events) {
        // Skip suppressed event_type + region.
        const supKey = `${event.event_type}|${(event.region ?? "").toLowerCase()}`;
        if (suppressed.has(supKey)) continue;

        // Skip if an alert already exists for this user+event.
        const { data: existingAlert } = await admin
          .from("alerts")
          .select("id")
          .eq("user_id", userId)
          .eq("event_id", event.id)
          .maybeSingle();
        if (existingAlert) continue;

        // Keyword prefilter.
        const survivors = prefilterSuppliers(event, suppliers);
        if (survivors.length === 0) continue;

        // LLM match.
        const match = await matchEvent(event, survivors);
        result.matchesEvaluated += 1;
        if (!match || !match.relevant || match.confidence < CONFIDENCE_FLOOR) continue;

        const affected = match.affected_supplier_ids
          .map((id) => supplierById.get(id))
          .filter((s): s is Supplier => Boolean(s));
        if (affected.length === 0) continue;

        candidates.push({ event, match, suppliers: affected });
      }

      if (candidates.length === 0) continue;

      // Rank by severity then confidence, respect remaining daily budget.
      candidates.sort((a, b) => {
        const s = SEVERITY_RANK[b.match.severity] - SEVERITY_RANK[a.match.severity];
        return s !== 0 ? s : b.match.confidence - a.match.confidence;
      });

      const already = await alertsCreatedToday(admin, userId);
      const slots = Math.max(0, DAILY_ALERT_BUDGET - already);
      const selected = candidates.slice(0, slots);

      for (const cand of selected) {
        // Tariff quantification.
        let quantification: string | null = null;
        if (cand.event.event_type === "tariff") {
          const withCodes = cand.suppliers.find((s) => (s.hs_codes ?? []).length > 0);
          if (withCodes) {
            try {
              quantification = await quantifyTariff(withCodes);
            } catch (err) {
              console.warn("[pipeline] quantify failed", err);
            }
          }
        }

        // Write the alert.
        const written = await writeAlert(
          cand.event,
          cand.suppliers.map((s) => s.name),
          quantification
        );
        if (!written) continue;

        const emailEligible =
          cand.match.confidence >= EMAIL_CONFIDENCE &&
          (cand.match.severity === "medium" || cand.match.severity === "high");

        const { data: inserted, error } = await admin
          .from("alerts")
          .insert({
            user_id: userId,
            event_id: cand.event.id,
            supplier_ids: cand.suppliers.map((s) => s.id),
            severity: cand.match.severity,
            confidence: cand.match.confidence,
            headline: written.headline,
            summary: written.summary,
            recommended_action: written.recommended_action,
            source_url: cand.event.source_url,
            emailed: false,
          })
          .select("id")
          .single();

        if (error || !inserted) {
          console.warn("[pipeline] alert insert failed", error);
          continue;
        }
        result.alertsCreated += 1;

        // Email if eligible and the user's email is known.
        if (emailEligible && profile.email) {
          const sendResult = await sendEmail({
            to: profile.email as string,
            subject: `Ripple alert: ${written.headline}`,
            html: alertEmailHtml({
              headline: written.headline,
              summary: written.summary,
              recommendedAction: written.recommended_action,
              severity: cand.match.severity,
              supplierNames: cand.suppliers.map((s) => s.name),
              sourceUrl: cand.event.source_url,
            }),
          });
          if (sendResult.sent) {
            result.emailsSent += 1;
            await admin.from("alerts").update({ emailed: true }).eq("id", inserted.id);
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof GroqBudgetExceeded) {
      console.warn(`[pipeline] stopping: ${err.message}`);
      result.budgetExceeded = true;
    } else {
      throw err;
    }
  }

  return result;
}
