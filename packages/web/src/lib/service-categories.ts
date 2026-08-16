/**
 * Display metadata for the gateway catalog's service categories.
 * Maps the gateway's category slugs to human labels, icons, and accent
 * colours used across the live services page.
 */

import { Radio, Coins, LineChart, Boxes, type LucideIcon } from "lucide-react";

export interface CategoryMeta {
  label: string;
  /** Icon representing the category. */
  icon: LucideIcon;
  /** Tailwind classes for the category badge. */
  badgeClass: string;
  /** Tailwind classes for the icon chip on the card. */
  iconClass: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  depin: {
    label: "DePIN",
    icon: Radio,
    badgeClass: "bg-accent/15 text-accent border-accent/40",
    iconClass: "text-accent bg-accent/10 border-accent/25",
  },
  "blockchain-data": {
    label: "Blockchain Data",
    icon: Coins,
    badgeClass: "bg-cyan-400/15 text-cyan-300 border-cyan-400/40",
    iconClass: "text-cyan-300 bg-cyan-400/10 border-cyan-400/25",
  },
  "market-data": {
    label: "Market Data",
    icon: LineChart,
    badgeClass: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
    iconClass: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25",
  },
};

const FALLBACK: CategoryMeta = {
  label: "Service",
  icon: Boxes,
  badgeClass: "bg-white/5 text-text-muted border-border",
  iconClass: "text-text-muted bg-white/5 border-border",
};

export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? { ...FALLBACK, label: slug };
}

/** Ordered, de-duplicated category slugs present in a set of services. */
export function categoriesFrom(slugs: string[]): string[] {
  return Array.from(new Set(slugs));
}
