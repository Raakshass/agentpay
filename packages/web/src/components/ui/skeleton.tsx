"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "circle" | "rect";
}

export function Skeleton({ className = "", variant = "text" }: SkeletonProps) {
  const baseStyles = "skeleton-shimmer rounded";

  const variantStyles = {
    text: "h-4 w-full rounded",
    card: "h-48 w-full rounded-xl",
    circle: "w-10 h-10 rounded-full",
    rect: "h-24 w-full rounded-lg",
  };

  return (
    <div
      className={[baseStyles, variantStyles[variant], className].join(" ")}
      aria-hidden="true"
    />
  );
}

/** Skeleton layout for a provider card */
export function CardSkeleton() {
  return (
    <div className="rounded-xl bg-bg-card border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-32 h-5" />
        <Skeleton variant="circle" className="w-6 h-6" />
      </div>
      <div className="flex gap-2">
        <Skeleton variant="text" className="w-16 h-5" />
        <Skeleton variant="text" className="w-12 h-5" />
      </div>
      <Skeleton variant="text" className="w-full h-4" />
      <Skeleton variant="text" className="w-2/3 h-4" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton variant="text" className="w-20 h-6" />
        <Skeleton variant="text" className="w-24 h-4" />
      </div>
    </div>
  );
}
