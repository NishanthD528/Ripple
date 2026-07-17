import { NextResponse, type NextRequest } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Netlify scheduled functions allow long runs.

/**
 * Daily ingestion + matching + alerting pipeline. Protected by CRON_SECRET so
 * only the Netlify scheduled function (or an authorised operator) can trigger it.
 */
async function handle(request: NextRequest) {
  const secret = env.cronSecret();
  if (secret) {
    const provided =
      request.headers.get("x-cron-secret") ??
      new URL(request.url).searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runPipeline();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[ingest] pipeline error", err);
    return NextResponse.json(
      { error: "pipeline_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// GET allowed too (Netlify scheduled function uses a plain invocation).
export async function GET(request: NextRequest) {
  return handle(request);
}
