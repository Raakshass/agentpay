/**
 * Jupiter DEX Swap Quote Route
 *
 * Returns real-time swap quotes from the Jupiter DEX aggregator.
 * Covers every token pair on Solana with optimal routing across all DEXes.
 *
 * Protected by session-gate middleware (valid IOU required).
 *
 * GET /api/jupiter-quote/:inputMint/:outputMint/:amount
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { forwardToUpstream } from "../services/upstream-proxy.js";
import { logger } from "../utilities/logger.js";

export function registerJupiterRoutes(application: Express): void {
  const pricing = getServicePricing("jupiter-quote");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get(
    "/api/jupiter-quote/:inputMint/:outputMint/:amount",
    sessionGate,
    handleJupiterQuoteRequest
  );

  application.get(
    "/preview/jupiter-quote/:inputMint/:outputMint/:amount",
    handleJupiterQuoteRequest
  );
}

async function handleJupiterQuoteRequest(
  request: Request,
  response: Response
): Promise<void> {
  const inputMint = request.params["inputMint"] as string | undefined;
  const outputMint = request.params["outputMint"] as string | undefined;
  const amount = request.params["amount"] as string | undefined;

  if (!inputMint || !outputMint || !amount) {
    response.status(400).json({
      error: {
        message: "Required params: inputMint, outputMint, amount (in atomic units)",
        code: "MISSING_PARAMS",
      },
    });
    return;
  }

  // Validate amount is a positive integer
  const amountNum = parseInt(amount, 10);
  if (isNaN(amountNum) || amountNum <= 0) {
    response.status(400).json({
      error: { message: "Amount must be a positive integer (atomic units)", code: "INVALID_AMOUNT" },
    });
    return;
  }

  const upstreamUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;

  const upstreamResponse = await forwardToUpstream({
    url: upstreamUrl,
    method: "GET",
    timeoutMilliseconds: 10_000,
  });

  if (!upstreamResponse.isSuccess) {
    logger.warn(`Jupiter quote failed: ${upstreamResponse.statusCode}`);
    response.status(502).json({
      error: {
        message: "Failed to fetch swap quote from Jupiter",
        code: "UPSTREAM_ERROR",
        upstream: upstreamResponse.data,
      },
    });
    return;
  }

  const data = upstreamResponse.data as Record<string, unknown>;

  response.json({
    source: "jupiter-dex-aggregator",
    provider: "conduit",
    upstream: "jup.ag",
    timestamp: new Date().toISOString(),
    quote: {
      inputMint,
      outputMint,
      inputAmount: amount,
      outputAmount: data["outAmount"],
      priceImpactPct: data["priceImpactPct"],
      slippageBps: 50,
      routePlan: data["routePlan"],
    },
  });
}
