"use client";

import { Search } from "lucide-react";
import { AGENT_TYPES, CATEGORIES } from "@/lib/registry-enums";

export interface CatalogFilterState {
  search: string;
  category: number | "all";
  agentType: number | "all";
}

interface CatalogFiltersProps {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  resultCount: number;
}

const selectClasses =
  "appearance-none rounded-full bg-bg-card border border-border px-4 py-2 text-sm text-text-muted hover:border-border-hover focus:border-accent focus:outline-none transition-colors cursor-pointer";

export function CatalogFilters({
  value,
  onChange,
  resultCount,
}: CatalogFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative flex-1 min-w-0">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
        <input
          type="text"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Search providers…"
          aria-label="Search providers"
          className="w-full rounded-full bg-bg-card border border-border pl-11 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={value.category}
          onChange={(e) =>
            onChange({
              ...value,
              category:
                e.target.value === "all" ? "all" : Number(e.target.value),
            })
          }
          aria-label="Filter by category"
          className={selectClasses}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={value.agentType}
          onChange={(e) =>
            onChange({
              ...value,
              agentType:
                e.target.value === "all" ? "all" : Number(e.target.value),
            })
          }
          aria-label="Filter by type"
          className={selectClasses}
        >
          <option value="all">All types</option>
          {AGENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <span className="text-sm text-text-dim whitespace-nowrap">
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </span>
      </div>
    </div>
  );
}
