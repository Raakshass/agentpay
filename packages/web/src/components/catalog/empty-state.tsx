"use client";

import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export function EmptyState({
  title = "No providers found",
  message = "Try clearing your filters or search to see the full catalog.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border flex items-center justify-center mb-6">
        <PackageOpen className="w-7 h-7 text-text-dim" />
      </div>
      <h3 className="text-lg font-medium text-text-primary">{title}</h3>
      <p className="mt-2 text-sm text-text-muted max-w-sm">{message}</p>
    </div>
  );
}
