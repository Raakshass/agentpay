"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Power, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { TxStatus } from "@/components/ui/tx-status";
import { Skeleton } from "@/components/ui/skeleton";
import { useSendIx } from "@/hooks/use-send-ix";
import {
  buildDeregisterProviderIx,
  buildUpdateProviderIx,
  type ProviderAccount,
} from "@/lib/registry-client";
import { agentTypeLabel, categoryLabel, formatUsdc } from "@/lib/format";

interface MyProvidersProps {
  providers: ProviderAccount[];
  loading: boolean;
  error: string | null;
  onChanged: () => void;
}

function ProviderRow({
  provider,
  onChanged,
}: {
  provider: ProviderAccount;
  onChanged: () => void;
}) {
  const { publicKey } = useWallet();
  const { state, signature, error, send } = useSendIx();
  const [priceInput, setPriceInput] = useState(formatUsdc(provider.priceUsdc));

  const busy = state === "pending";

  async function savePrice() {
    if (!publicKey) return;
    const newPrice = Math.round(parseFloat(priceInput) * 1_000_000);
    if (!Number.isFinite(newPrice) || newPrice <= 0) return;
    const ix = buildUpdateProviderIx({
      owner: publicKey,
      name: provider.name,
      newPrice,
    });
    if (await send([ix])) onChanged();
  }

  async function toggleActive() {
    if (!publicKey) return;
    const ix = buildUpdateProviderIx({
      owner: publicKey,
      name: provider.name,
      active: !provider.active,
    });
    if (await send([ix])) onChanged();
  }

  async function deregister() {
    if (!publicKey) return;
    if (
      !window.confirm(
        `Deregister "${provider.name}"? This closes the account and refunds its rent.`,
      )
    )
      return;
    const ix = buildDeregisterProviderIx(publicKey, provider.name);
    if (await send([ix])) onChanged();
  }

  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold tracking-tight">{provider.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              label={categoryLabel(provider.category)}
              variant="category"
            />
            <Badge
              label={agentTypeLabel(provider.agentType)}
              variant="agentType"
            />
            <StatusPill active={provider.active} className="ml-1" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleActive}
            disabled={busy}
            title={provider.active ? "Deactivate" : "Activate"}
            aria-label={provider.active ? "Deactivate" : "Activate"}
            className="p-2 rounded-lg border border-border text-text-muted hover:text-text-primary hover:border-border-hover transition-colors disabled:opacity-50"
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={deregister}
            disabled={busy}
            title="Deregister"
            aria-label="Deregister"
            className="p-2 rounded-lg border border-border text-text-muted hover:text-error hover:border-error/40 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-text-dim">Price (USDC / call)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.000001"
              min="0"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-32 rounded-lg bg-bg border border-border px-3 py-2 text-sm font-mono text-text-primary focus:border-accent focus:outline-none transition-colors"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={savePrice}
              disabled={busy}
            >
              Save
            </Button>
          </div>
        </div>
        <TxStatus
          state={state}
          signature={signature}
          errorMessage={error}
          className="mb-2"
        />
      </div>
    </div>
  );
}

export function MyProviders({
  providers,
  loading,
  error,
  onChanged,
}: MyProvidersProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} variant="rect" className="h-28" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-error" role="alert">
        {error}
      </p>
    );
  }

  if (providers.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        You haven&apos;t registered any providers yet. Use the form above to list
        your first service.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {providers.map((p) => (
        <ProviderRow key={p.address} provider={p} onChanged={onChanged} />
      ))}
    </div>
  );
}
