"use client";

interface StatusPillProps {
  active: boolean;
  className?: string;
}

export function StatusPill({ active, className = "" }: StatusPillProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5",
        "text-xs font-medium",
        active ? "text-success" : "text-text-dim",
        className,
      ].join(" ")}
      role="status"
      aria-label={active ? "Active" : "Inactive"}
    >
      <span
        className={[
          "w-1.5 h-1.5 rounded-full",
          active ? "bg-success" : "bg-text-dim",
          active ? "animate-pulse" : "",
        ].join(" ")}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}
