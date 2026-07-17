import Link from "next/link";
import { SeverityBadge } from "@/components/SeverityBadge";

function Logo() {
  return (
    <span className="text-lg font-bold tracking-tight text-accent">Ripple</span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link href="/tariffs" className="btn-ghost">
              Tariff lookup
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
            <Link href="/login" className="btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">
          Supply chain risk, in plain English
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Know about supply chain problems before they cost you.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Ripple watches tariff changes, weather, and news for your exact
          suppliers and materials, then emails you a plain-English alert with a
          dollar impact and a recommended action. Built for small US
          manufacturers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/login" className="btn-primary px-6 py-3 text-base">
            Start monitoring free
          </Link>
          <Link href="/tariffs" className="btn-secondary px-6 py-3 text-base">
            Browse tariff pages
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Free plan, no card required. Set up in under 2 minutes.
        </p>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-ink">
            How it works
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Paste your supplier list",
                body: "Any format — a spreadsheet, an email thread, bullet points. We parse it into structured records you confirm in seconds.",
              },
              {
                step: "2",
                title: "We monitor the sources",
                body: "Every day Ripple scans the Federal Register, trade news, and weather for anything touching your suppliers' countries and materials.",
              },
              {
                step: "3",
                title: "You get precise alerts",
                body: "Only concrete, specific risks reach you — with severity, a dollar impact, and one clear next step. No noise, no filler.",
              },
            ].map((s) => (
              <div key={s.step} className="card p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {s.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example alert */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-ink">
          What an alert looks like
        </h2>
        <div className="mx-auto mt-8 max-w-2xl">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <SeverityBadge severity="high" />
              <span className="text-xs text-slate-400">Tariff · Federal Register</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-ink">
              Proposed Section 301 tariff on aluminum extrusions from China
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                Shenzhen Metalworks
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A proposed action would raise the duty on your aluminum extrusions
              (HS 7604) from 2.5% to a proposed 27.5%. On a $10,000 order that is
              an added cost of about $2,500. The public comment period closes in
              21 days.
            </p>
            <div className="mt-4 rounded-lg border border-accent-soft bg-teal-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Recommended action
              </p>
              <p className="mt-1 text-sm text-teal-900">
                Request a firm quote from your supplier locking current pricing
                before the effective date, and file a comment before the deadline.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-ink">
            Simple pricing
          </h2>
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
            <div className="card p-8">
              <h3 className="text-lg font-semibold text-ink">Free</h3>
              <p className="mt-2 text-3xl font-bold text-ink">
                $0<span className="text-base font-normal text-slate-500">/mo</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li>Up to 5 suppliers</li>
                <li>Weekly digest</li>
                <li>In-app alert feed</li>
                <li>Tariff dollar-impact quantification</li>
              </ul>
              <Link href="/login" className="btn-secondary mt-8 w-full">
                Start free
              </Link>
            </div>
            <div className="card border-accent p-8 ring-1 ring-accent">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink">Pro</h3>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                  Most popular
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold text-ink">
                $29<span className="text-base font-normal text-slate-500">/mo</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li>Up to 20 suppliers</li>
                <li>Daily alerts</li>
                <li>Instant email on high-severity events</li>
                <li>Everything in Free</li>
              </ul>
              <Link href="/login" className="btn-primary mt-8 w-full">
                Start Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-slate-500 sm:flex-row">
          <Logo />
          <div className="flex gap-6">
            <Link href="/tariffs" className="hover:text-ink">
              Tariff lookup
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </div>
          <p>© {new Date().getFullYear()} Ripple</p>
        </div>
      </footer>
    </div>
  );
}
