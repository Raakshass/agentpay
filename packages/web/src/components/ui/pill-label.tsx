"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fadeInScale } from "@/lib/motion";

interface PillLabelProps {
  icon?: string;
  label: string;
  className?: string;
}

export function PillLabel({ icon = "✦", label, className = "" }: PillLabelProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={fadeInScale}
      initial={prefersReducedMotion ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className={[
        "inline-flex items-center gap-2",
        "px-4 py-1.5 rounded-full",
        "bg-white/5 border border-border",
        "text-xs font-medium tracking-[0.15em] uppercase text-text-muted",
        className,
      ].join(" ")}
    >
      <span className="text-gradient text-[10px]">{icon}</span>
      {label}
    </motion.div>
  );
}
