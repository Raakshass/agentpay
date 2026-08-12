/**
 * Token Price Routes (formerly Birdeye)
 *
 * Returns real-time token price data aggregated across all Solana DEXes.
 * Uses the Jupiter Price API v3 (lite) — free, no API key required,
 * aggregates liquidity from every major Solana DEX.
 *
 * Protected by session-gate middleware (valid IOU required).
 *
 * GET /api/birdeye-token-price/:tokenAddress
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { forwardToUpstream } from "../services/upstream-proxy.js";
import { logger } from "../utilities/logger.js";

// ---------------------------------------------------------------------------
// Jupiter Price API v3 response shape
// ---------------------------------------------------------------------------

interface JupiterV3PriceEntry {
  /** ISO date when this price record was first created */
  createdAt: string;
  /** Total USD liquidity across all DEX pools */
  liquidity: number;
  /** Current price in USD */
  usdPrice: number;
  /** Solana block ID at price capture */
  blockId: number;
  /** Token decimals */
  decimals: number;
  /** 24-hour price change percentage */
  priceChange24h: number;
}

/**
 * Jupiter v3 returns a flat map: { [mintAddress]: PriceEntry }
 * (no wrapper object — the mint IS the key)
 */
type JupiterV3PriceResponse = Record<string, JupiterV3PriceEntry>;

// ---------------------------------------------------------------------------
// Well-known Solana token mints for display names
// ---------------------------------------------------------------------------

const WELL_KNOWN_TOKENS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL (Wrapped)",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": "stSOL",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY",
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: "PYTH",
  rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof: "RNDR",
};

function getTokenDisplayName(mint: string): string | null {
  return WELL_KNOWN_TOKENS[mint] ?? null;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerBirdeyeRoutes(application: Express): void {
  const pricing = getServicePricing("birdeye-token-price");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get(
    "/api/birdeye-token-price/:tokenAddress",
    sessionGate,
    handleTokenPriceRequest
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handleTokenPriceRequest(
  request: Request,
  response: Response
): Promise<void> {
  const tokenAddress = request.params["tokenAddress"] as string | undefined;

  if (tokenAddress === undefined || tokenAddress.length === 0) {
    response.status(400).json({
      error: {
        message: "Token address parameter is required",
        code: "MISSING_TOKEN_ADDRESS",
      },
    });
    return;
  }

  // Basic Solana address validation (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenAddress)) {
    response.status(400).json({
      error: {
        message: "Invalid Solana token address format",
        code: "INVALID_TOKEN_ADDRESS",
      },
    });
    return;
  }

  // Jupiter Price API v3 (lite — free, no key)
  const upstreamUrl = `https://lite-api.jup.ag/price/v3?ids=${tokenAddress}`;

  const upstreamResponse = await forwardToUpstream({
    url: upstreamUrl,
    method: "GET",
    timeoutMilliseconds: 8_000,
  });

  if (!upstreamResponse.isSuccess) {
    logger.warn(
      `Jupiter price fetch failed for ${tokenAddress}: ${upstreamResponse.statusCode}`
    );
    response.status(502).json({
      error: {
        message: "Failed to fetch token price",
        code: "UPSTREAM_ERROR",
        upstream: upstreamResponse.data,
      },
    });
    return;
  }

  const jupiterData = upstreamResponse.data as JupiterV3PriceResponse;
  const priceEntry = jupiterData[tokenAddress];

  if (!priceEntry) {
    response.status(404).json({
      error: {
        message: `No price data found for token ${tokenAddress}. The token may not have sufficient DEX liquidity.`,
        code: "TOKEN_NOT_FOUND",
      },
    });
    return;
  }

  // Build normalized response
  const displayName = getTokenDisplayName(tokenAddress);

  response.json({
    source: "jupiter-aggregated-dex",
    provider: "conduit",
    upstream: "jup.ag",
    timestamp: new Date().toISOString(),
    token: {
      mint: tokenAddress,
      displayName,
      decimals: priceEntry.decimals,
    },
    price: {
      usd: priceEntry.usdPrice,
      change24hPercent: priceEntry.priceChange24h,
    },
    market: {
      liquidityUsd: priceEntry.liquidity,
      blockId: priceEntry.blockId,
      dataCreatedAt: priceEntry.createdAt,
    },
  });
}
