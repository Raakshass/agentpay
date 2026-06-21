"use client";

import { useMemo } from "react";
import { useDemoEvents } from "@/hooks/use-demo-events";
import { formatUsdcWithSymbol } from "@/lib/format";
import { NetworkGraph } from "./network-graph";
import { SettlementTicker } from "./settlement-ticker";

export function DemoClient() {
  const { events, latest, mode } = useDemoEvents();

  const totalSettled = useMemo(
    () => events.reduce((sum, e) => sum + e.amountUsdc, 0),
    [events],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-card px-3 py-1 text-xs text-text-muted"
          role="status"
        >
          <span
            className={[
              "w-1.5 h-1.5 rounded-full",
              mode === "live" ? "bg-success animate-pulse" : "bg-warning",
            ].join(" ")}
          />
          {mode === "live" ? "Live gateway feed" : "Simulated mode"}
        </span>
        <span className="text-xs text-text-dim font-mono">
          {formatUsdcWithSymbol(totalSettled)} in view
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <NetworkGraph latest={latest} />
        <SettlementTicker events={events} />
      </div>

      {mode === "simulated" && (
        <p className="text-xs text-text-dim leading-relaxed max-w-2xl">
          These payments are simulated for illustration. Set{" "}
          <code className="font-mono text-text-muted">
            NEXT_PUBLIC_GATEWAY_WS_URL
          </code>{" "}
          to a running gateway WebSocket to stream real settlement events.
        </p>
      )}
    </div>
  );
}
