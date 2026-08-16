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

  /**
   * Metadata for the free, unauthenticated preview endpoint
   * (`GET /preview/:serviceId/:param`). Lets the web playground call the
   * service with real upstream data before a payment session exists.
   */
  preview: {
    /** Path param name the endpoint expects, e.g. "city". */
    param: string;
    /** Human label for the input, e.g. "City name". */
    inputLabel: string;
    /** Example value pre-filled in the playground. */
    example: string;
  };
}

export const servicePricingConfig: ReadonlyArray<ServicePricingEntry> = [
  {
    serviceId: "depin-weather",
    displayName: "DePIN Weather Data",
    description:
      "Real-time weather data from decentralized sensor networks. Temperature, humidity, pressure, wind, and precipitation for any global city. Powered by Open-Meteo.",
    pricePerRequestAtomic: 1000, // 0.001 USDC
    category: "depin",
    preview: {
      param: "city",
      inputLabel: "City name",
      example: "London",
    },
  },
  {
    serviceId: "helius-token-balances",
    displayName: "Solana Token Balances",
    description:
      "All SPL token balances for any Solana wallet address. Returns mint, amount, decimals, and account state via on-chain RPC.",
    pricePerRequestAtomic: 2000, // 0.002 USDC
    category: "blockchain-data",
    preview: {
      param: "walletAddress",
      inputLabel: "Solana wallet address",
      example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    },
  },
  {
    serviceId: "birdeye-token-price",
    displayName: "Token Price (DEX Aggregated)",
    description:
      "Real-time token price aggregated across all Solana DEXes via Jupiter. Includes buy/sell spread, confidence level, and market depth.",
    pricePerRequestAtomic: 1000, // 0.001 USDC
    category: "market-data",
    preview: {
      param: "tokenAddress",
      inputLabel: "Token mint address",
      example: "So11111111111111111111111111111111111111112",
    },
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
