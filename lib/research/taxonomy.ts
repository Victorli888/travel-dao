/**
 * The Notion category tree. Lives as data rather than prose so the prompt,
 * and eventually the UI, read from one source.
 */
export const TAXONOMY = {
  "Good Eats": ["Cafes", "Restaurants", "Dessert", "Other"],
  "Shopping & Markets": [
    "Souvenirs",
    "Fashion",
    "Sports",
    "2nd Hand",
    "Beauty",
    "Tech",
    "Food & Consumables",
    "Luxury",
    "Market and Bazaars",
  ],
  Activities: [
    "Cultural & Historical Experiences",
    "Outdoor & Nature",
    "Sightseeing & Landmarks",
    "Relaxation & Wellness",
    "Entertainment & Night Life",
  ],
} as const;

export type Taxonomy = Record<string, readonly string[]>;
export type TopLevelCategory = keyof typeof TAXONOMY;

/** Renders the tree as the bolded markdown list the system prompt expects. */
export function renderTaxonomy(taxonomy: Taxonomy = TAXONOMY): string {
  return Object.entries(taxonomy)
    .map(([category, subs]) =>
      [`**${category}**`, ...subs.map((s) => `- ${s}`)].join("\n")
    )
    .join("\n\n");
}
