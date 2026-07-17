import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSuppliers } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawText = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    rawText = typeof body.text === "string" ? body.text : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!rawText.trim()) {
    return NextResponse.json({ suppliers: [] });
  }

  try {
    const suppliers = await parseSuppliers(rawText);
    return NextResponse.json({ suppliers });
  } catch (err) {
    console.warn("[onboarding/parse] failed", err);
    // Graceful fallback: return empty so the UI shows the manual add form.
    return NextResponse.json({ suppliers: [], parseFailed: true });
  }
}
