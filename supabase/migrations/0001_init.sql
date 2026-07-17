-- Ripple initial schema
-- Postgres / Supabase. Enables RLS on all user-owned tables.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, mirrors auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  country text,
  city text,
  materials text,
  hs_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists suppliers_user_id_idx on public.suppliers (user_id);

-- ---------------------------------------------------------------------------
-- events: ingested from public sources. Service-role only.
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_url text,
  title text not null,
  raw_text text,
  event_type text not null check (event_type in ('tariff', 'weather', 'news')),
  region text,
  ingested_at timestamptz not null default now()
);
create unique index if not exists events_source_url_idx
  on public.events (source_url) where source_url is not null;
create index if not exists events_ingested_at_idx on public.events (ingested_at desc);

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  supplier_ids uuid[] not null default '{}',
  severity text not null check (severity in ('low', 'medium', 'high')),
  confidence numeric not null default 0,
  headline text,
  summary text,
  recommended_action text,
  source_url text,
  feedback text check (feedback in ('useful', 'not_useful')),
  emailed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists alerts_user_id_idx on public.alerts (user_id, created_at desc);
-- Prevent duplicate alerts for the same user+event.
create unique index if not exists alerts_user_event_idx
  on public.alerts (user_id, event_id) where event_id is not null;

-- ---------------------------------------------------------------------------
-- suppressions: muted event_type + region per user
-- ---------------------------------------------------------------------------
create table if not exists public.suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  region text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists suppressions_unique_idx
  on public.suppressions (user_id, event_type, region);

-- ---------------------------------------------------------------------------
-- hts_rates: cache of USITC HTS API lookups. Publicly readable for SEO pages.
-- ---------------------------------------------------------------------------
create table if not exists public.hts_rates (
  hts_code text primary key,
  description text,
  duty_rate text,
  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- groq_usage: daily call counter to enforce the free-tier budget.
-- ---------------------------------------------------------------------------
create table if not exists public.groq_usage (
  day date primary key,
  calls integer not null default 0
);

-- ---------------------------------------------------------------------------
-- email_usage: daily send counter to enforce Resend's 100/day cap.
-- ---------------------------------------------------------------------------
create table if not exists public.email_usage (
  day date primary key,
  sends integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Atomic counter helpers (service-role RPC).
-- ---------------------------------------------------------------------------
create or replace function public.increment_groq_usage(p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.groq_usage (day, calls)
  values (p_day, 1)
  on conflict (day) do update set calls = public.groq_usage.calls + 1
  returning calls into new_count;
  return new_count;
end;
$$;

create or replace function public.increment_email_usage(p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.email_usage (day, sends)
  values (p_day, 1)
  on conflict (day) do update set sends = public.email_usage.sends + 1
  returning sends into new_count;
  return new_count;
end;
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.events enable row level security;
alter table public.alerts enable row level security;
alter table public.suppressions enable row level security;
alter table public.hts_rates enable row level security;
alter table public.groq_usage enable row level security;
alter table public.email_usage enable row level security;

-- profiles: owner read/write
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- suppliers: owner CRUD
create policy "suppliers_select_own" on public.suppliers
  for select using (auth.uid() = user_id);
create policy "suppliers_insert_own" on public.suppliers
  for insert with check (auth.uid() = user_id);
create policy "suppliers_update_own" on public.suppliers
  for update using (auth.uid() = user_id);
create policy "suppliers_delete_own" on public.suppliers
  for delete using (auth.uid() = user_id);

-- alerts: owner read + update (feedback). Inserts happen via service role.
create policy "alerts_select_own" on public.alerts
  for select using (auth.uid() = user_id);
create policy "alerts_update_own" on public.alerts
  for update using (auth.uid() = user_id);

-- suppressions: owner CRUD
create policy "suppressions_select_own" on public.suppressions
  for select using (auth.uid() = user_id);
create policy "suppressions_insert_own" on public.suppressions
  for insert with check (auth.uid() = user_id);
create policy "suppressions_delete_own" on public.suppressions
  for delete using (auth.uid() = user_id);

-- hts_rates: publicly readable (SEO pages), writes via service role only.
create policy "hts_rates_public_read" on public.hts_rates
  for select using (true);

-- events, groq_usage, email_usage: no policies => service role only.
-- (RLS enabled with no policy denies all access to anon/authenticated roles.)

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on signup.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
