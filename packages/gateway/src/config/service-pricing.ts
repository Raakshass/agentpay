/**
 * Service Pricing Configuration
 *
 * Centralized pricing for all upstream API services.
 * This JSON config serves as the catalog until Vineet's
 * on-chain registry is deployed. Single-file edit for price changes.
 */

export interface ServicePricingEntry {
  /** Unique service identifier used in route paths and catalog */
  serviceId: string;

  /** Human-readable display name */
  displayName: string;

  /** What this service provides */
  description: string;

  /** USDC price per request in atomic units (1_000_000 = 1 USDC) */
  pricePerRequestAtomic: number;

  /** Category for catalog filtering */
  category: "depin" | "blockchain-data" | "market-data";
}

export const servicePricingConfig: ReadonlyArray<ServicePricingEntry> = [
  {
    serviceId: "depin-weather",
    displayName: "DePIN Weather Data",
    description:
      "Real-time weather and atmospheric data from decentralized sensor networks. Temperature, humidity, pressure, and wind for any global location.",
    pricePerRequestAtomic: 1000, // 0.001 USDC
    category: "depin",
  },
  {
    serviceId: "helius-token-balances",
    displayName: "Helius Token Balances",
    description:
      "All SPL token balances for any Solana wallet address via Helius enhanced APIs.",
    pricePerRequestAtomic: 2000, // 0.002 USDC
    category: "blockchain-data",
  },
  {
    serviceId: "birdeye-token-price",
    displayName: "Birdeye Token Price",
    description:
      "Real-time token price aggregated across all Solana DEXes via Birdeye.",
    pricePerRequestAtomic: 1000, // 0.001 USDC
    category: "market-data",
  },
] as const;

/**
 * Find a service by its identifier.
 * Throws if not found — services are statically defined so missing = bug.
 */
export function getServicePricing(serviceId: string): ServicePricingEntry {
  const service = servicePricingConfig.find(
    (entry) => entry.serviceId === serviceId
  );

  if (service === undefined) {
    throw new Error(`Service '${serviceId}' not found in pricing config`);
  }

  return service;
}
