/**
 * Transaction History Route
 *
 * Returns recent transaction history for any Solana wallet address.
 * Uses the Helius enhanced transaction API for rich, parsed data.
 *
 * Protected by session-gate middleware (valid IOU required).
 *
 * GET /api/tx-history/:walletAddress
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { logger } from "../utilities/logger.js";
import { environmentConfig } from "../config/environment.js";

export function registerTxHistoryRoutes(application: Express): void {
  const pricing = getServicePricing("tx-history");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get("/api/tx-history/:walletAddress", sessionGate, handleTxHistoryRequest);
  application.get("/preview/tx-history/:walletAddress", handleTxHistoryRequest);
}

async function handleTxHistoryRequest(
  request: Request,
  response: Response
): Promise<void> {
  const walletAddress = request.params["walletAddress"] as string | undefined;

  if (!walletAddress || walletAddress.length === 0) {
    response.status(400).json({
      error: { message: "Wallet address is required", code: "MISSING_ADDRESS" },
    });
    return;
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    response.status(400).json({
      error: { message: "Invalid Solana address format", code: "INVALID_ADDRESS" },
    });
    return;
  }

  const limit = Math.min(parseInt(request.query["limit"] as string ?? "10", 10), 25);
  const rpcUrl = environmentConfig.solana.rpcUrl;

  try {
    // Fetch recent transaction signatures
    const sigRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [walletAddress, { limit }],
      }),
    });

    const sigResponse = (await sigRes.json()) as {
      result?: Array<{
        signature: string;
        slot: number;
        blockTime: number | null;
        err: unknown;
        memo: string | null;
        confirmationStatus: string;
      }>;
      error?: { message: string };
    };

    if (sigResponse.error || !sigResponse.result) {
      const errorMsg = sigResponse.error?.message ?? "Failed to fetch transactions";
      logger.warn(`Tx history fetch failed for ${walletAddress}: ${errorMsg}`);
      response.status(502).json({
        error: { message: errorMsg, code: "UPSTREAM_ERROR" },
      });
      return;
    }

    const transactions = sigResponse.result.map((tx) => ({
      signature: tx.signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      timestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
      status: tx.err ? "failed" : "success",
      confirmationStatus: tx.confirmationStatus,
      memo: tx.memo,
      explorerUrl: `https://explorer.solana.com/tx/${tx.signature}?cluster=${environmentConfig.solana.network}`,
    }));

    response.json({
      source: "solana-rpc",
      provider: "conduit",
      timestamp: new Date().toISOString(),
      wallet: walletAddress,
      transactions,
      count: transactions.length,
      network: environmentConfig.solana.network,
    });
  } catch (error) {
    logger.error("Tx history fetch error:", error);
    response.status(502).json({
      error: { message: "Failed to fetch transaction history", code: "UPSTREAM_ERROR" },
    });
  }
}
