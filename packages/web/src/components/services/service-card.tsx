"use client";

import { Card } from "@/components/ui/card";
import { formatUsdcWithSymbol } from "@/lib/format";
import { categoryMeta } from "@/lib/service-categories";
import type { CatalogService } from "@/hooks/use-catalog";

interface ServiceCardProps {
  service: CatalogService;
}

/**
 * A single live service from the gateway catalog: name, category, description,
 * and real per-call price. The "Try it" playground is layered on in a later
 * step via the children slot.
 */
export function ServiceCard({ service }: ServiceCardProps) {
  const cat = categoryMeta(service.category);

  return (
    <Card hoverable={false} className="h-full">
      <div className="p-6 flex flex-col gap-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-text-primary leading-snug">
            {service.displayName}
          </h3>
          <span
            className={[
              "inline-flex items-center shrink-0",
              "px-2.5 py-0.5 rounded-full border",
              "text-xs font-medium tracking-wide",
              cat.badgeClass,
            ].join(" ")}
          >
            {cat.label}
          </span>
        </div>

        <p className="text-sm text-text-muted leading-relaxed">
          {service.description}
        </p>

        <div className="mt-auto flex items-end justify-between pt-2 border-t border-border">
          <div>
            <span className="block font-mono text-xl text-text-primary tracking-tight">
              {formatUsdcWithSymbol(service.pricing.perRequestAtomic)}
            </span>
            <span className="text-xs text-text-dim">
              per call · {service.pricing.currency}
            </span>
          </div>
          <code className="text-xs text-text-dim font-mono truncate max-w-[45%] text-right">
            {service.endpoint}
          </code>
        </div>
      </div>
    </Card>
  );
}
