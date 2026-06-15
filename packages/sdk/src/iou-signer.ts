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

/** Length of a channel id, matching the contract's `channel_id: [u8; 32]`. */
const CHANNEL_ID_LEN = 32;

/** Total signed-message length: channel_id (32) + cumulative_amount (8). */
const IOU_MESSAGE_LEN = 40;

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Decode a Base58 string (a 32-byte Solana key / channel id) to a fixed
 * 32-byte big-endian array. Matches the gateway's decodeBase58PublicKey.
 */
function decodeBase58ToBytes32(base58: string): Uint8Array {
  let value = BigInt(0);
  for (const char of base58) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base58 character: ${char}`);
    }
    value = value * BigInt(58) + BigInt(index);
  }

  const bytes = new Uint8Array(CHANNEL_ID_LEN);
  for (let i = CHANNEL_ID_LEN - 1; i >= 0; i--) {
    bytes[i] = Number(value & BigInt(0xff));
    value = value >> BigInt(8);
  }
  if (value !== BigInt(0)) {
    throw new Error("Base58 value exceeds 32 bytes");
  }
  return bytes;
}

/**
 * Serialize an IOU to the exact bytes the escrow contract verifies:
 *
 *   message = channel_id (32 bytes) || cumulative_amount (u64 LE, 8 bytes)
 *
 * `iou.session` MUST be the Base58-encoded 32-byte `channel_id` used when the
 * channel was opened (the value the contract stores in `channel.channel_id`).
 * `requestCount` and `timestamp` are off-chain bookkeeping only — the contract
 * neither stores nor verifies them, so they are deliberately excluded here.
 *
 * MUST produce byte-identical output to the gateway's serializeIouForSigning
 * and to the contract's reconstructed message.
 */
export function serializeIou(iou: IouMessage): Uint8Array {
  const message = new Uint8Array(IOU_MESSAGE_LEN);
  message.set(decodeBase58ToBytes32(iou.session), 0);

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
