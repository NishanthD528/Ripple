export type Plan = "free" | "pro";
export type Severity = "low" | "medium" | "high";
export type EventType = "tariff" | "weather" | "news";
export type Feedback = "useful" | "not_useful";

export interface Profile {
  id: string;
  email: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  country: string | null;
  city: string | null;
  materials: string | null;
  hs_codes: string[];
  created_at: string;
}

export interface RippleEvent {
  id: string;
  source: string;
  source_url: string | null;
  title: string;
  raw_text: string | null;
  event_type: EventType;
  region: string | null;
  ingested_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  event_id: string | null;
  supplier_ids: string[];
  severity: Severity;
  confidence: number;
  headline: string | null;
  summary: string | null;
  recommended_action: string | null;
  source_url: string | null;
  feedback: Feedback | null;
  emailed: boolean;
  created_at: string;
}

export interface Suppression {
  id: string;
  user_id: string;
  event_type: string;
  region: string;
  created_at: string;
}

export interface HtsRate {
  hts_code: string;
  description: string | null;
  duty_rate: string | null;
  fetched_at: string;
}

/** Parsed supplier record produced by the onboarding LLM parse. */
export interface ParsedSupplier {
  name: string;
  country: string;
  city: string;
  materials: string;
  hs_codes: string[];
}

/** Shape returned by the relevance-matching LLM call. */
export interface MatchResult {
  relevant: boolean;
  affected_supplier_ids: string[];
  severity: Severity;
  confidence: number;
  reasoning: string;
}

/** Shape returned by the alert-writing LLM call. */
export interface WrittenAlert {
  headline: string;
  summary: string;
  recommended_action: string;
}
