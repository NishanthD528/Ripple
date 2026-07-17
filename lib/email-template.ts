import type { Severity } from "@/lib/types";
import { env } from "@/lib/env";

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#0369a1",
  medium: "#b45309",
  high: "#b91c1c",
};

export function alertEmailHtml(opts: {
  headline: string;
  summary: string;
  recommendedAction: string;
  severity: Severity;
  supplierNames: string[];
  sourceUrl: string | null;
}): string {
  const color = SEVERITY_COLOR[opts.severity];
  const dashboardUrl = `${env.siteUrl()}/dashboard`;
  const suppliers = opts.supplierNames.join(", ");

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:15px;font-weight:700;color:#0f766e;letter-spacing:-0.01em;">Ripple</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:4px 10px;border-radius:999px;">${opts.severity}</span>
          <h1 style="margin:16px 0 8px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(opts.headline)}</h1>
          <p style="margin:0 0 16px;font-size:12px;color:#64748b;">Affected supplier(s): ${escapeHtml(suppliers)}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1e293b;">${escapeHtml(opts.summary)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;">
            <tr><td style="padding:16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#0f766e;">Recommended action</p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#134e4a;">${escapeHtml(opts.recommendedAction)}</p>
            </td></tr>
          </table>
          <div style="margin-top:24px;">
            <a href="${dashboardUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Open dashboard</a>
            ${
              opts.sourceUrl
                ? `<a href="${opts.sourceUrl}" style="display:inline-block;margin-left:12px;color:#0f766e;text-decoration:none;font-size:14px;font-weight:600;padding:10px 4px;">View source &rarr;</a>`
                : ""
            }
          </div>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">You receive Ripple alerts because you monitor suppliers with us. Manage preferences in your dashboard settings.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
