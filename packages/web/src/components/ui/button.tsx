"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { motion } from "framer-motion";
import { useMotionAllowed } from "@/hooks/use-reduced-motion";
import { EASE_OUT } from "@/lib/motion";

type ButtonVariant = "primary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "bg-transparent text-white hover:bg-white/5 active:bg-white/10",
  outline:
    "bg-transparent text-text-muted border border-border hover:border-border-hover hover:bg-white/5 hover:text-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-6 py-2.5 text-sm",
  lg: "px-8 py-3 text-base",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden select-none";

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", className = "", children, href, ...props },
    ref,
  ) => {
    const motionOk = useMotionAllowed();
    const classes = [BASE, variantClasses[variant], sizeClasses[size], className].join(" ");

    const isPrimary = variant === "primary";

    /* Motion props — only applied when reduced-motion is off */
    const hoverAnim = motionOk
      ? isPrimary
        ? { y: -1, filter: "brightness(1.08)" }
        : { filter: "brightness(1.06)" }
      : undefined;
    const tapAnim = motionOk ? { scale: 0.98 } : undefined;
    const transition = { duration: 0.2, ease: EASE_OUT };

    if (href) {
      return (
        <motion.a
          href={href}
          className={classes}
          role="button"
          whileHover={hoverAnim}
          whileTap={tapAnim}
          transition={transition}
        >
          {children}
        </motion.a>
      );
    }

    return (
      <motion.button
        ref={ref}
        className={classes}
        whileHover={hoverAnim}
        whileTap={tapAnim}
        transition={transition}
        {...(props as any)}
      >
        {children}
      </motion.button>
    );
  },
);

Button.displayName = "Button";
export { Button };
export type { ButtonProps };
