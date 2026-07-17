"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Suppression } from "@/lib/types";

export function MutedAlerts({ initial }: { initial: Suppression[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Suppression[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function unmute(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/suppressions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((s) => s.id !== id));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card mt-6 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Muted alerts
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No muted patterns. When you rate two alerts of the same type and region
          &ldquo;Not useful,&rdquo; Ripple mutes that pattern here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-3">
              <span className="text-sm text-ink">
                <span className="font-medium capitalize">{s.event_type}</span>{" "}
                alerts for <span className="font-medium">{s.region}</span>
              </span>
              <button
                onClick={() => unmute(s.id)}
                disabled={busy === s.id}
                className="text-xs font-semibold text-accent hover:underline"
              >
                {busy === s.id ? "Unmuting…" : "Unmute"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
