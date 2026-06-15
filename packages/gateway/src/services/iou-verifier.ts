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

/** Length of a channel id, matching the contract's `channel_id: [u8; 32]`. */
const CHANNEL_ID_LEN = 32;

/** Total signed-message length: channel_id (32) + cumulative_amount (8). */
const IOU_MESSAGE_LEN = 40;

/**
 * Serialize an IOU to the exact bytes signed off-chain and verified on-chain:
 *
 *   message = channel_id (32 bytes) || cumulative_amount (u64 LE, 8 bytes)
 *
 * `iou.session` MUST be the Base58-encoded 32-byte `channel_id` used when the
 * channel was opened (the contract's `channel.channel_id`). `requestCount` and
 * `timestamp` are off-chain bookkeeping only and are deliberately excluded —
 * the contract neither stores nor verifies them.
 *
 * MUST produce byte-identical output to the SDK's serializeIou and to the
 * contract's reconstructed message (verified there via brine-ed25519).
 */
export function serializeIouForSigning(iou: SignedIou): Uint8Array {
  const message = new Uint8Array(IOU_MESSAGE_LEN);
  message.set(decodeBase58PublicKey(iou.session), 0);

  let amount = BigInt(iou.cumulativeUsdc);
  if (amount < BigInt(0)) {
    throw new Error("cumulativeUsdc must be non-negative");
  }
  for (let i = 0; i < 8; i++) {
    message[CHANNEL_ID_LEN + i] = Number(amount & BigInt(0xff));
    amount = amount >> BigInt(8);
  }
  if (amount !== BigInt(0)) {
    throw new Error("cumulativeUsdc exceeds u64 range");
  }

  return message;
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
