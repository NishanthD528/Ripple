"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SeverityBadge } from "@/components/SeverityBadge";
import type { Alert, Feedback } from "@/lib/types";

interface Props {
  alert: Alert;
  supplierNames: string[];
}

export function AlertCard({ alert, supplierNames }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback | null>(alert.feedback);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function rate(value: Feedback) {
    if (saving) return;
    setSaving(true);
    const previous = feedback;
    setFeedback(value);
    try {
      const res = await fetch("/api/alerts/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: alert.id, feedback: value }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        suppressed?: { event_type: string; region: string } | null;
      };
      if (!res.ok) throw new Error("failed");
      if (data.suppressed) {
        setToast(
          `Muted ${data.suppressed.event_type} alerts for ${data.suppressed.region}. Unmute in Settings.`
        );
      }
      router.refresh();
    } catch {
      setFeedback(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <SeverityBadge severity={alert.severity} />
        <span className="text-xs text-slate-400">
          {new Date(alert.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          {typeof alert.confidence === "number"
            ? ` · ${Math.round(alert.confidence * 100)}% confidence`
            : ""}
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold text-ink">
        {alert.headline ?? "Alert"}
      </h3>

      {supplierNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {supplierNames.map((n) => (
            <span
              key={n}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {n}
            </span>
          ))}
        </div>
      )}

      {alert.summary && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {alert.summary}
        </p>
      )}

      {alert.recommended_action && (
        <div className="mt-4 rounded-lg border border-accent-soft bg-teal-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Recommended action
          </p>
          <p className="mt-1 text-sm text-teal-900">{alert.recommended_action}</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div>
          {alert.source_url && (
            <a
              href={alert.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-accent hover:underline"
            >
              View source →
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => rate("useful")}
            disabled={saving}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
              feedback === "useful"
                ? "border-accent bg-accent-soft text-accent"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            Useful
          </button>
          <button
            onClick={() => rate("not_useful")}
            disabled={saving}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
              feedback === "not_useful"
                ? "border-red-300 bg-red-50 text-red-600"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            Not useful
          </button>
        </div>
      </div>

      {toast && (
        <p className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white">
          {toast}
        </p>
      )}
    </div>
  );
}
