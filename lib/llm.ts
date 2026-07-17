import { groqJson } from "@/lib/groq";
import type {
  MatchResult,
  ParsedSupplier,
  RippleEvent,
  Severity,
  Supplier,
  WrittenAlert,
} from "@/lib/types";

const SEVERITIES: Severity[] = ["low", "medium", "high"];

function coerceSeverity(v: unknown): Severity {
  return typeof v === "string" && (SEVERITIES as string[]).includes(v)
    ? (v as Severity)
    : "low";
}

// ---------------------------------------------------------------------------
// Onboarding: parse a free-text supplier list into structured records.
// ---------------------------------------------------------------------------
const PARSE_SYSTEM = `You extract structured supplier records from messy text pasted by a small manufacturer. The text may be spreadsheet rows, an email thread, or bullet points.

Return STRICT JSON of the form:
{"suppliers": [{"name": string, "country": string, "city": string, "materials": string, "hs_codes": string[]}]}

Rules:
- One object per distinct supplier.
- "materials" is a short free-text description of what they supply (e.g. "aluminum extrusions, brackets").
- "hs_codes" is an array of any Harmonized Tariff codes present; empty array if none.
- Use empty string "" for any field you cannot determine. Never invent a country or city.
- If you cannot find any suppliers, return {"suppliers": []}.
- Output JSON only. No prose.`;

export async function parseSuppliers(rawText: string): Promise<ParsedSupplier[]> {
  const result = await groqJson<{ suppliers?: unknown[] }>({
    system: PARSE_SYSTEM,
    user: rawText.slice(0, 8000),
    temperature: 0,
    maxTokens: 2048,
  });
  if (!result || !Array.isArray(result.suppliers)) return [];

  return result.suppliers
    .map((raw): ParsedSupplier | null => {
      if (typeof raw !== "object" || raw === null) return null;
      const r = raw as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!name) return null;
      const hs = Array.isArray(r.hs_codes)
        ? r.hs_codes.filter((c): c is string => typeof c === "string").map((c) => c.trim())
        : [];
      return {
        name,
        country: typeof r.country === "string" ? r.country.trim() : "",
        city: typeof r.city === "string" ? r.city.trim() : "",
        materials: typeof r.materials === "string" ? r.materials.trim() : "",
        hs_codes: hs.filter(Boolean),
      };
    })
    .filter((s): s is ParsedSupplier => s !== null);
}

// ---------------------------------------------------------------------------
// Relevance matching (precision-first).
// ---------------------------------------------------------------------------
const MATCH_SYSTEM = `You are a conservative supply-chain risk analyst. Given a public event and a manufacturer's supplier list, decide whether the event poses a concrete, specific risk to one or more listed suppliers.

Return STRICT JSON:
{"relevant": boolean, "affected_supplier_ids": string[], "severity": "low"|"medium"|"high", "confidence": number, "reasoning": string}

STRICT RULES:
- Mark relevant TRUE only when there is a concrete, specific connection to a listed supplier's country/city OR its materials/HS codes. Examples of concrete: a tariff on the exact material a supplier ships, a typhoon striking the supplier's city, a port strike in the supplier's country affecting its goods.
- A vague, national-scale, or tangential connection is NOT enough. When in doubt, return relevant=false with low confidence.
- confidence is your probability (0.0-1.0) that a busy owner would rate this alert USEFUL. Be honest and calibrated; do not inflate.
- affected_supplier_ids must be a subset of the supplier ids provided. Empty if not relevant.
- severity: "high" = imminent material cost/supply impact; "medium" = likely impact worth acting on; "low" = minor or informational.
- Output JSON only.`;

export async function matchEvent(
  event: RippleEvent,
  suppliers: Supplier[]
): Promise<MatchResult | null> {
  const supplierBlock = suppliers
    .map(
      (s) =>
        `- id=${s.id} | name=${s.name} | country=${s.country ?? ""} | city=${
          s.city ?? ""
        } | materials=${s.materials ?? ""} | hs_codes=${(s.hs_codes ?? []).join(",")}`
    )
    .join("\n");

  const user = `EVENT
type: ${event.event_type}
region: ${event.region ?? "unknown"}
title: ${event.title}
text: ${(event.raw_text ?? "").slice(0, 3000)}

SUPPLIERS
${supplierBlock}`;

  const raw = await groqJson<Partial<MatchResult>>({
    system: MATCH_SYSTEM,
    user,
    temperature: 0.1,
    maxTokens: 512,
  });
  if (!raw || typeof raw.relevant !== "boolean") return null;

  const validIds = new Set(suppliers.map((s) => s.id));
  const ids = Array.isArray(raw.affected_supplier_ids)
    ? raw.affected_supplier_ids.filter((id) => typeof id === "string" && validIds.has(id))
    : [];

  const confidence =
    typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1
      ? raw.confidence
      : 0;

  return {
    relevant: raw.relevant && ids.length > 0,
    affected_supplier_ids: ids,
    severity: coerceSeverity(raw.severity),
    confidence,
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
  };
}

// ---------------------------------------------------------------------------
// Alert writing.
// ---------------------------------------------------------------------------
const WRITE_SYSTEM = `You write a short supply-chain risk alert for a small manufacturer's owner. Plain English, no jargon.

Return STRICT JSON:
{"headline": string, "summary": string, "recommended_action": string}

Rules:
- headline: under 12 words, specific, no clickbait.
- summary: under 100 words, explains what happened and why it matters to THIS supplier. Include effective dates, comment-period deadlines, and dollar impact if provided.
- recommended_action: ONE concrete next step with any relevant date/deadline.
- Use only facts provided. Do not invent numbers, dates, or sources.
- Output JSON only.`;

export async function writeAlert(
  event: RippleEvent,
  supplierNames: string[],
  quantification: string | null
): Promise<WrittenAlert | null> {
  const user = `EVENT
type: ${event.event_type}
region: ${event.region ?? "unknown"}
title: ${event.title}
text: ${(event.raw_text ?? "").slice(0, 3000)}
source_url: ${event.source_url ?? ""}

AFFECTED SUPPLIERS: ${supplierNames.join(", ")}
${quantification ? `\nTARIFF QUANTIFICATION (use verbatim facts):\n${quantification}` : ""}`;

  const raw = await groqJson<Partial<WrittenAlert>>({
    system: WRITE_SYSTEM,
    user,
    temperature: 0.3,
    maxTokens: 512,
  });
  if (!raw) return null;

  return {
    headline:
      typeof raw.headline === "string" && raw.headline.trim()
        ? raw.headline.trim()
        : event.title,
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    recommended_action:
      typeof raw.recommended_action === "string" ? raw.recommended_action.trim() : "",
  };
}
