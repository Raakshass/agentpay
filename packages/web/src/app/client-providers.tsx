"use client";

import { type ReactNode } from "react";
import { SolanaProvider } from "@/providers/solana-provider";

/**
 * Client-side providers wrapper. Separated from layout.tsx
 * because layout.tsx is a Server Component and wallet adapter
 * requires client-side context.
 */
export function ClientProviders({ children }: { children: ReactNode }) {
  return <SolanaProvider>{children}</SolanaProvider>;
}
