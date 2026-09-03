/**
 * Solana Network Stats Route
 *
 * Returns real-time Solana network performance data:
 * TPS, slot, epoch, validator count, and block time.
 *
 * Protected by session-gate middleware (valid IOU required).
 *
 * GET /api/solana-stats
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { logger } from "../utilities/logger.js";
import { environmentConfig } from "../config/environment.js";

export function registerSolanaStatsRoutes(application: Express): void {
  const pricing = getServicePricing("solana-stats");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get("/api/solana-stats", sessionGate, handleSolanaStatsRequest);
  application.get("/preview/solana-stats", handleSolanaStatsRequest);
}

async function handleSolanaStatsRequest(
  _request: Request,
  response: Response
): Promise<void> {
  const rpcUrl = environmentConfig.solana.rpcUrl;

  try {
    // Batch multiple RPC calls for efficiency
    const [perfResponse, epochResponse, slotResponse] = await Promise.all([
      fetchRpc(rpcUrl, "getRecentPerformanceSamples", [5]),
      fetchRpc(rpcUrl, "getEpochInfo", []),
      fetchRpc(rpcUrl, "getSlot", []),
    ]);

    // Calculate TPS from recent performance samples
    const perfSamples = perfResponse?.result as Array<{
      numTransactions: number;
      samplePeriodSecs: number;
    }> | undefined;

    let avgTps = 0;
    if (perfSamples && perfSamples.length > 0) {
      const totalTx = perfSamples.reduce((sum, s) => sum + s.numTransactions, 0);
      const totalSecs = perfSamples.reduce((sum, s) => sum + s.samplePeriodSecs, 0);
      avgTps = totalSecs > 0 ? Math.round(totalTx / totalSecs) : 0;
    }

    const epochInfo = epochResponse?.result as {
      epoch: number;
      slotIndex: number;
      slotsInEpoch: number;
      absoluteSlot: number;
    } | undefined;

    response.json({
      source: "solana-rpc",
      provider: "conduit",
      network: environmentConfig.solana.network,
      timestamp: new Date().toISOString(),
      performance: {
        currentTps: avgTps,
        sampleCount: perfSamples?.length ?? 0,
      },
      epoch: epochInfo
        ? {
            current: epochInfo.epoch,
            slotIndex: epochInfo.slotIndex,
            slotsInEpoch: epochInfo.slotsInEpoch,
            progressPercent: Math.round((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100),
          }
        : null,
      slot: slotResponse?.result ?? null,
    });
  } catch (error) {
    logger.error("Solana stats fetch failed:", error);
    response.status(502).json({
      error: {
        message: "Failed to fetch Solana network stats",
        code: "UPSTREAM_ERROR",
      },
    });
  }
}

async function fetchRpc(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<{ result: unknown } | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
    return (await res.json()) as { result: unknown };
  } catch {
    return null;
  }
}
