import { getUserAndProfile } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/env";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { profile } = await getUserAndProfile();
  const limit = PLAN_LIMITS[profile.plan].maxSuppliers;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <span className="text-lg font-bold tracking-tight text-accent">Ripple</span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">
          Add your suppliers
        </h1>
        <p className="mt-2 text-slate-600">
          Paste your supplier list in any format and we&apos;ll structure it for
          you. Your {profile.plan} plan includes up to {limit} suppliers.
        </p>
        <OnboardingClient limit={limit} />
      </div>
    </div>
  );
}
