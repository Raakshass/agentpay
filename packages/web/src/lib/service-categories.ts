/**
 * Display metadata for the gateway catalog's service categories.
 * Maps the gateway's category slugs to human labels + accent colours used
 * across the live services page.
 */

export interface CategoryMeta {
  label: string;
  /** Tailwind classes for the category badge. */
  badgeClass: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  depin: {
    label: "DePIN",
    badgeClass: "bg-accent/15 text-accent border-accent/40",
  },
  "blockchain-data": {
    label: "Blockchain Data",
    badgeClass: "bg-cyan-400/15 text-cyan-300 border-cyan-400/40",
  },
  "market-data": {
    label: "Market Data",
    badgeClass: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  },
};

const FALLBACK: CategoryMeta = {
  label: "Service",
  badgeClass: "bg-white/5 text-text-muted border-border",
};

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? { ...FALLBACK, label: slug };
}

/** Ordered, de-duplicated category slugs present in a set of services. */
export function categoriesFrom(slugs: string[]): string[] {
  return Array.from(new Set(slugs));
}
