"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
import { EASE_OUT } from "@/lib/motion";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Wraps page content with a simple fade-in on initial mount.
 *
 * IMPORTANT: AnimatePresence with keyed children does NOT work reliably
 * in Next.js App Router because the layout never unmounts — only the
 * page slot (children) changes. Using AnimatePresence + mode="wait" here
 * causes the new page to be blank until a manual refresh.
 *
 * The correct pattern for App Router is to handle the entrance animation
 * inside each page/template, not in the layout wrapper. This component
 * provides just a clean initial fade-in on first load.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const motionOk = useMotionAllowed();

  if (!motionOk) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
