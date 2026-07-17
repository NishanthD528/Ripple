import type { RippleEvent, Supplier } from "@/lib/types";

/** Normalise for loose token matching. */
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

/** Split a free-text materials field into meaningful keywords (len >= 3). */
export function materialKeywords(materials: string | null): string[] {
  return norm(materials)
    .split(/[,;/\n]|\band\b/)
    .flatMap((chunk) => chunk.split(/\s+/))
    .map((w) => w.replace(/[^a-z0-9]/g, "").trim())
    .filter((w) => w.length >= 3);
}

/**
 * Cheapest-first keyword prefilter. An event proceeds to the LLM for a given
 * supplier only if there is a concrete surface-level connection:
 *  - the event region mentions the supplier's country or city, OR
 *  - the event text contains one of the supplier's material keywords, OR
 *  - the event text contains one of the supplier's HS code prefixes (>= 4 digits).
 * Returns the list of suppliers that survive for this event.
 */
export function prefilterSuppliers(
  event: RippleEvent,
  suppliers: Supplier[]
): Supplier[] {
  const haystack = `${norm(event.title)} ${norm(event.raw_text)} ${norm(event.region)}`;
  const region = norm(event.region);

  return suppliers.filter((s) => {
    const country = norm(s.country);
    const city = norm(s.city);

    // Region / geography match.
    if (country && (region.includes(country) || haystack.includes(country))) {
      return true;
    }
    if (city && (region.includes(city) || haystack.includes(city))) {
      return true;
    }

    // Material keyword match.
    if (materialKeywords(s.materials).some((kw) => haystack.includes(kw))) {
      return true;
    }

    // HS code prefix match (4-digit heading or longer).
    for (const code of s.hs_codes) {
      const prefix = code.replace(/\D/g, "").slice(0, 6);
      if (prefix.length >= 4 && haystack.replace(/\D/g, "").includes(prefix)) {
        return true;
      }
    }

    return false;
  });
}
