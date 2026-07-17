import { Resend } from "resend";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const DAILY_EMAIL_CAP = 100; // Resend free tier.

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Send an email, enforcing the Resend 100/day free-tier cap. Returns a status
 * object rather than throwing so the pipeline never crashes on email issues.
 * When the cap is reached, the send is deferred (skipped) — never errored.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = env.resendApiKey();
  if (!apiKey) {
    return { sent: false, reason: "no_api_key" };
  }

  // Reserve a slot in today's counter before sending.
  let count = 0;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("increment_email_usage", {
      p_day: today(),
    });
    if (error) throw error;
    count = typeof data === "number" ? data : 0;
  } catch (err) {
    console.warn("[resend] failed to bump email counter", err);
  }

  if (count > DAILY_EMAIL_CAP) {
    console.warn(`[resend] daily cap reached (${count}), deferring send`);
    return { sent: false, reason: "daily_cap" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: env.resendFrom(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.warn("[resend] send error", error);
      return { sent: false, reason: "send_error" };
    }
    return { sent: true };
  } catch (err) {
    console.warn("[resend] send threw", err);
    return { sent: false, reason: "exception" };
  }
}

export { DAILY_EMAIL_CAP };
