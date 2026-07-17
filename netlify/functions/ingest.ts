import type { Config } from "@netlify/functions";

/**
 * Daily scheduled function. It does not run the heavy pipeline itself — instead
 * it invokes the Next.js /api/ingest route (which has full access to the app's
 * libraries and env) with the shared CRON_SECRET. Schedule is set in the config
 * export below and mirrored in netlify.toml.
 */
export default async function handler(): Promise<Response> {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET ?? "";

  if (!base) {
    console.error("[ingest fn] no site URL available");
    return new Response("no site url", { status: 500 });
  }

  try {
    const res = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const body = await res.text();
    console.log(`[ingest fn] /api/ingest -> ${res.status} ${body.slice(0, 300)}`);
    return new Response(body, { status: res.status });
  } catch (err) {
    console.error("[ingest fn] failed to invoke /api/ingest", err);
    return new Response("invoke failed", { status: 500 });
  }
}

export const config: Config = {
  schedule: "0 9 * * *", // Daily at 09:00 UTC.
};
