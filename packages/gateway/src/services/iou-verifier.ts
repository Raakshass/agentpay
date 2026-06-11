/**
 * IOU Verifier
 *
 * Verifies ed25519 signatures on off-chain IOU messages.
 * Uses @noble/ed25519 which implements the same curve as Solana keypairs.
 *
 * This is the off-chain counterpart to brine-ed25519 on-chain.
 * Both verify the same signature format, ensuring the IOU signed
 * by the agent during Step B can be verified on-chain during Step C.
 */

import * as ed25519 from "@noble/ed25519";

import type { SignedIou } from "./session-manager.js";
import { logger } from "../utilities/logger.js";

/**
 * Serialize an IOU to the canonical byte format used for signing.
 * Both the SDK (signer) and gateway (verifier) must use this exact
 * serialization. The contract (brine-ed25519) will also verify
 * against this same byte format during settlement.
 */
export function serializeIouForSigning(iou: SignedIou): Uint8Array {
  const iouString = JSON.stringify({
    session: iou.session,
    cumulative_usdc: iou.cumulativeUsdc,
    request_count: iou.requestCount,
    timestamp: iou.timestamp,
  });

  return new TextEncoder().encode(iouString);
}

/**
 * Verify that an IOU was signed by the expected agent.
 *
 * Returns true if the signature is valid for the given IOU and public key.
 * Returns false if the signature is invalid or verification fails.
 */
export async function verifyIouSignature(
  iou: SignedIou,
  signature: Uint8Array,
  agentPublicKeyBytes: Uint8Array
): Promise<boolean> {
  try {
    const messageBytes = serializeIouForSigning(iou);

    const isValid = await ed25519.verifyAsync(
      signature,
      messageBytes,
      agentPublicKeyBytes
    );

    return isValid;
  } catch (error) {
    logger.error("IOU signature verification failed:", error);
    return false;
  }
}

/**
 * Decode a Base58 public key string to raw bytes.
 * Solana public keys are 32-byte ed25519 public keys encoded in Base58.
 */
export function decodeBase58PublicKey(base58Key: string): Uint8Array {
  // Base58 alphabet used by Bitcoin/Solana
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  let result = BigInt(0);
  for (const char of base58Key) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base58 character: ${char}`);
    }
    result = result * BigInt(58) + BigInt(index);
  }

  // Convert to 32-byte Uint8Array
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(result & BigInt(0xff));
    result = result >> BigInt(8);
  }

  return bytes;
}
