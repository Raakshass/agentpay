"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { DURATION, EASE_OUT } from "@/lib/motion";

interface StatCounterProps {
  /** Target value to count up to */
  target: number;
  /** Format function for display (e.g. add commas, $ prefix) */
  format?: (value: number) => string;
  /** Label below the number */
  label: string;
  /** Optional prefix (e.g. "$") */
  prefix?: string;
  /** Optional suffix (e.g. "+") */
  suffix?: string;
  className?: string;
}

export function StatCounter({
  target,
  format,
  label,
  prefix = "",
  suffix = "",
  className = "",
}: StatCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const prefersReducedMotion = useReducedMotion();

  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const display = useTransform(rounded, (v) => {
    const formatted = format ? format(v) : v.toLocaleString("en-US");
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (!isInView) return;

    if (prefersReducedMotion) {
      motionValue.set(target);
      return;
    }

    const controls = animate(motionValue, target, {
      duration: DURATION.countUp,
      ease: EASE_OUT,
    });

    return () => controls.stop();
  }, [isInView, target, motionValue, prefersReducedMotion]);

  return (
    <div ref={ref} className={["text-center", className].join(" ")}>
      <motion.span className="block text-4xl md:text-5xl font-bold font-mono tracking-tight text-text-primary mono-value">
        {display}
      </motion.span>
      <span className="block mt-2 text-sm text-text-muted tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}
