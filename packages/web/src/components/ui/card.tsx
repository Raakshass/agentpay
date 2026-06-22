"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
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
  const motionOk = useMotionAllowed();
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
        hoverable && motionOk
          ? {
              ...cardHover,
              borderColor: "rgba(166, 107, 255, 0.25)",
              boxShadow: "0 0 24px -6px rgba(166,107,255,0.15), 0 0 10px -4px rgba(95,224,255,0.1)",
            }
          : undefined
      }
      transition={{ duration: DURATION.fast, ease: EASE_OUT }}
      onClick={onClick}
      role={as === "button" ? "button" : undefined}
      aria-label={ariaLabel}
    >
      {/* Faint radial glow at top of card — intensifies on hover via CSS */}
      <div
        className="pointer-events-none absolute inset-0 card-inner-glow"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(95,224,255,0.05) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </Component>
  );
}
