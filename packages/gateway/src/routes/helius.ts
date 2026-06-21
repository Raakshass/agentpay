/**
 * Helius Enhanced API Routes
 *
 * Proxies to Helius for Solana blockchain data.
 * Protected by session-gate middleware.
 *
 * GET /api/helius-token-balances/:walletAddress
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { environmentConfig } from "../config/environment.js";
import { forwardToUpstream } from "../services/upstream-proxy.js";

export function registerHeliusRoutes(application: Express): void {
  const pricing = getServicePricing("helius-token-balances");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get("/api/helius-token-balances/:walletAddress", sessionGate, handleTokenBalancesRequest);
}

async function handleTokenBalancesRequest(
  request: Request,
  response: Response
): Promise<void> {
  const walletAddress = request.params["walletAddress"];

  if (walletAddress === undefined || walletAddress.length === 0) {
    response.status(400).json({
      error: { message: "Wallet address parameter is required", code: "MISSING_WALLET_ADDRESS" },
    });
    return;
  }

  const apiKey = environmentConfig.upstreamApis.heliusApiKey;
  const upstreamUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/balances?api-key=${apiKey}`;

  const upstreamResponse = await forwardToUpstream({ url: upstreamUrl, method: "GET" });

  if (!upstreamResponse.isSuccess) {
    response.status(upstreamResponse.statusCode).json({
      error: { message: "Failed to fetch token balances", code: "UPSTREAM_ERROR", upstream: upstreamResponse.data },
    });
    return;
  }

  response.json({
    source: "helius-enhanced-api",
    provider: "conduit",
    timestamp: new Date().toISOString(),
    walletAddress,
    data: upstreamResponse.data,
  });
}
