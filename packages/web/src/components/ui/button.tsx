"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-white text-black hover:bg-white/90 active:bg-white/80",
  ghost:
    "bg-transparent text-white hover:bg-white/5 active:bg-white/10",
  outline:
    "bg-transparent text-white border border-border hover:border-border-hover hover:bg-white/5",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-6 py-2.5 text-sm",
  lg: "px-8 py-3 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, href, ...props }, ref) => {
    const classes = [
      "inline-flex items-center justify-center gap-2",
      "rounded-full font-medium",
      "transition-all duration-200",
      "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      variantStyles[variant],
      sizeStyles[size],
      className,
    ].join(" ");

    if (href) {
      return (
        <a href={href} className={classes} role="button">
          {children}
        </a>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
export { Button };
export type { ButtonProps };
