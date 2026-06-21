"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Address } from "@/components/ui/address";
import type { ProviderAccount } from "@/lib/registry-client";
import {
  agentTypeLabel,
  categoryLabel,
  formatNumber,
  formatUsdcWithSymbol,
} from "@/lib/format";
import { config } from "@/lib/config";
import { EASE_OUT } from "@/lib/motion";

interface ProviderDrawerProps {
  provider: ProviderAccount | null;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border">
      <span className="text-sm text-text-dim">{label}</span>
      <span className="text-sm text-text-primary text-right">{children}</span>
    </div>
  );
}

export function ProviderDrawer({ provider, onClose }: ProviderDrawerProps) {
  const prefersReducedMotion = useReducedMotion();

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (provider) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [provider, onClose]);

  const snippet = provider
    ? `curl ${config.gatewayUrl}/call \\
  -H "x-conduit-provider: ${provider.address}" \\
  -d '{ "input": "…" }'`
    : "";

  return (
    <AnimatePresence>
      {provider && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`${provider.name} details`}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-border bg-bg-card"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { x: "100%" }
            }
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {provider.name}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge
                      label={categoryLabel(provider.category)}
                      variant="category"
                    />
                    <Badge
                      label={agentTypeLabel(provider.agentType)}
                      variant="agentType"
                    />
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close details"
                  className="p-2 text-text-muted hover:text-text-primary rounded-full hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6">
                <Row label="Price">
                  <span className="font-mono">
                    {formatUsdcWithSymbol(provider.priceUsdc)} / call
                  </span>
                </Row>
                <Row label="Total calls">
                  <span className="font-mono">
                    {formatNumber(provider.totalCalls)}
                  </span>
                </Row>
                <Row label="Status">
                  <StatusPill active={provider.active} />
                </Row>
                <Row label="Provider wallet">
                  <Address address={provider.providerWallet} />
                </Row>
                <Row label="Owner">
                  <Address address={provider.owner} />
                </Row>
                <Row label="Account">
                  <Address address={provider.address} />
                </Row>
                <Row label="Endpoint hash">
                  <span className="font-mono text-xs break-all text-text-muted">
                    {provider.endpointHash.slice(0, 16)}…
                  </span>
                </Row>
              </div>

              <div className="mt-6">
                <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-text-dim mb-3">
                  Try it
                </h3>
                <pre className="rounded-lg bg-bg border border-border p-4 overflow-x-auto">
                  <code className="font-mono text-xs text-text-muted whitespace-pre">
                    {snippet}
                  </code>
                </pre>
                <p className="mt-3 text-xs text-text-dim leading-relaxed">
                  Open a channel with the gateway, then call through it — the
                  agent signs cumulative IOUs off-chain and the channel settles
                  on-chain.
                </p>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
