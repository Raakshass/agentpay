"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatUsdcWithSymbol } from "@/lib/format";
import { categoryMeta } from "@/lib/service-categories";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
import type { CatalogService } from "@/hooks/use-catalog";
import { TryItPanel } from "./try-it-panel";

interface ServiceCardProps {
  service: CatalogService;
}

/**
 * A single live service from the gateway catalog: name, category, description,
 * and real per-call price, with an expandable "Try it" playground that calls
 * the free preview endpoint.
 */
export function ServiceCard({ service }: ServiceCardProps) {
  const cat = categoryMeta(service.category);
  const [open, setOpen] = useState(false);
  const motionOk = useMotionAllowed();

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

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary hover:border-border-hover transition-colors duration-200"
        >
          <span>{open ? "Hide playground" : "Try it — free preview"}</span>
          <ChevronDown
            className={[
              "w-4 h-4 text-text-dim transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={motionOk ? { height: 0, opacity: 0 } : false}
              animate={{ height: "auto", opacity: 1 }}
              exit={motionOk ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-1">
                <TryItPanel service={service} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
