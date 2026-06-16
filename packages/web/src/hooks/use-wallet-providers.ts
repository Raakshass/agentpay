"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getProvidersByOwner,
  type ProviderAccount,
} from "@/lib/registry-client";

export interface UseWalletProvidersResult {
  providers: ProviderAccount[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetch the registry providers owned by the connected wallet. Unlike the public
 * catalog, this does NOT fall back to mock data — the dashboard should reflect
 * the wallet's real on-chain state (empty until the user registers something).
 */
export function useWalletProviders(): UseWalletProvidersResult {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [providers, setProviders] = useState<ProviderAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!publicKey) {
        setProviders([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const owned = await getProvidersByOwner(publicKey, connection);
        if (!cancelled) setProviders(owned);
      } catch (e: unknown) {
        if (cancelled) return;
        setProviders([]);
        setError(
          e instanceof Error ? e.message : "Failed to read your providers",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, nonce]);

  return { providers, loading, error, refresh };
}
