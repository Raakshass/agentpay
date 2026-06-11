/**
 * IOU Signer
 *
 * Signs IOU messages with the agent's ed25519 keypair.
 * The signed IOU is sent to the gateway with each API request
 * as proof of payment authorization.
 *
 * Serialization format MUST match:
 * - Gateway's iou-verifier.ts (verifyIouSignature)
 * - Contract's settle_session (brine-ed25519 verification)
 */

import * as ed25519 from "@noble/ed25519";
import type { IouMessage } from "./types/session.js";

/**
 * Serialize an IOU to the canonical byte format for signing.
 * This function MUST produce identical bytes as the gateway's
 * serializeIouForSigning function.
 */
export function serializeIou(iou: IouMessage): Uint8Array {
  const iouString = JSON.stringify({
    session: iou.session,
    cumulative_usdc: iou.cumulativeUsdc,
    request_count: iou.requestCount,
    timestamp: iou.timestamp,
  });

  return new TextEncoder().encode(iouString);
}

/**
 * Sign an IOU message with the agent's private key.
 * Returns the raw 64-byte ed25519 signature.
 */
export async function signIou(
  iou: IouMessage,
  agentPrivateKey: Uint8Array
): Promise<Uint8Array> {
  const messageBytes = serializeIou(iou);
  const signature = await ed25519.signAsync(messageBytes, agentPrivateKey);
  return signature;
}

/**
 * Build a new IOU for the next API request.
 * Increments request count and adds the service price to cumulative usage.
 */
export function buildNextIou(
  sessionPda: string,
  currentUsageAtomic: number,
  currentRequestCount: number,
  servicePriceAtomic: number
): IouMessage {
  return {
    session: sessionPda,
    cumulativeUsdc: currentUsageAtomic + servicePriceAtomic,
    requestCount: currentRequestCount + 1,
    timestamp: Math.floor(Date.now() / 1000),
  };
}
