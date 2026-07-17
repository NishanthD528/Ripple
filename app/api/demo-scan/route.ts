import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_EVENTS } from "@/lib/demo-events";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ensure demo events exist, then run the pipeline for the current user against
 * only those events. Produces a full alert feed instantly for demos.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Upsert demo events, collecting their ids.
  const eventIds: string[] = [];
  for (const e of DEMO_EVENTS) {
    const { data: existing } = await admin
      .from("events")
      .select("id")
      .eq("source_url", e.source_url)
      .maybeSingle();

    if (existing) {
      eventIds.push(existing.id as string);
      continue;
    }
    const { data: inserted } = await admin
      .from("events")
      .insert(e)
      .select("id")
      .single();
    if (inserted) eventIds.push(inserted.id as string);
  }

  try {
    const result = await runPipeline({
      demo: true,
      userId: user.id,
      eventIds,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[demo-scan] failed", err);
    return NextResponse.json(
      { error: "pipeline_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
