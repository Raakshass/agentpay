/**
 * Helius Token Balances Routes
 *
 * Returns all SPL token balances for a Solana wallet address.
 * Uses the Solana JSON-RPC `getTokenAccountsByOwner` method directly —
 * no Helius API key required. Works with any RPC endpoint (public devnet,
 * Helius, QuickNode, etc.).
 *
 * Protected by session-gate middleware (valid IOU required).
 *
 * GET /api/helius-token-balances/:walletAddress
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { environmentConfig } from "../config/environment.js";
import { logger } from "../utilities/logger.js";

// ---------------------------------------------------------------------------
// Solana RPC response shapes (only the fields we consume)
// ---------------------------------------------------------------------------

interface TokenAccountInfo {
  mint: string;
  owner: string;
  tokenAmount: {
    amount: string;       // Raw atomic amount as string
    decimals: number;
    uiAmount: number | null;
    uiAmountString: string;
  };
  state: string;          // "initialized" | "frozen"
}

interface ParsedAccountData {
  parsed: {
    info: TokenAccountInfo;
    type: string;
  };
  program: string;
  space: number;
}

interface TokenAccountEntry {
  pubkey: string;
  account: {
    data: ParsedAccountData;
    executable: boolean;
    lamports: number;
    owner: string;
    rentEpoch: number;
  };
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: {
    context: { slot: number };
    value: TokenAccountEntry[];
  };
  error?: {
    code: number;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerHeliusRoutes(application: Express): void {
  const pricing = getServicePricing("helius-token-balances");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get(
    "/api/helius-token-balances/:walletAddress",
    sessionGate,
    handleTokenBalancesRequest
  );

  // Free, unauthenticated preview — same real data, no payment session.
  // Powers the web "Try it" playground so agents can sample before they pay.
  application.get(
    "/preview/helius-token-balances/:walletAddress",
    handleTokenBalancesRequest
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handleTokenBalancesRequest(
  request: Request,
  response: Response
): Promise<void> {
  const walletAddress = request.params["walletAddress"] as string | undefined;

  if (walletAddress === undefined || walletAddress.length === 0) {
    response.status(400).json({
      error: {
        message: "Wallet address parameter is required",
        code: "MISSING_WALLET_ADDRESS",
      },
    });
    return;
  }

  // Basic Solana address validation (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    response.status(400).json({
      error: {
        message: "Invalid Solana wallet address format",
        code: "INVALID_WALLET_ADDRESS",
      },
    });
    return;
  }

  const rpcUrl = environmentConfig.solana.rpcUrl;

  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed" },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await rpcResponse.json()) as RpcResponse;

    if (data.error) {
      logger.warn(
        `RPC error for getTokenAccountsByOwner(${walletAddress}): ${data.error.message}`
      );
      response.status(502).json({
        error: {
          message: "Solana RPC returned an error",
          code: "RPC_ERROR",
          details: data.error.message,
        },
      });
      return;
    }

    if (!data.result) {
      response.status(502).json({
        error: {
          message: "Unexpected RPC response format",
          code: "RPC_FORMAT_ERROR",
        },
      });
      return;
    }

    // --- Normalize into a clean response ---
    const balances = data.result.value.map((entry) => {
      const info = entry.account.data.parsed.info;
      return {
        mint: info.mint,
        tokenAccount: entry.pubkey,
        amount: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
        uiAmount: info.tokenAmount.uiAmount,
        uiAmountString: info.tokenAmount.uiAmountString,
        state: info.state,
      };
    });

    // Sort by uiAmount descending (largest balances first)
    balances.sort((a, b) => (b.uiAmount ?? 0) - (a.uiAmount ?? 0));

    response.json({
      source: "solana-rpc",
      provider: "conduit",
      timestamp: new Date().toISOString(),
      walletAddress,
      slot: data.result.context.slot,
      totalTokenAccounts: balances.length,
      balances,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      logger.warn(`RPC timeout for getTokenAccountsByOwner(${walletAddress})`);
      response.status(504).json({
        error: { message: "Solana RPC request timed out", code: "RPC_TIMEOUT" },
      });
      return;
    }

    logger.error(`Token balance fetch failed for ${walletAddress}`, error);
    response.status(502).json({
      error: {
        message: "Failed to fetch token balances",
        code: "UPSTREAM_ERROR",
      },
    });
  }
}
