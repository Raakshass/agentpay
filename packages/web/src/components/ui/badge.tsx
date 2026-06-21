"use client";

interface BadgeProps {
  label: string;
  variant?: "category" | "agentType" | "default";
  className?: string;
}

const variantStyles: Record<string, string> = {
  category:
    "bg-white/5 text-text-muted border-border",
  agentType:
    "bg-accent-glow text-accent border-accent/10",
  default:
    "bg-white/5 text-text-muted border-border",
};

export function Badge({ label, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center",
        "px-2.5 py-0.5 rounded-full",
        "text-xs font-medium tracking-wide",
        "border",
        variantStyles[variant] || variantStyles.default,
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
