"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState, type RefObject } from "react";

/**
 * Returns `true` when animations should play (i.e. the user has NOT
 * enabled prefers-reduced-motion).
 *
 * This is the positive-sense wrapper around Framer's `useReducedMotion()`
 * so call-sites read more naturally: `if (motionOk) { … }`.
 */
export function useMotionAllowed(): boolean {
  const prefersReduced = useReducedMotion();
  return !prefersReduced;
}

/**
 * Returns `true` when the referenced element is visible in the viewport.
 *
 * Looping animations (portal pulse, breathing glow) should use this to
 * pause when off-screen so they don't burn battery / GPU cycles.
 *
 * Falls back to `true` when IntersectionObserver isn't available (SSR).
 */
export function useVisibilityPause(
  ref: RefObject<Element | null>,
  rootMargin = "100px",
): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setIsVisible(entry.isIntersecting);
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return isVisible;
}
