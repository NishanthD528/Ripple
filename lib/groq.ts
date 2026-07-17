import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

// Free-tier guardrails.
const MIN_SPACING_MS = 2_000; // >= 2s between calls (protects 30 req/min).
const DAILY_BUDGET = 800; // Stop gracefully well under the 1,000/day hard cap.
const REQUEST_TIMEOUT_MS = 30_000;

/** Thrown when the daily Groq budget is exhausted; the pipeline should stop. */
export class GroqBudgetExceeded extends Error {
  constructor(public readonly calls: number) {
    super(`Groq daily budget exhausted (${calls}/${DAILY_BUDGET})`);
    this.name = "GroqBudgetExceeded";
  }
}

let lastCallAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function today(): string {
  // UTC date, matches the groq_usage.day key.
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically increment today's call counter and return the new total.
 * Returns Infinity-safe fallback of 0 on failure so a transient DB hiccup
 * never wedges the pipeline (spacing + backoff still protect the API).
 */
async function bumpDailyCounter(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("increment_groq_usage", {
      p_day: today(),
    });
    if (error) throw error;
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.warn("[groq] failed to bump daily counter", err);
    return 0;
  }
}

async function enforceSpacing(): Promise<void> {
  const now = Date.now();
  const wait = lastCallAt + MIN_SPACING_MS - now;
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

interface ChatOptions {
  system: string;
  user: string;
  /** Force JSON object output. Default true. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Low-level Groq chat call with rate limiting, daily budget enforcement,
 * a request timeout, one retry, and exponential backoff on 429.
 * Returns the raw assistant message string.
 */
export async function groqChat(opts: ChatOptions): Promise<string> {
  const count = await bumpDailyCounter();
  if (count > DAILY_BUDGET) {
    throw new GroqBudgetExceeded(count);
  }

  await enforceSpacing();

  const body = {
    model: MODEL,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.json === false
      ? {}
      : { response_format: { type: "json_object" as const } }),
    messages: [
      { role: "system" as const, content: opts.system },
      { role: "user" as const, content: opts.user },
    ],
  };

  const maxAttempts = 4; // 1 initial + retries (mostly for 429 backoff).
  let attempt = 0;
  let backoff = 2_000;

  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.groqApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 429) {
        if (attempt >= maxAttempts) {
          throw new Error("Groq rate limited (429) after retries");
        }
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : backoff;
        console.warn(`[groq] 429, backing off ${wait}ms (attempt ${attempt})`);
        await sleep(wait);
        backoff *= 2;
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Groq HTTP ${res.status}: ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Groq returned empty content");
      return content;
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      // Retry once on timeout/network error; otherwise rethrow.
      if (attempt < 2 && (isAbort || err instanceof TypeError)) {
        console.warn(`[groq] transient error, retrying`, err);
        await sleep(backoff);
        backoff *= 2;
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Strip markdown code fences that models sometimes wrap JSON in. */
export function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return s;
}

/**
 * Call Groq and parse the response as JSON. Returns null on any parse failure
 * so callers can skip gracefully rather than crash the pipeline.
 */
export async function groqJson<T>(opts: ChatOptions): Promise<T | null> {
  const raw = await groqChat({ ...opts, json: opts.json ?? true });
  try {
    return JSON.parse(stripFences(raw)) as T;
  } catch (err) {
    console.warn("[groq] JSON parse failed", err, raw.slice(0, 300));
    return null;
  }
}

export { DAILY_BUDGET };
