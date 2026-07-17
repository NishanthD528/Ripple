import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/env";
import { AppNav } from "@/components/AppNav";
import { SuppliersClient } from "./SuppliersClient";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { userId, email, profile } = await getUserAndProfile();
  const supabase = createClient();

  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const suppliers = (data ?? []) as Supplier[];
  const limit = PLAN_LIMITS[profile.plan].maxSuppliers;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav email={email} plan={profile.plan} />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink">Suppliers</h1>
            <p className="text-sm text-slate-500">
              {suppliers.length} of {limit} on your {profile.plan} plan
            </p>
          </div>
        </div>
        <SuppliersClient
          initial={suppliers}
          limit={limit}
          plan={profile.plan}
        />
      </main>
    </div>
  );
}
