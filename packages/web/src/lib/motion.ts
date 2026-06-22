/**
 * Shared Framer Motion animation variants.
 *
 * All entrance animations use expo-out easing for a premium feel.
 * prefers-reduced-motion is respected via the useReducedMotion hook
 * at the component level — when active, components skip animations.
 */

/** Custom expo-out easing matching the reference design */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Standard entrance durations */
export const DURATION = {
  micro: 0.2,
  fast: 0.2,
  normal: 0.5,
  slow: 0.7,
  countUp: 1.2,
  loop: 2.8,
} as const;

/** Stagger delay between children */
export const STAGGER = {
  fast: 0.05,
  normal: 0.08,
  slow: 0.1,
} as const;

/**
 * Fade + rise entrance (y: 16→0, opacity 0→1).
 * Used for most section content reveals.
 */
export const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASE_OUT },
  },
};

/**
 * Staggered container for children using fadeInUp.
 */
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER.normal,
      delayChildren: 0.1,
    },
  },
};

/**
 * Fade + scale entrance for pill labels.
 */
export const fadeInScale = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.fast + 0.1, ease: EASE_OUT },
  },
};

/**
 * Card hover animation: lift + brighten border.
 */
export const cardHover = {
  y: -4,
  transition: { duration: DURATION.fast, ease: EASE_OUT },
};

/**
 * Crossfade transition for content switches (stepper, tabs).
 */
export const crossfade = {
  initial: { opacity: 0, x: 10 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
};

/**
 * Hero entrance: fade + scale (0.96→1) for high-impact elements.
 */
export const heroEntrance = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.slow, ease: EASE_OUT },
  },
};

/**
 * Emphasis word variant — arrives a beat after siblings in a stagger.
 */
export const emphasisDelay = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE_OUT, delay: 0.12 },
  },
};
