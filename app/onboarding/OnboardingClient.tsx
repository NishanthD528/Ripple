"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedSupplier } from "@/lib/types";

const EMPTY: ParsedSupplier = {
  name: "",
  country: "",
  city: "",
  materials: "",
  hs_codes: [],
};

const PLACEHOLDER = `Paste your supplier list in any format. Spreadsheet rows, an email, bullet points, anything.

For example:
Shenzhen Metalworks — Shenzhen, China — aluminum extrusions, brackets (HS 7604)
Bao Minh Textiles, Ho Chi Minh City Vietnam, cotton fabric
Acme Fasteners  Taiwan  steel screws 7318`;

type Step = "paste" | "confirm";

export function OnboardingClient({ limit }: { limit: number }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("paste");
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<ParsedSupplier[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleParse() {
    setParsing(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const data = (await res.json()) as {
        suppliers?: ParsedSupplier[];
        parseFailed?: boolean;
      };
      const parsed = data.suppliers ?? [];
      setRows(parsed.length > 0 ? parsed : [{ ...EMPTY }]);
      if (data.parseFailed) {
        setError("We couldn't auto-parse that. Add your suppliers manually below.");
      }
      setStep("confirm");
    } catch {
      setRows([{ ...EMPTY }]);
      setError("Parsing failed. Add your suppliers manually below.");
      setStep("confirm");
    } finally {
      setParsing(false);
    }
  }

  function skipToManual() {
    setRows([{ ...EMPTY }]);
    setStep("confirm");
  }

  function updateRow(i: number, field: keyof ParsedSupplier, value: string) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        if (field === "hs_codes") {
          return {
            ...r,
            hs_codes: value
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
          };
        }
        return { ...r, [field]: value };
      })
    );
  }

  function addRow() {
    if (rows.length >= limit) return;
    setRows((prev) => [...prev, { ...EMPTY }]);
  }

  function deleteRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleConfirm() {
    const valid = rows.filter((r) => r.name.trim());
    if (valid.length === 0) {
      setError("Add at least one supplier with a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppliers: valid }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "save_failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "limit_reached"
          ? `You've reached your plan limit of ${limit} suppliers.`
          : "Could not save. Please try again."
      );
      setSaving(false);
    }
  }

  if (step === "paste") {
    return (
      <div className="mt-8">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={12}
          className="input font-mono text-sm"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleParse}
            disabled={parsing || !rawText.trim()}
            className="btn-primary"
          >
            {parsing ? "Parsing…" : "Parse suppliers"}
          </button>
          <button onClick={skipToManual} className="btn-ghost">
            Add manually instead
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="mb-3 text-sm text-slate-600">
        Review and edit the parsed suppliers, then confirm. ({rows.length}/{limit})
      </p>
      {error && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Supplier name</label>
                <input
                  className="input"
                  value={row.name}
                  onChange={(e) => updateRow(i, "name", e.target.value)}
                  placeholder="Shenzhen Metalworks"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Country</label>
                  <input
                    className="input"
                    value={row.country}
                    onChange={(e) => updateRow(i, "country", e.target.value)}
                    placeholder="China"
                  />
                </div>
                <div>
                  <label className="label">City</label>
                  <input
                    className="input"
                    value={row.city}
                    onChange={(e) => updateRow(i, "city", e.target.value)}
                    placeholder="Shenzhen"
                  />
                </div>
              </div>
              <div>
                <label className="label">Materials</label>
                <input
                  className="input"
                  value={row.materials}
                  onChange={(e) => updateRow(i, "materials", e.target.value)}
                  placeholder="aluminum extrusions, brackets"
                />
              </div>
              <div>
                <label className="label">HS codes (comma-separated)</label>
                <input
                  className="input"
                  value={row.hs_codes.join(", ")}
                  onChange={(e) => updateRow(i, "hs_codes", e.target.value)}
                  placeholder="7604, 7606"
                />
              </div>
            </div>
            <div className="mt-2 text-right">
              <button
                onClick={() => deleteRow(i)}
                className="text-xs font-medium text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={addRow}
          disabled={rows.length >= limit}
          className="btn-secondary"
        >
          + Add supplier
        </button>
        <button onClick={handleConfirm} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Confirm & continue"}
        </button>
        <button onClick={() => setStep("paste")} className="btn-ghost">
          Back
        </button>
      </div>
    </div>
  );
}
