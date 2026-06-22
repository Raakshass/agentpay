"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
import { fadeInUp, staggerContainer, EASE_OUT, DURATION } from "@/lib/motion";

interface FadeInViewProps {
  children: ReactNode;
  className?: string;
  /** Extra delay before this element fades in (seconds) */
  delay?: number;
  /** When true, staggers children (each child should use `variants={fadeInUp}`) */
  stagger?: boolean;
  /** Viewport margin for triggering (default "-100px") */
  margin?: string;
  /** Element tag — defaults to div */
  as?: "div" | "section" | "article" | "li";
}

/**
 * Scroll-triggered fade + rise wrapper.
 *
 * Usage:
 * ```tsx
 * <FadeInView>
 *   <p>Fades in when scrolled into view</p>
 * </FadeInView>
 *
 * <FadeInView stagger>
 *   <motion.div variants={fadeInUp}>Child 1</motion.div>
 *   <motion.div variants={fadeInUp}>Child 2</motion.div>
 * </FadeInView>
 * ```
 */
export function FadeInView({
  children,
  className = "",
  delay = 0,
  stagger: isStagger = false,
  margin = "-100px",
  as = "div",
}: FadeInViewProps) {
  const motionOk = useMotionAllowed();

  const variants = isStagger
    ? staggerContainer
    : {
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: DURATION.normal, ease: EASE_OUT, delay },
        },
      };

  const Component = {
    div: motion.div,
    section: motion.section,
    article: motion.article,
    li: motion.li,
  }[as];

  return (
    <Component
      variants={variants}
      initial={motionOk ? "hidden" : "visible"}
      whileInView="visible"
      viewport={{ once: true, margin }}
      className={className}
    >
      {children}
    </Component>
  );
}

// Re-export for convenience
export { fadeInUp };
