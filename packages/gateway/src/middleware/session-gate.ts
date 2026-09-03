/**
 * Session Gate Middleware
 *
 * Protects API routes by requiring a valid session with a signed IOU.
 * This is the core of the state channel — every paid API request
 * must include:
 *
 * Headers:
 *   X-SESSION: Base58 session PDA address
 *   X-IOU: JSON string of the signed IOU
 *   X-SIGNATURE: Base64-encoded ed25519 signature of the IOU
 *
 * The middleware:
 * 1. Extracts and validates all three headers
 * 2. Looks up the session in the session manager
 * 3. Verifies the IOU signature against the agent's public key
 * 4. Checks cumulative amount doesn't exceed the deposit
 * 5. Updates the session with the new IOU
 * 6. Adds the service price to the cumulative total
 */

import type { Request, Response, NextFunction } from "express";
import { getSession, updateSessionIou, type SignedIou } from "../services/session-manager.js";
import { verifyIouSignature, decodeBase58PublicKey } from "../services/iou-verifier.js";
import { logger } from "../utilities/logger.js";

interface SessionGateOptions {
  /** Price of this service in atomic USDC (added to cumulative total) */
  pricePerRequestAtomic: number;
}

/**
 * Creates middleware that enforces a valid session + signed IOU.
 * Each protected route specifies its price via options.
 */
export function createSessionGateMiddleware(options: SessionGateOptions) {
  return async function sessionGateMiddleware(
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    // --- Extract headers ---
    const sessionPda = request.headers["x-session"];
    const iouJson = request.headers["x-iou"];
    const signatureBase64 = request.headers["x-signature"];

    if (typeof sessionPda !== "string" || sessionPda.length === 0) {
      response.status(401).json({
        error: { message: "Missing X-SESSION header", code: "MISSING_SESSION" },
      });
      return;
    }

    if (typeof iouJson !== "string" || iouJson.length === 0) {
      response.status(401).json({
        error: { message: "Missing X-IOU header", code: "MISSING_IOU" },
      });
      return;
    }

    if (typeof signatureBase64 !== "string" || signatureBase64.length === 0) {
      response.status(401).json({
        error: { message: "Missing X-SIGNATURE header", code: "MISSING_SIGNATURE" },
      });
      return;
    }

    // --- Look up session ---
    const session = await getSession(sessionPda);

    if (session === null) {
      response.status(404).json({
        error: { message: "Session not found or expired", code: "SESSION_NOT_FOUND" },
      });
      return;
    }

    // --- Parse IOU ---
    let iou: SignedIou;
    try {
      const parsed = JSON.parse(iouJson) as Record<string, unknown>;
      iou = {
        session: String(parsed["session"]),
        cumulativeUsdc: Number(parsed["cumulative_usdc"]),
        requestCount: Number(parsed["request_count"]),
        timestamp: Number(parsed["timestamp"]),
      };
    } catch {
      response.status(400).json({
        error: { message: "Invalid IOU JSON format", code: "INVALID_IOU" },
      });
      return;
    }

    // --- Validate IOU session matches the channel id ---
    if (iou.session !== session.channelId) {
      response.status(400).json({
        error: { message: "IOU session (channelId) does not match the registered channel", code: "CHANNEL_MISMATCH" },
      });
      return;
    }

    // --- Check cumulative doesn't exceed deposit ---
    const newCumulative = iou.cumulativeUsdc;
    if (newCumulative > session.depositAmountAtomic) {
      response.status(402).json({
        error: {
          message: `Insufficient session balance. Cumulative: ${newCumulative}, Deposit: ${session.depositAmountAtomic}`,
          code: "INSUFFICIENT_BALANCE",
        },
      });
      return;
    }

    // --- Verify signature ---
    const signatureBytes = Uint8Array.from(Buffer.from(signatureBase64, "base64"));
    const agentPublicKeyBytes = decodeBase58PublicKey(session.agentPublicKey);

    const isSignatureValid = await verifyIouSignature(
      iou,
      signatureBytes,
      agentPublicKeyBytes
    );

    if (!isSignatureValid) {
      response.status(401).json({
        error: { message: "Invalid IOU signature", code: "INVALID_SIGNATURE" },
      });
      return;
    }

    // --- Update session with new IOU ---
    try {
      await updateSessionIou(sessionPda, iou, signatureBytes);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update session";
      response.status(400).json({
        error: { message: errorMessage, code: "IOU_UPDATE_FAILED" },
      });
      return;
    }

    logger.debug(
      `Session gate passed: ${sessionPda} — ${iou.cumulativeUsdc} atomic USDC (request #${iou.requestCount})`
    );

    next();
  };
}
