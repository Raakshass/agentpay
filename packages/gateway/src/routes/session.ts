/**
 * Session Management Routes
 *
 * Endpoints for opening and closing payment sessions.
 * These are the on-ramp and off-ramp for the state channel.
 *
 * POST /session/open   — Register a session after on-chain deposit
 * POST /session/close  — Trigger settlement and close a session
 */

import type { Express } from "express";
import { registerSession, closeSession, getSession } from "../services/session-manager.js";
import { settleSessionOnChain } from "../services/settlement.js";
import { verifyOnChainDeposit } from "../services/deposit-verifier.js";
import { logger } from "../utilities/logger.js";

export function registerSessionRoutes(application: Express): void {
  /**
   * Open a session.
   *
   * Called by the agent AFTER they've deposited USDC on-chain
   * via the escrow contract. The gateway verifies the on-chain deposit
   * before registering the session — agents cannot fake deposits.
   */
  application.post("/session/open", async (request, response) => {
    const { sessionPda, channelId, agentPublicKey, providerPublicKey, depositAmountAtomic, usdcMint } = request.body as {
      sessionPda?: string;
      channelId?: string;
      agentPublicKey?: string;
      providerPublicKey?: string;
      depositAmountAtomic?: number;
      usdcMint?: string;
    };

    if (!sessionPda || !channelId || !agentPublicKey || !providerPublicKey || !depositAmountAtomic) {
      response.status(400).json({
        error: {
          message: "Missing required fields: sessionPda, channelId, agentPublicKey, providerPublicKey, depositAmountAtomic",
          code: "MISSING_FIELDS",
        },
      });
      return;
    }

    if (typeof depositAmountAtomic !== "number" || depositAmountAtomic <= 0) {
      response.status(400).json({
        error: {
          message: "depositAmountAtomic must be a positive number",
          code: "INVALID_DEPOSIT",
        },
      });
      return;
    }

    // Verify the on-chain deposit before registering the session.
    const verification = await verifyOnChainDeposit(
      sessionPda,
      agentPublicKey,
      providerPublicKey,
      depositAmountAtomic
    );

    if (!verification.verified) {
      logger.warn(`Deposit verification failed for ${sessionPda}: ${verification.reason}`);
      response.status(403).json({
        error: {
          message: `On-chain deposit verification failed: ${verification.reason}`,
          code: "DEPOSIT_UNVERIFIED",
        },
      });
      return;
    }

    try {
      const session = await registerSession(sessionPda, channelId, agentPublicKey, providerPublicKey, depositAmountAtomic, usdcMint);

      response.status(201).json({
        status: "active",
        sessionPda: session.sessionPda,
        depositAmountAtomic: session.depositAmountAtomic,
        registeredAt: session.registeredAt,
        depositVerified: true,
        message: "Session registered (deposit verified on-chain). Include X-SESSION, X-IOU, and X-SIGNATURE headers with API requests.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to open session";
      response.status(409).json({
        error: { message: errorMessage, code: "SESSION_CONFLICT" },
      });
    }
  });

  /**
   * Close a session and trigger on-chain settlement.
   *
   * Called by the agent when they're done using APIs.
   * The gateway submits the last signed IOU to the escrow contract.
   */
  application.post("/session/close", async (request, response) => {
    const { sessionPda } = request.body as { sessionPda?: string };

    if (!sessionPda) {
      response.status(400).json({
        error: { message: "Missing required field: sessionPda", code: "MISSING_SESSION_PDA" },
      });
      return;
    }

    const session = await getSession(sessionPda);

    if (session === null) {
      response.status(404).json({
        error: { message: "Session not found", code: "SESSION_NOT_FOUND" },
      });
      return;
    }

    // Attempt on-chain settlement
    const settlementResult = await settleSessionOnChain(session);

    // Remove session from memory regardless of settlement outcome
    await closeSession(sessionPda);

    logger.info(
      `Session closed: ${sessionPda}. ` +
      `Usage: ${session.latestIou?.cumulativeUsdc ?? 0} atomic USDC over ${session.latestIou?.requestCount ?? 0} requests.`
    );

    response.json({
      status: "closed",
      sessionPda,
      usage: {
        totalRequestsMade: session.latestIou?.requestCount ?? 0,
        totalUsdcUsedAtomic: session.latestIou?.cumulativeUsdc ?? 0,
        depositAmountAtomic: session.depositAmountAtomic,
        refundAmountAtomic: session.depositAmountAtomic - (session.latestIou?.cumulativeUsdc ?? 0),
      },
      settlement: settlementResult,
    });
  });
}
