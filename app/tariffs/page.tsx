import type { Metadata } from "next";
import Link from "next/link";
import { HTS_HEADINGS } from "@/lib/hts-headings";

export const metadata: Metadata = {
  title: "US import tariff & duty rate lookup by HS code",
  description:
    "Look up current US import duty rates and recent tariff actions by Harmonized System (HS) code. Free tariff lookup for manufacturers and importers.",
};

// Dedupe headings by code and group by chapter.
function uniqueHeadings() {
  const seen = new Set<string>();
  const out = HTS_HEADINGS.filter((h) => {
    if (seen.has(h.code)) return false;
    seen.add(h.code);
    return true;
  });
  const byChapter = new Map<string, typeof out>();
  for (const h of out) {
    const arr = byChapter.get(h.chapter) ?? [];
    arr.push(h);
    byChapter.set(h.chapter, arr);
  }
  return [...byChapter.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default function TariffsIndex() {
  const groups = uniqueHeadings();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-accent">
            Ripple
          </Link>
          <Link href="/login" className="btn-primary">
            Get tariff alerts
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          US import tariff lookup by HS code
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Current US duty rates and recent Federal Register tariff actions for
          common manufacturing imports. Find your Harmonized System heading below.
        </p>

        <div className="mt-10 space-y-10">
          {groups.map(([chapter, headings]) => (
            <section key={chapter}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Chapter {chapter}
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {headings.map((h) => (
                  <Link
                    key={h.code}
                    href={`/tariffs/${h.code}`}
                    className="card px-4 py-3 transition-colors hover:border-accent"
                  >
                    <span className="text-sm font-semibold text-ink">{h.code}</span>
                    <span className="ml-2 text-sm text-slate-600">{h.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
