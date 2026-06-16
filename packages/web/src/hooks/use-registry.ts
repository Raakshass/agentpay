"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  getProviders,
  type ProviderAccount,
} from "@/lib/registry-client";
import { MOCK_PROVIDERS } from "@/lib/mock-data";

export interface UseRegistryResult {
  providers: ProviderAccount[];
  loading: boolean;
  /** True when showing mock data because the chain returned nothing / errored. */
  usingMock: boolean;
  /** RPC error message, if any (mock data is still shown). */
  error: string | null;
  refresh: () => void;
}

/**
 * Fetch all registry providers from the chain, with a graceful fallback to mock
 * data when the program isn't deployed, the cluster is empty, or the RPC fails.
 * This keeps the catalog populated and legible in every environment.
 */
export function useRegistry(): UseRegistryResult {
  const { connection } = useConnection();
  const [providers, setProviders] = useState<ProviderAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const onChain = await getProviders(connection);
        if (cancelled) return;
        if (onChain.length > 0) {
          setProviders(onChain);
          setUsingMock(false);
        } else {
          // Program deployed but empty (or not deployed) — show the demo set.
          setProviders(MOCK_PROVIDERS);
          setUsingMock(true);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setProviders(MOCK_PROVIDERS);
        setUsingMock(true);
        setError(
          e instanceof Error ? e.message : "Failed to read the registry",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [connection, nonce]);

  return { providers, loading, usingMock, error, refresh };
}
