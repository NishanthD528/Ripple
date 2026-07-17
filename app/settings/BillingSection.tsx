"use client";

import { useState } from "react";
import type { Plan } from "@/lib/types";

export function BillingSection({
  plan,
  hasCustomer,
}: {
  plan: Plan;
  hasCustomer: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go(endpoint: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "failed");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error && err.message === "billing_unavailable"
          ? "Billing is not configured yet."
          : "Could not open billing. Please try again."
      );
      setBusy(false);
    }
  }

  return (
    <section className="card mt-6 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Billing
      </h2>
      {plan === "pro" ? (
        <div className="mt-3">
          <p className="text-sm text-slate-600">
            You&apos;re on <strong>Pro</strong> — 20 suppliers, daily alerts, and
            instant emails.
          </p>
          <button
            onClick={() => go("/api/stripe/portal")}
            disabled={busy || !hasCustomer}
            className="btn-secondary mt-4"
          >
            {busy ? "Opening…" : "Manage subscription"}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-slate-600">
            You&apos;re on the <strong>Free</strong> plan — 5 suppliers, weekly
            digest. Upgrade to Pro for 20 suppliers, daily alerts, and instant
            high-severity emails.
          </p>
          <button
            onClick={() => go("/api/stripe/checkout")}
            disabled={busy}
            className="btn-primary mt-4"
          >
            {busy ? "Opening…" : "Upgrade to Pro — $29/mo"}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
