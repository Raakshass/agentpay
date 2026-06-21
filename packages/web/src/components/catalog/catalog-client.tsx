"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { useRegistry } from "@/hooks/use-registry";
import type { ProviderAccount } from "@/lib/registry-client";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ProviderCard } from "./provider-card";
import { ProviderDrawer } from "./provider-drawer";
import { EmptyState } from "./empty-state";
import {
  CatalogFilters,
  type CatalogFilterState,
} from "./catalog-filters";

const INITIAL_FILTERS: CatalogFilterState = {
  search: "",
  category: "all",
  agentType: "all",
};

export function CatalogClient() {
  const { providers, loading, usingMock } = useRegistry();
  const [filters, setFilters] = useState<CatalogFilterState>(INITIAL_FILTERS);
  const [selected, setSelected] = useState<ProviderAccount | null>(null);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return providers.filter((p) => {
      if (filters.category !== "all" && p.category !== filters.category)
        return false;
      if (filters.agentType !== "all" && p.agentType !== filters.agentType)
        return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [providers, filters]);

  return (
    <div className="space-y-8">
      {usingMock && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-card px-4 py-3 text-sm text-text-muted"
          role="status"
        >
          <Info className="w-4 h-4 text-accent shrink-0" />
          <span>
            Showing demo data — the registry program isn&apos;t deployed (or is
            empty) on this cluster. Deploy it and register a provider to see
            live results.
          </span>
        </div>
      )}

      <CatalogFilters
        value={filters}
        onChange={setFilters}
        resultCount={filtered.length}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <ProviderCard
              key={p.address}
              provider={p}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      <ProviderDrawer provider={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
