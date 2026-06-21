/**
 * Birdeye Token Price Routes
 *
 * Proxies to Birdeye for real-time Solana token prices.
 * Protected by session-gate middleware.
 *
 * GET /api/birdeye-token-price/:tokenAddress
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { forwardToUpstream } from "../services/upstream-proxy.js";

export function registerBirdeyeRoutes(application: Express): void {
  const pricing = getServicePricing("birdeye-token-price");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get("/api/birdeye-token-price/:tokenAddress", sessionGate, handleTokenPriceRequest);
}

async function handleTokenPriceRequest(
  request: Request,
  response: Response
): Promise<void> {
  const tokenAddress = request.params["tokenAddress"];

  if (tokenAddress === undefined || tokenAddress.length === 0) {
    response.status(400).json({
      error: { message: "Token address parameter is required", code: "MISSING_TOKEN_ADDRESS" },
    });
    return;
  }

  const upstreamUrl = `https://public-api.birdeye.so/defi/price?address=${tokenAddress}`;

  const upstreamResponse = await forwardToUpstream({
    url: upstreamUrl,
    method: "GET",
    headers: { "X-API-KEY": "public" },
  });

  if (!upstreamResponse.isSuccess) {
    response.status(upstreamResponse.statusCode).json({
      error: { message: "Failed to fetch token price", code: "UPSTREAM_ERROR", upstream: upstreamResponse.data },
    });
    return;
  }

  response.json({
    source: "birdeye-aggregated-dex",
    provider: "conduit",
    timestamp: new Date().toISOString(),
    tokenAddress,
    data: upstreamResponse.data,
  });
}
