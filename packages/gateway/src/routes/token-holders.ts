/**
 * Token Holders Route
 *
 * Returns the top holders for any SPL token on Solana.
 * Uses the Helius RPC's getTokenLargestAccounts method.
 *
 * Protected by session-gate middleware (valid IOU required).
 *
 * GET /api/token-holders/:mintAddress
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { logger } from "../utilities/logger.js";
import { environmentConfig } from "../config/environment.js";

export function registerTokenHoldersRoutes(application: Express): void {
  const pricing = getServicePricing("token-holders");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get("/api/token-holders/:mintAddress", sessionGate, handleTokenHoldersRequest);
  application.get("/preview/token-holders/:mintAddress", handleTokenHoldersRequest);
}

async function handleTokenHoldersRequest(
  request: Request,
  response: Response
): Promise<void> {
  const mintAddress = request.params["mintAddress"] as string | undefined;

  if (!mintAddress || mintAddress.length === 0) {
    response.status(400).json({
      error: { message: "Token mint address is required", code: "MISSING_MINT" },
    });
    return;
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintAddress)) {
    response.status(400).json({
      error: { message: "Invalid Solana address format", code: "INVALID_ADDRESS" },
    });
    return;
  }

  const rpcUrl = environmentConfig.solana.rpcUrl;

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenLargestAccounts",
        params: [mintAddress],
      }),
    });

    const rpcResponse = (await res.json()) as {
      result?: {
        value: Array<{
          address: string;
          amount: string;
          decimals: number;
          uiAmount: number | null;
          uiAmountString: string;
        }>;
      };
      error?: { message: string };
    };

    if (rpcResponse.error || !rpcResponse.result) {
      const errorMsg = rpcResponse.error?.message ?? "Failed to fetch token holders";
      logger.warn(`Token holders fetch failed for ${mintAddress}: ${errorMsg}`);
      response.status(502).json({
        error: { message: errorMsg, code: "UPSTREAM_ERROR" },
      });
      return;
    }

    const holders = rpcResponse.result.value.map((holder, index) => ({
      rank: index + 1,
      tokenAccount: holder.address,
      balance: holder.uiAmountString,
      balanceAtomic: holder.amount,
      decimals: holder.decimals,
    }));

    response.json({
      source: "solana-rpc",
      provider: "conduit",
      timestamp: new Date().toISOString(),
      token: {
        mint: mintAddress,
      },
      holders,
      totalHoldersReturned: holders.length,
    });
  } catch (error) {
    logger.error("Token holders fetch error:", error);
    response.status(502).json({
      error: { message: "Failed to fetch token holders", code: "UPSTREAM_ERROR" },
    });
  }
}
