import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Feedback } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Record Useful / Not Useful feedback on an alert. Implements auto-suppression:
 * when a user marks a SECOND alert Not Useful sharing the same event_type +
 * region, a suppression is created for that pattern.
 */
export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let alertId = "";
  let feedback: Feedback | null = null;
  try {
    const body = (await request.json()) as { alertId?: string; feedback?: string };
    alertId = typeof body.alertId === "string" ? body.alertId : "";
    if (body.feedback === "useful" || body.feedback === "not_useful") {
      feedback = body.feedback;
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!alertId || !feedback) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Update the alert (RLS ensures ownership).
  const { data: updated, error } = await supabase
    .from("alerts")
    .update({ feedback })
    .eq("id", alertId)
    .eq("user_id", user.id)
    .select("id, event_id")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let suppressed: { event_type: string; region: string } | null = null;

  if (feedback === "not_useful" && updated.event_id) {
    // The events table is service-role only, so read it with the admin client.
    // Ownership was already verified by the alert update above.
    const admin = createAdminClient();

    const { data: event } = await admin
      .from("events")
      .select("event_type, region")
      .eq("id", updated.event_id)
      .maybeSingle();

    if (event?.event_type && event.region) {
      // Count how many not_useful alerts this user has for the same pattern.
      const { data: siblings } = await admin
        .from("alerts")
        .select("event_id, events!inner(event_type, region)")
        .eq("user_id", user.id)
        .eq("feedback", "not_useful")
        .eq("events.event_type", event.event_type)
        .eq("events.region", event.region);

      const patternCount = siblings?.length ?? 0;
      if (patternCount >= 2) {
        const { error: supErr } = await admin.from("suppressions").insert({
          user_id: user.id,
          event_type: event.event_type,
          region: event.region,
        });
        // Ignore unique-violation (already suppressed).
        if (!supErr) {
          suppressed = { event_type: event.event_type, region: event.region };
        }
      }
    }
  }

  return NextResponse.json({ ok: true, suppressed });
}
