/**
 * Dynamic Pricing — On-Chain Registry Reader
 *
 * Fetches service pricing from the on-chain registry program rather than
 * relying on hardcoded config. Falls back to static config if the registry
 * is unavailable or providers haven't registered yet.
 *
 * Caches results with a 5-minute TTL to avoid hammering the RPC.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { environmentConfig } from "../config/environment.js";
import { servicePricingConfig, type ServicePricingEntry } from "../config/service-pricing.js";
import { logger } from "../utilities/logger.js";

// ---------------------------------------------------------------------------
// On-chain ApiProvider layout (from the registry program)
// ---------------------------------------------------------------------------

// Account layout: 8 (discriminator) + 32 (owner) + 4+50 (name string) +
// 32 (endpoint_hash) + 8 (price_usdc) + 1 (category) + 1 (agent_type) +
// 32 (provider_wallet) + 32 (gateway_authority) + 8 (total_calls) +
// 1 (active) + 1 (bump)
const OFFSET_OWNER = 8;
const OFFSET_NAME_LEN = 8 + 32; // Borsh string: 4-byte LE length prefix
const OFFSET_NAME_DATA = 8 + 32 + 4;
const MAX_NAME_LEN = 50;

// Offsets AFTER the variable-length name (relative to name end)
function afterName(nameLen: number) {
  const nameEnd = OFFSET_NAME_DATA + nameLen;
  return {
    endpointHash: nameEnd,
    priceUsdc: nameEnd + 32,
    category: nameEnd + 32 + 8,
    agentType: nameEnd + 32 + 8 + 1,
    providerWallet: nameEnd + 32 + 8 + 1 + 1,
    gatewayAuthority: nameEnd + 32 + 8 + 1 + 1 + 32,
    totalCalls: nameEnd + 32 + 8 + 1 + 1 + 32 + 32,
    active: nameEnd + 32 + 8 + 1 + 1 + 32 + 32 + 8,
  };
}

export interface OnChainProvider {
  address: string;
  owner: string;
  name: string;
  priceUsdc: number;
  category: number;
  agentType: number;
  providerWallet: string;
  totalCalls: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CachedPricing {
  providers: OnChainProvider[];
  fetchedAt: number;
}

let _cache: CachedPricing | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all registered providers from the on-chain registry.
 * Results are cached for 5 minutes.
 */
export async function fetchOnChainProviders(): Promise<OnChainProvider[]> {
  // Return cache if fresh
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.providers;
  }

  const registryProgramId = environmentConfig.contracts.registryProgramId;
  if (!registryProgramId) {
    logger.debug("Registry program ID not configured — using static pricing");
    return [];
  }

  try {
    const connection = new Connection(environmentConfig.solana.rpcUrl, "confirmed");
    const programId = new PublicKey(registryProgramId);

    // Fetch all accounts owned by the registry program
    const accounts = await connection.getProgramAccounts(programId, {
      commitment: "confirmed",
    });

    const providers: OnChainProvider[] = [];

    for (const { pubkey, account } of accounts) {
      try {
        const data = account.data;
        if (data.length < OFFSET_NAME_DATA + 1) continue;

        // Read Borsh string length (4 bytes LE)
        const nameLen = data.readUInt32LE(OFFSET_NAME_LEN);
        if (nameLen === 0 || nameLen > MAX_NAME_LEN) continue;
        if (data.length < OFFSET_NAME_DATA + nameLen + 32 + 8 + 1 + 1 + 32 + 32 + 8 + 1) continue;

        const name = data.subarray(OFFSET_NAME_DATA, OFFSET_NAME_DATA + nameLen).toString("utf-8");
        const offsets = afterName(nameLen);

        const owner = new PublicKey(data.subarray(OFFSET_OWNER, OFFSET_OWNER + 32)).toBase58();
        const priceUsdc = Number(data.readBigUInt64LE(offsets.priceUsdc));
        const category = data[offsets.category] ?? 0;
        const agentType = data[offsets.agentType] ?? 0;
        const providerWallet = new PublicKey(data.subarray(offsets.providerWallet, offsets.providerWallet + 32)).toBase58();
        const totalCalls = Number(data.readBigUInt64LE(offsets.totalCalls));
        const active = (data[offsets.active] ?? 0) !== 0;

        providers.push({
          address: pubkey.toBase58(),
          owner,
          name,
          priceUsdc,
          category,
          agentType,
          providerWallet,
          totalCalls,
          active,
        });
      } catch {
        // Skip malformed accounts
        continue;
      }
    }

    _cache = { providers, fetchedAt: Date.now() };
    logger.info(`Fetched ${providers.length} providers from on-chain registry`);

    return providers;
  } catch (error) {
    logger.warn(`Failed to fetch on-chain registry: ${error instanceof Error ? error.message : error}`);
    return _cache?.providers ?? [];
  }
}

/**
 * Get pricing for a service, checking on-chain registry first,
 * then falling back to static config.
 *
 * On-chain pricing overrides static config when:
 * 1. The registry has a provider with a matching name
 * 2. The provider is active
 */
export async function getDynamicPricing(serviceId: string): Promise<ServicePricingEntry> {
  // Static config is always the baseline
  const staticEntry = servicePricingConfig.find((s) => s.serviceId === serviceId);
  if (!staticEntry) {
    throw new Error(`Service '${serviceId}' not found in pricing config`);
  }

  // Try to find an on-chain override
  try {
    const providers = await fetchOnChainProviders();
    const match = providers.find(
      (p) => p.name.toLowerCase() === serviceId.toLowerCase() && p.active
    );

    if (match) {
      return {
        ...staticEntry,
        pricePerRequestAtomic: match.priceUsdc,
      };
    }
  } catch {
    // Fall through to static
  }

  return staticEntry;
}

/**
 * Invalidate the pricing cache (useful after a provider registers or updates).
 */
export function invalidatePricingCache(): void {
  _cache = null;
}
