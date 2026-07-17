import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HTS_HEADINGS, getHeading } from "@/lib/hts-headings";
import { createPublicClient } from "@/lib/supabase/public";
import { recentFrDocsForHeading } from "@/lib/federal-register-search";
import type { HtsRate } from "@/lib/types";

// Revalidate daily; the duty-rate cache and FR docs refresh in the background.
export const revalidate = 86_400;

export function generateStaticParams() {
  const seen = new Set<string>();
  return HTS_HEADINGS.filter((h) => {
    if (seen.has(h.code)) return false;
    seen.add(h.code);
    return true;
  }).map((h) => ({ hts_code: h.code }));
}

export function generateMetadata({
  params,
}: {
  params: { hts_code: string };
}): Metadata {
  const heading = getHeading(params.hts_code);
  if (!heading) return { title: "Tariff lookup" };
  return {
    title: `HS ${heading.code} — ${heading.title}: US duty rate & tariffs`,
    description: `Current US import duty rate and recent tariff actions for HS ${heading.code} (${heading.title}). Free lookup for importers.`,
  };
}

async function getRate(code: string): Promise<HtsRate | null> {
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("hts_rates")
      .select("*")
      .eq("hts_code", code)
      .maybeSingle();
    return (data as HtsRate | null) ?? null;
  } catch {
    return null;
  }
}

export default async function TariffPage({
  params,
}: {
  params: { hts_code: string };
}) {
  const heading = getHeading(params.hts_code);
  if (!heading) notFound();

  const [rate, docs] = await Promise.all([
    getRate(heading.code),
    recentFrDocsForHeading(heading.code, heading.title),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-accent">
            Ripple
          </Link>
          <Link href="/tariffs" className="btn-ghost text-sm">
            All HS codes
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          HS heading {heading.code} · Chapter {heading.chapter}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">
          {heading.title}
        </h1>
        <p className="mt-3 text-slate-600">
          Current US import duty rate and recent trade-policy actions for HS
          heading {heading.code}.
        </p>

        {/* Duty rate */}
        <section className="card mt-8 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Current general duty rate
          </h2>
          {rate?.duty_rate ? (
            <>
              <p className="mt-2 text-4xl font-bold text-ink">{rate.duty_rate}</p>
              {rate.description && (
                <p className="mt-2 text-sm text-slate-600">{rate.description}</p>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Source: USITC Harmonized Tariff Schedule. Cached{" "}
                {new Date(rate.fetched_at).toLocaleDateString()}. This is the
                general (MFN) rate and excludes Section 301 and other special
                duties.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Duty rate not yet cached for this heading. Sign up to have Ripple
              look it up and alert you on changes.
            </p>
          )}
        </section>

        {/* Recent FR docs */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink">
            Recent Federal Register actions
          </h2>
          {docs.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {docs.map((d) => (
                <li key={d.url} className="card p-4">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    {d.title}
                  </a>
                  {d.date && (
                    <p className="mt-1 text-xs text-slate-400">{d.date}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No recent Federal Register documents matched this heading.
            </p>
          )}
        </section>

        {/* CTA */}
        <section className="mt-10 rounded-xl border border-accent-soft bg-teal-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-teal-900">
            Get alerts for HS {heading.code}
          </h2>
          <p className="mt-1 text-sm text-teal-800">
            Ripple watches this code and your suppliers, then emails you the
            dollar impact the day a tariff changes.
          </p>
          <Link href="/login" className="btn-primary mt-4">
            Set up free alerts
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-100">
        <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-slate-500">
          <Link href="/tariffs" className="hover:text-ink">
            ← Browse all HS codes
          </Link>
        </div>
      </footer>
    </div>
  );
}
