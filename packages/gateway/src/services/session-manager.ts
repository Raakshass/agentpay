/**
 * Session Manager
 *
 * Tracks active payment sessions using a Redis-backed store (production)
 * or in-memory store (local dev). Each session represents a state channel
 * between an agent and the gateway:
 *
 * - Agent deposits USDC on-chain (open_session on escrow contract)
 * - Agent provides the session PDA address to the gateway
 * - Gateway tracks cumulative usage via signed IOUs
 * - When session ends, gateway settles on-chain
 *
 * Sessions are persisted with a TTL so they auto-expire after the timeout.
 * If the gateway restarts, active sessions are recovered from Redis.
 * If no Redis is configured, falls back to in-memory (dev mode only).
 */

import { logger } from "../utilities/logger.js";
import { getSessionStore, type SessionStore } from "./redis-client.js";

export interface SignedIou {
  /**
   * Base58-encoded 32-byte `channel_id` (the contract's `channel.channel_id`),
   * NOT the channel PDA address. This is the value the signature is verified
   * against on-chain.
   */
  session: string;

  /** Cumulative USDC spent in atomic units (monotonically increasing) */
  cumulativeUsdc: number;

  /** Total API requests made in this session. Off-chain only — NOT signed. */
  requestCount: number;

  /** Unix timestamp when this IOU was signed. Off-chain only — NOT signed. */
  timestamp: number;
}

export interface ActiveSession {
  /** Base58 escrow PDA address (used for session lookup) */
  sessionPda: string;

  /**
   * Base58-encoded raw 32-byte channel identifier.
   * This is the value the agent chose when calling `open_channel` on-chain.
   * It is NOT the PDA — it is one of the PDA seeds.
   * IOU messages are signed over: channel_id (32) || cumulative (8 LE).
   */
  channelId: string;

  /** Agent's Base58 public key */
  agentPublicKey: string;

  /** Base58 provider public key (receives settled funds) */
  providerPublicKey: string;

  /** Total USDC deposited in atomic units */
  depositAmountAtomic: number;

  /** USDC mint address for this channel (overrides env default if set) */
  usdcMint?: string;

  /** The latest signed IOU from the agent (highest cumulative amount) */
  latestIou: SignedIou | null;

  /** Raw signature bytes of the latest IOU (for on-chain settlement), base64-encoded for storage */
  latestIouSignatureBase64: string | null;

  /** When the session was registered with the gateway */
  registeredAt: number;
}

/** Default session TTL: 1 hour */
const SESSION_TTL_SECONDS = parseInt(process.env["SESSION_TIMEOUT_SECONDS"] ?? "3600", 10);

let _store: SessionStore | null = null;

function getStore(): SessionStore {
  if (_store === null) {
    _store = getSessionStore();
  }
  return _store;
}

/**
 * Register a new session after the agent has deposited on-chain.
 */
export async function registerSession(
  sessionPda: string,
  channelId: string,
  agentPublicKey: string,
  providerPublicKey: string,
  depositAmountAtomic: number,
  usdcMint?: string
): Promise<ActiveSession> {
  const store = getStore();

  const existing = await store.get(sessionPda);
  if (existing !== null) {
    throw new Error(`Session ${sessionPda} is already registered`);
  }

  const session: ActiveSession = {
    sessionPda,
    channelId,
    agentPublicKey,
    providerPublicKey,
    depositAmountAtomic,
    usdcMint,
    latestIou: null,
    latestIouSignatureBase64: null,
    registeredAt: Date.now(),
  };

  await store.set(sessionPda, JSON.stringify(session), SESSION_TTL_SECONDS);
  logger.info(`Session registered: ${sessionPda} (${depositAmountAtomic} atomic USDC)`);

  return session;
}

/**
 * Get an active session by its PDA address.
 * Returns null if the session doesn't exist or has expired.
 */
export async function getSession(sessionPda: string): Promise<ActiveSession | null> {
  const store = getStore();
  const raw = await store.get(sessionPda);
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as ActiveSession;
  } catch {
    logger.error(`Failed to parse session data for ${sessionPda}`);
    return null;
  }
}

/**
 * Update the latest IOU for a session.
 * Only accepts IOUs with a higher cumulative amount than the current one
 * (monotonically increasing — prevents replay of older IOUs).
 */
export async function updateSessionIou(
  sessionPda: string,
  iou: SignedIou,
  signature: Uint8Array
): Promise<void> {
  const store = getStore();
  const session = await getSession(sessionPda);

  if (session === null) {
    throw new Error(`Session ${sessionPda} not found`);
  }

  if (iou.cumulativeUsdc > session.depositAmountAtomic) {
    throw new Error(
      `IOU cumulative amount (${iou.cumulativeUsdc}) exceeds deposit (${session.depositAmountAtomic})`
    );
  }

  if (session.latestIou !== null && iou.cumulativeUsdc <= session.latestIou.cumulativeUsdc) {
    throw new Error(
      `IOU cumulative amount (${iou.cumulativeUsdc}) must be greater than current (${session.latestIou.cumulativeUsdc})`
    );
  }

  session.latestIou = iou;
  session.latestIouSignatureBase64 = Buffer.from(signature).toString("base64");

  // Persist updated session (refresh TTL)
  await store.set(sessionPda, JSON.stringify(session), SESSION_TTL_SECONDS);

  logger.debug(
    `Session ${sessionPda}: IOU updated to ${iou.cumulativeUsdc} atomic USDC (${iou.requestCount} requests)`
  );
}

/**
 * Remove a session after settlement or refund.
 * Returns the session data for settlement processing.
 */
export async function closeSession(sessionPda: string): Promise<ActiveSession | null> {
  const store = getStore();
  const session = await getSession(sessionPda);

  if (session === null) {
    return null;
  }

  await store.delete(sessionPda);
  logger.info(`Session closed: ${sessionPda}`);

  return session;
}

/**
 * Get the count of currently active sessions.
 * Useful for health checks and monitoring.
 */
export async function getActiveSessionCount(): Promise<number> {
  const store = getStore();
  return store.size();
}

/**
 * Helper: convert base64 signature back to Uint8Array for settlement.
 */
export function signatureFromBase64(base64: string | null): Uint8Array | null {
  if (base64 === null) return null;
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
