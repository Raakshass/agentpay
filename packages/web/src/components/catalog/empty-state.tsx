"use client";

import { motion } from "framer-motion";
import { PackageOpen } from "lucide-react";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
import { fadeInUp, EASE_OUT, DURATION } from "@/lib/motion";

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export function EmptyState({
  title = "No providers found",
  message = "Try clearing your filters or search to see the full catalog.",
}: EmptyStateProps) {
  const motionOk = useMotionAllowed();

  return (
    <motion.div
      initial={motionOk ? { opacity: 0, y: 12 } : { opacity: 1 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.normal, ease: EASE_OUT }}
      className="flex flex-col items-center justify-center text-center py-24"
    >
      <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border flex items-center justify-center mb-6">
        <PackageOpen className="w-7 h-7 text-text-dim" />
      </div>
      <h3 className="text-lg font-medium text-text-primary">{title}</h3>
      <p className="mt-2 text-sm text-text-muted max-w-sm">{message}</p>
    </motion.div>
  );
}
