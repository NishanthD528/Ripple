import type { Severity } from "@/lib/types";

const STYLES: Record<Severity, string> = {
  low: "bg-sky-50 text-severity-low border-sky-200",
  medium: "bg-amber-50 text-severity-medium border-amber-200",
  high: "bg-red-50 text-severity-high border-red-200",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}
