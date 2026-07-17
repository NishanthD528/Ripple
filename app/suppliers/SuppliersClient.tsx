"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan, Supplier } from "@/lib/types";

interface Props {
  initial: Supplier[];
  limit: number;
  plan: Plan;
}

type Draft = {
  name: string;
  country: string;
  city: string;
  materials: string;
  hs_codes: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  country: "",
  city: "",
  materials: "",
  hs_codes: "",
};

export function SuppliersClient({ initial, limit }: Props) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const atLimit = suppliers.length >= limit;

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setDraft({
      name: s.name,
      country: s.country ?? "",
      city: s.city ?? "",
      materials: s.materials ?? "",
      hs_codes: (s.hs_codes ?? []).join(", "),
    });
  }

  function draftToPayload(d: Draft) {
    return {
      name: d.name.trim(),
      country: d.country.trim(),
      city: d.city.trim(),
      materials: d.materials.trim(),
      hs_codes: d.hs_codes
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    };
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft)),
      });
      if (!res.ok) throw new Error("save_failed");
      setEditingId(null);
      router.refresh();
      // Optimistic local update.
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...draftToPayload(draft),
                country: draft.country.trim() || null,
                city: draft.city.trim() || null,
                materials: draft.materials.trim() || null,
              }
            : s
        )
      );
    } catch {
      setError("Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this supplier?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } catch {
      setError("Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  async function addSupplier() {
    const payload = draftToPayload(newDraft);
    if (!payload.name) {
      setError("Supplier name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppliers: [payload] }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "add_failed");
      }
      setNewDraft(EMPTY_DRAFT);
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "limit_reached"
          ? `You've reached your plan limit of ${limit} suppliers.`
          : "Could not add supplier."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Materials</th>
              <th className="px-4 py-3 font-semibold">HS codes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {suppliers.map((s) =>
              editingId === s.id ? (
                <tr key={s.id} className="bg-slate-50">
                  <td className="px-4 py-2">
                    <input
                      className="input"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <input
                        className="input"
                        placeholder="Country"
                        value={draft.country}
                        onChange={(e) =>
                          setDraft({ ...draft, country: e.target.value })
                        }
                      />
                      <input
                        className="input"
                        placeholder="City"
                        value={draft.city}
                        onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="input"
                      value={draft.materials}
                      onChange={(e) =>
                        setDraft({ ...draft, materials: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="input"
                      value={draft.hs_codes}
                      onChange={(e) =>
                        setDraft({ ...draft, hs_codes: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => saveEdit(s.id)}
                      disabled={busy}
                      className="mr-2 text-xs font-semibold text-accent hover:underline"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-slate-400 hover:text-ink"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.materials || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {(s.hs_codes ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(s)}
                      className="mr-3 text-xs font-medium text-slate-500 hover:text-ink"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      className="text-xs font-medium text-slate-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add */}
      <div className="mt-4">
        {adding ? (
          <div className="card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Supplier name"
                value={newDraft.name}
                onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input"
                  placeholder="Country"
                  value={newDraft.country}
                  onChange={(e) =>
                    setNewDraft({ ...newDraft, country: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="City"
                  value={newDraft.city}
                  onChange={(e) => setNewDraft({ ...newDraft, city: e.target.value })}
                />
              </div>
              <input
                className="input"
                placeholder="Materials"
                value={newDraft.materials}
                onChange={(e) =>
                  setNewDraft({ ...newDraft, materials: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="HS codes (comma-separated)"
                value={newDraft.hs_codes}
                onChange={(e) =>
                  setNewDraft({ ...newDraft, hs_codes: e.target.value })
                }
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={addSupplier} disabled={busy} className="btn-primary">
                Add
              </button>
              <button onClick={() => setAdding(false)} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            disabled={atLimit}
            className="btn-secondary"
            title={atLimit ? "Plan limit reached" : undefined}
          >
            + Add supplier
          </button>
        )}
      </div>
    </div>
  );
}
