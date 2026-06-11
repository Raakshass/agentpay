/**
 * Catalog Client
 *
 * Fetches the service catalog from the gateway.
 * Used by agents to discover available APIs and their prices.
 */

import type { CatalogResponse, CatalogService } from "./types/session.js";

/**
 * Fetch the full service catalog from the gateway.
 */
export async function fetchCatalog(gatewayUrl: string): Promise<CatalogResponse> {
  const response = await fetch(`${gatewayUrl}/catalog`);

  if (!response.ok) {
    throw new Error(`Failed to fetch catalog: ${response.status} ${response.statusText}`);
  }

  const catalog = (await response.json()) as CatalogResponse;
  return catalog;
}

/**
 * Find a specific service in the catalog by its ID.
 * Returns null if the service is not found.
 */
export async function findService(
  gatewayUrl: string,
  serviceId: string
): Promise<CatalogService | null> {
  const catalog = await fetchCatalog(gatewayUrl);
  return catalog.services.find((service) => service.serviceId === serviceId) ?? null;
}
