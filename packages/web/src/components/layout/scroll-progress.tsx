"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";

/**
 * Thin gradient bar pinned to the very top of the viewport that fills as the
 * page scrolls. A lightweight, always-present cue of reading progress across
 * every route. Hidden entirely when the user prefers reduced motion.
 */
export function ScrollProgress() {
  const motionOk = useMotionAllowed();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    restDelta: 0.001,
  });

  if (!motionOk) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 z-[60] h-0.5 origin-left bg-gradient-flow"
    />
  );
}
