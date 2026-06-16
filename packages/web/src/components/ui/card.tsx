"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";
import { cardHover, EASE_OUT, DURATION } from "@/lib/motion";

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
  as?: "div" | "button";
  ariaLabel?: string;
}

export function Card({
  children,
  className = "",
  hoverable = true,
  onClick,
  as = "div",
  ariaLabel,
}: CardProps) {
  const prefersReducedMotion = useReducedMotion();
  const Component = as === "button" ? motion.button : motion.div;

  return (
    <Component
      className={[
        "relative rounded-xl",
        "bg-bg-card border border-border",
        "overflow-hidden",
        hoverable ? "cursor-pointer" : "",
        className,
      ].join(" ")}
      whileHover={
        hoverable && !prefersReducedMotion
          ? {
              ...cardHover,
              borderColor: "rgba(255, 255, 255, 0.15)",
            }
          : undefined
      }
      transition={{ duration: DURATION.fast, ease: EASE_OUT }}
      onClick={onClick}
      role={as === "button" ? "button" : undefined}
      aria-label={ariaLabel}
    >
      {/* Faint radial glow at top of card */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(216,231,242,0.04) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </Component>
  );
}
