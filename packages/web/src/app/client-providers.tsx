"use client";

import { type ReactNode } from "react";
import { SolanaProvider } from "@/providers/solana-provider";
import { NetworkGuard } from "@/components/layout/network-guard";

/**
 * Client-side providers wrapper. Separated from layout.tsx
 * because layout.tsx is a Server Component and wallet adapter
 * requires client-side context.
 */
export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SolanaProvider>
      <NetworkGuard />
      {children}
    </SolanaProvider>
  );
}
