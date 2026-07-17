# Ripple

AI-powered supply chain risk alerts for small US manufacturers. Ripple watches
public data sources — the Federal Register, trade news, and weather — for
disruptions that touch a user's specific suppliers and materials, then sends
plain-English alerts with a severity score, a dollar impact, and a recommended
action.

Built to run entirely on free tiers: Supabase, Groq, Resend, Netlify, and the
free US government tariff/weather APIs.

---

## Stack

- **Next.js 14** (App Router, TypeScript strict) — deployed on **Netlify**
- **Supabase** — Postgres, magic-link auth, row-level security
- **Groq** (`llama-3.3-70b-versatile`) — supplier parsing, relevance matching, alert writing
- **Resend** — alert emails
- **Stripe** — Free / Pro ($29/mo) subscriptions
- Free data sources: **Federal Register**, **GDELT DOC**, **Open-Meteo**, **USITC HTS**

## Free-tier guardrails (built in)

- **Groq**: a shared rate-limited client (`lib/groq.ts`) enforces ≥2s spacing,
  exponential backoff on 429, and a daily call counter (`groq_usage`) that stops
  the pipeline gracefully at 800 calls/day.
- **Resend**: `lib/resend.ts` counts sends per day (`email_usage`) and defers
  overflow past 100/day instead of erroring.
- **Relevance**: a keyword prefilter (`lib/prefilter.ts`) runs before any LLM
  call so most events never cost a Groq request.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (pipeline, webhooks, seeds) |
| `GROQ_API_KEY` | Groq API key |
| `RESEND_API_KEY` | Resend API key (optional locally) |
| `RESEND_FROM` | From address, e.g. `Ripple <onboarding@resend.dev>` |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Price ID for the $29/mo Pro plan |
| `NEXT_PUBLIC_SITE_URL` | Public base URL (auth + email links) |
| `CRON_SECRET` | Shared secret protecting `/api/ingest` |

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Copy the project URL, anon key, and service-role key into `.env.local`.
3. Run the migration in the SQL editor (or via the Supabase CLI):
   ```
   supabase/migrations/0001_init.sql
   ```
   This creates all tables, RLS policies, the usage counters and their RPC
   helpers, and the trigger that auto-creates a `profiles` row on signup.
4. Under **Authentication → URL Configuration**, add your site URL and
   `<site>/auth/callback` as a redirect URL.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev                  # http://localhost:3000
```

Type-check and build:

```bash
npm run typecheck
npm run build
```

## Seeding

```bash
npm run seed        # inserts 6 realistic demo events (for "Run demo scan")
npm run seed:hts    # prefetches USITC duty rates into the hts_rates cache
```

`npm run seed:hts` populates the public `/tariffs/[hts_code]` SEO pages with
real duty rates. Both scripts are idempotent.

---

## Demo flow (test this end to end)

1. Sign in with a magic link at `/login`.
2. On `/onboarding`, paste any supplier list — e.g.:
   ```
   Shenzhen Metalworks — Shenzhen, China — aluminum extrusions (HS 7604)
   Bao Minh Textiles, Ho Chi Minh City Vietnam, cotton fabric
   Acme Fasteners  Taiwan  steel screws 7318
   ```
   Confirm the parsed table.
3. On `/dashboard`, click **Run demo scan**. The pipeline matches the seeded
   demo events against your suppliers and produces a full alert feed with
   severities, dollar impacts, and recommended actions.
4. Rate alerts **Useful / Not useful**. Precision appears after 5 ratings.
   Two "Not useful" ratings for the same event type + region mutes that
   pattern (see **Settings → Muted alerts**).

---

## Netlify deploy

1. Create a Netlify site named **ripple-hq** linked to this repo.
2. In **Site settings → Environment variables**, mirror every variable from
   `.env.local` (set `NEXT_PUBLIC_SITE_URL` to `https://ripple-hq.netlify.app`).
3. The build uses `@netlify/plugin-nextjs` (see `netlify.toml`).
4. The daily ingestion job is `netlify/functions/ingest.ts`, scheduled at
   `0 9 * * *` (09:00 UTC). It invokes `/api/ingest` with `CRON_SECRET`.
5. Add the Stripe webhook endpoint `https://ripple-hq.netlify.app/api/stripe/webhook`
   in the Stripe dashboard and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

### Triggering ingestion manually

```bash
curl -X POST https://ripple-hq.netlify.app/api/ingest \
  -H "x-cron-secret: $CRON_SECRET"
```

---

## How the pipeline works (`lib/pipeline.ts`)

1. **Ingest** — Federal Register (tariff/trade), GDELT (regional disruption
   news), Open-Meteo (severe weather per supplier city). Deduped by `source_url`.
2. **Prefilter** — per user, an event only survives if its region matches a
   supplier country/city, or its text contains a supplier material keyword or
   HS-code prefix. Suppressed `event_type + region` pairs are skipped.
3. **Match** (Groq) — conservative, precision-first JSON: `relevant`,
   `affected_supplier_ids`, `severity`, `confidence`, `reasoning`. Results below
   `confidence 0.7` are discarded.
4. **Quantify** — for tariff events with HS codes, the current USITC duty rate
   is looked up (and cached) and the dollar impact on a $10,000 order computed.
5. **Write** (Groq) — a <100-word plain-English summary plus one quantified
   recommended action.
6. **Budget** — max 3 new alerts per user per day, ranked by severity then
   confidence. Overflow is dropped.
7. **Email** — only alerts with `confidence ≥ 0.85` and severity medium/high,
   via Resend, respecting the 100/day cap. No qualifying alerts, no email.
8. **Auto-suppression** — a second "Not useful" for the same `event_type +
   region` mutes that pattern until unmuted in Settings.

## Research angle

The matching thresholds (`CONFIDENCE_FLOOR`, `EMAIL_CONFIDENCE`) live at the top
of `lib/pipeline.ts`. The feedback stored on every alert (`alerts.feedback`)
drives the dashboard precision metric and supports the keyword-only vs LLM vs
LLM+HS comparison described in the PRD.

## Project layout

```
app/                     # App Router pages + API routes
  page.tsx               # landing
  login/ onboarding/     # auth + supplier onboarding
  dashboard/ suppliers/ settings/
  tariffs/               # public SEO pages (index + [hts_code])
  api/                   # onboarding parse, suppliers, feedback, demo-scan,
                         # ingest, stripe (checkout/portal/webhook), suppressions
lib/                     # groq, llm, pipeline, sources, hts, prefilter,
                         # resend, stripe, supabase clients, types
netlify/functions/       # ingest.ts (daily scheduled)
scripts/                 # seed.ts, seed-hts.ts
supabase/migrations/     # 0001_init.sql
```
