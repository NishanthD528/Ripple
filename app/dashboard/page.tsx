import { redirect } from "next/navigation";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { AlertCard } from "@/components/AlertCard";
import { DemoScanButton } from "@/components/DemoScanButton";
import type { Alert, Severity, Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export default async function DashboardPage() {
  const { userId, email, profile } = await getUserAndProfile();
  const supabase = createClient();

  const [{ data: supplierRows }, { data: alertRows }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("user_id", userId),
    supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const suppliers = (supplierRows ?? []) as Supplier[];
  // New users with no suppliers should finish onboarding first.
  if (suppliers.length === 0) redirect("/onboarding");

  const alerts = (alertRows ?? []) as Alert[];
  const supplierById = new Map(suppliers.map((s) => [s.id, s.name]));

  // Sort: severity desc, then recency.
  const sorted = [...alerts].sort((a, b) => {
    const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (s !== 0) return s;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const highOpen = alerts.filter(
    (a) => a.severity === "high" && a.feedback !== "not_useful"
  ).length;

  const rated = alerts.filter((a) => a.feedback !== null);
  const useful = alerts.filter((a) => a.feedback === "useful").length;
  const precision =
    rated.length >= 5 ? Math.round((useful / rated.length) * 100) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav email={email} plan={profile.plan} />
      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Summary bar */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Suppliers monitored" value={String(suppliers.length)} />
          <Stat label="Open high-severity alerts" value={String(highOpen)} />
          <Stat
            label="Alert precision"
            value={precision !== null ? `${precision}%` : "—"}
            hint={precision === null ? `${rated.length}/5 rated` : "of alerts rated useful"}
          />
        </div>

        {/* Feed */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-ink">Alert feed</h2>

          {sorted.length === 0 ? (
            <div className="card mt-4 p-8 text-center">
              <p className="text-base font-semibold text-ink">Monitoring active.</p>
              <p className="mt-1 text-sm text-slate-600">
                Your first scan runs tonight. Want to see it now?
              </p>
              <div className="mt-4 flex justify-center">
                <DemoScanButton />
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {sorted.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  supplierNames={alert.supplier_ids
                    .map((id) => supplierById.get(id))
                    .filter((n): n is string => Boolean(n))}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
