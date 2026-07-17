import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { BillingSection } from "./BillingSection";
import { MutedAlerts } from "./MutedAlerts";
import type { Suppression } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId, email, profile } = await getUserAndProfile();
  const supabase = createClient();

  const { data } = await supabase
    .from("suppressions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const suppressions = (data ?? []) as Suppression[];

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav email={email} plan={profile.plan} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-lg font-semibold text-ink">Settings</h1>

        {/* Account */}
        <section className="card mt-6 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Account
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-ink">{email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-medium capitalize text-ink">{profile.plan}</dd>
            </div>
          </dl>
        </section>

        {/* Billing */}
        <BillingSection
          plan={profile.plan}
          hasCustomer={Boolean(profile.stripe_customer_id)}
        />

        {/* Email preferences */}
        <section className="card mt-6 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Email preferences
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            {profile.plan === "pro"
              ? "You receive instant emails for high-confidence, medium/high-severity alerts, plus a daily digest. Ripple never sends filler — no qualifying alerts means no email."
              : "You receive a weekly digest of qualifying alerts. Upgrade to Pro for daily alerts and instant emails on high-severity events."}
          </p>
        </section>

        {/* Muted alerts */}
        <MutedAlerts initial={suppressions} />
      </main>
    </div>
  );
}
