import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/env";
import type { ParsedSupplier, Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

function sanitize(raw: unknown): ParsedSupplier | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const hs = Array.isArray(r.hs_codes)
    ? r.hs_codes.filter((c): c is string => typeof c === "string").map((c) => c.trim()).filter(Boolean)
    : [];
  return {
    name,
    country: typeof r.country === "string" ? r.country.trim() : "",
    city: typeof r.city === "string" ? r.city.trim() : "",
    materials: typeof r.materials === "string" ? r.materials.trim() : "",
    hs_codes: hs,
  };
}

/** Bulk-create suppliers (from onboarding confirmation). Enforces plan limits. */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let incoming: ParsedSupplier[] = [];
  try {
    const body = (await request.json()) as { suppliers?: unknown };
    if (Array.isArray(body.suppliers)) {
      incoming = body.suppliers
        .map(sanitize)
        .filter((s): s is ParsedSupplier => s !== null);
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (incoming.length === 0) {
    return NextResponse.json({ error: "no_suppliers" }, { status: 400 });
  }

  // Determine plan limit and existing count.
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const plan = ((profile?.plan as Plan) ?? "free") as Plan;
  const limit = PLAN_LIMITS[plan].maxSuppliers;

  const { count: existing } = await supabase
    .from("suppliers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const room = Math.max(0, limit - (existing ?? 0));
  const toInsert = incoming.slice(0, room);

  if (toInsert.length === 0) {
    return NextResponse.json(
      { error: "limit_reached", limit, plan },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("suppliers").insert(
    toInsert.map((s) => ({
      user_id: user.id,
      name: s.name,
      country: s.country || null,
      city: s.city || null,
      materials: s.materials || null,
      hs_codes: s.hs_codes,
    }))
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: toInsert.length,
    skipped: incoming.length - toInsert.length,
    limit,
    plan,
  });
}
