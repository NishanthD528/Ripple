/**
 * Public Federal Register search used by the SEO tariff pages to show recent
 * documents touching a given HS heading or chapter. Live-fetched with Next's
 * fetch cache (revalidated daily) so the pages stay statically servable.
 */
export interface FrDoc {
  title: string;
  url: string;
  date: string;
}

const FR_URL = "https://www.federalregister.gov/api/v1/documents.json";

export async function recentFrDocsForHeading(
  code: string,
  headingTitle: string
): Promise<FrDoc[]> {
  const term = `tariff ${code} ${headingTitle}`;
  const params = new URLSearchParams();
  params.set("conditions[term]", term);
  params.set("per_page", "5");
  params.set("order", "newest");
  for (const f of ["title", "html_url", "publication_date"]) {
    params.append("fields[]", f);
  }

  try {
    const res = await fetch(`${FR_URL}?${params.toString()}`, {
      // Revalidate daily; keeps the page static + fresh.
      next: { revalidate: 86_400 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: { title?: string; html_url?: string; publication_date?: string }[];
    };
    return (json.results ?? [])
      .filter((r) => r.html_url && r.title)
      .map((r) => ({
        title: r.title ?? "",
        url: r.html_url ?? "",
        date: r.publication_date ?? "",
      }));
  } catch {
    return [];
  }
}
