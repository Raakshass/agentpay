"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  DEMO_AGENTS,
  DEMO_PROVIDERS,
  type DemoEvent,
} from "@/hooks/use-demo-events";
import { formatUsdcWithSymbol } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";

interface SettlementTickerProps {
  events: DemoEvent[];
}

export function SettlementTicker({ events }: SettlementTickerProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-text-dim mb-4">
        Settlement stream
      </h3>

      {events.length === 0 ? (
        <p className="text-sm text-text-dim">Waiting for payments…</p>
      ) : (
        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {events.map((e) => (
              <motion.li
                key={e.id}
                layout={!prefersReducedMotion}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: -12 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0"
              >
                <span className="flex items-center gap-2 text-sm text-text-muted min-w-0">
                  <span className="truncate">{DEMO_AGENTS[e.agent]}</span>
                  <span className="text-text-dim">→</span>
                  <span className="truncate text-text-primary">
                    {DEMO_PROVIDERS[e.provider]}
                  </span>
                </span>
                <span className="font-mono text-sm text-accent shrink-0">
                  {formatUsdcWithSymbol(e.amountUsdc)}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
