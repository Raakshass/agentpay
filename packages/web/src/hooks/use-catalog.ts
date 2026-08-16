"use client";

import { useCallback, useEffect, useState } from "react";
import { config } from "@/lib/config";

/** A single service as returned by the gateway's `GET /catalog` endpoint. */
export interface CatalogService {
  serviceId: string;
  displayName: string;
  description: string;
  category: "depin" | "blockchain-data" | "market-data" | string;
  pricing: {
    perRequestAtomic: number;
    currency: string;
    model: string;
  };
  /** Paid, session-gated endpoint path (e.g. "/api/depin-weather"). */
  endpoint: string;
  /** Free, unauthenticated sample endpoint + input hints for the playground. */
  preview: {
    endpoint: string;
    param: string;
    inputLabel: string;
    example: string;
  };
}

export interface CatalogResponse {
  protocol: string;
  version: string;
  paymentModel: string;
  network: string;
  totalServices: number;
  services: CatalogService[];
}

export interface UseCatalogResult {
  services: CatalogService[];
  /** Network the gateway is settling on, e.g. "solana-mainnet-beta". */
  network: string | null;
  loading: boolean;
  /** Set when the gateway is unreachable or returned an error. */
  error: string | null;
  refresh: () => void;
}

/**
 * Fetch the live service catalog from the gateway's `GET /catalog` endpoint.
 * Unlike the on-chain registry, this reflects the services the gateway is
 * actually proxying right now — including their real prices and the free
 * preview endpoints that power the "Try it" playground.
 */
export function useCatalog(): UseCatalogResult {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [network, setNetwork] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${config.gatewayUrl}/catalog`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Gateway responded ${response.status}`);
        }
        const data = (await response.json()) as CatalogResponse;
        if (cancelled) return;
        setServices(data.services ?? []);
        setNetwork(data.network ?? null);
      } catch (e: unknown) {
        if (cancelled) return;
        setServices([]);
        setError(
          e instanceof Error
            ? e.message
            : "Could not reach the gateway catalog",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { services, network, loading, error, refresh };
}
