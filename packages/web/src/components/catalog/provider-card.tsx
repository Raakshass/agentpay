"use client";

import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import type { ProviderAccount } from "@/lib/registry-client";
import {
  agentTypeLabel,
  categoryLabel,
  formatNumber,
  formatUsdcWithSymbol,
} from "@/lib/format";

interface ProviderCardProps {
  provider: ProviderAccount;
  onSelect: (provider: ProviderAccount) => void;
}

export function ProviderCard({ provider, onSelect }: ProviderCardProps) {
  return (
    <Card
      as="button"
      onClick={() => onSelect(provider)}
      ariaLabel={`View ${provider.name} details`}
      className="text-left w-full"
    >
      <div className="p-6 flex flex-col gap-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-text-primary leading-snug">
            {provider.name}
          </h3>
          <ArrowUpRight className="w-4 h-4 text-text-dim shrink-0 mt-1" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge label={categoryLabel(provider.category)} variant="category" />
          <Badge
            label={agentTypeLabel(provider.agentType)}
            variant="agentType"
          />
        </div>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <span className="block font-mono text-xl text-text-primary tracking-tight">
              {formatUsdcWithSymbol(provider.priceUsdc)}
            </span>
            <span className="text-xs text-text-dim">per call</span>
          </div>
          <div className="text-right">
            <span className="block font-mono text-sm text-text-muted">
              {formatNumber(provider.totalCalls)}
            </span>
            <span className="text-xs text-text-dim">calls</span>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <StatusPill active={provider.active} />
        </div>
      </div>
    </Card>
  );
}
