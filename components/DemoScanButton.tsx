"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoScanButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/demo-scan", { method: "POST" });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError("Demo scan failed. Check that your API keys are configured.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button onClick={run} disabled={running} className="btn-primary">
        {running ? "Running scan…" : "Run demo scan"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
