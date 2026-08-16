"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useCatalog } from "@/hooks/use-catalog";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
import { staggerContainer, fadeInUp } from "@/lib/motion";
import { categoriesFrom, categoryMeta } from "@/lib/service-categories";
import { ServiceCard } from "./service-card";

export function ServicesClient() {
  const { services, network, loading, error, refresh } = useCatalog();
  const [category, setCategory] = useState<string | "all">("all");
  const motionOk = useMotionAllowed();

  const categories = useMemo(
    () => categoriesFrom(services.map((s) => s.category)),
    [services],
  );

  const filtered = useMemo(
    () =>
      category === "all"
        ? services
        : services.filter((s) => s.category === category),
    [services, category],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-bg-card px-6 py-16 text-center">
        <AlertTriangle className="w-6 h-6 text-accent" />
        <div>
          <p className="text-text-primary font-medium">Gateway unreachable</p>
          <p className="mt-1 text-sm text-text-muted max-w-md">
            Couldn&apos;t load the live catalog ({error}). Make sure the gateway
            is running and reachable at its configured URL.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {categories.map((slug) => (
            <FilterChip
              key={slug}
              label={categoryMeta(slug).label}
              active={category === slug}
              onClick={() => setCategory(slug)}
            />
          ))}
        </div>
        {network && (
          <span className="inline-flex items-center gap-2 text-xs text-text-dim">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live · {network}
          </span>
        )}
      </div>

      <motion.div
        key={category}
        variants={staggerContainer}
        initial={motionOk ? "hidden" : false}
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {filtered.map((service) => (
          <motion.div
            key={service.serviceId}
            variants={fadeInUp}
            whileHover={motionOk ? { y: -4 } : undefined}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <ServiceCard service={service} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative rounded-full border px-4 py-1.5 text-sm transition-colors duration-200",
        active
          ? "border-accent/50 text-accent"
          : "border-border bg-bg-card text-text-muted hover:border-border-hover hover:text-text-primary",
      ].join(" ")}
    >
      {active && (
        <motion.span
          layoutId="catalog-filter-active"
          className="absolute inset-0 rounded-full bg-accent/10"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}
