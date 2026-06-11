/**
 * Session Manager
 *
 * Tracks active payment sessions in memory. Each session represents
 * a state channel between an agent and the gateway:
 *
 * - Agent deposits USDC on-chain (open_session on escrow contract)
 * - Agent provides the session PDA address to the gateway
 * - Gateway tracks cumulative usage via signed IOUs
 * - When session ends, gateway settles on-chain
 *
 * In-memory storage is acceptable for MVP because:
 * - Sessions are short-lived (1 hour timeout)
 * - If gateway restarts, agents can claim timeout refund on-chain
 * - Production version will use Redis for persistence
 */

import { logger } from "../utilities/logger.js";

export interface SignedIou {
  /** Base58 escrow PDA address */
  session: string;

  /** Cumulative USDC spent in atomic units (monotonically increasing) */
  cumulativeUsdc: number;

  /** Total number of API requests made in this session */
  requestCount: number;

  /** Unix timestamp when this IOU was signed */
  timestamp: number;
}

export interface ActiveSession {
  /** Base58 escrow PDA address (also the session identifier) */
  sessionPda: string;

  /** Agent's Base58 public key */
  agentPublicKey: string;

  /** Total USDC deposited in atomic units */
  depositAmountAtomic: number;

  /** The latest signed IOU from the agent (highest cumulative amount) */
  latestIou: SignedIou | null;

  /** Raw signature bytes of the latest IOU (for on-chain settlement) */
  latestIouSignature: Uint8Array | null;

  /** When the session was registered with the gateway */
  registeredAt: number;
}

/** In-memory session store. Key = session PDA address. */
const activeSessions = new Map<string, ActiveSession>();

/**
 * Register a new session after the agent has deposited on-chain.
 * The gateway doesn't verify the on-chain deposit here — that's
 * done when the session is first used (lazy verification).
 */
export function registerSession(
  sessionPda: string,
  agentPublicKey: string,
  depositAmountAtomic: number
): ActiveSession {
  if (activeSessions.has(sessionPda)) {
    throw new Error(`Session ${sessionPda} is already registered`);
  }

  const session: ActiveSession = {
    sessionPda,
    agentPublicKey,
    depositAmountAtomic,
    latestIou: null,
    latestIouSignature: null,
    registeredAt: Date.now(),
  };

  activeSessions.set(sessionPda, session);
  logger.info(`Session registered: ${sessionPda} (${depositAmountAtomic} atomic USDC)`);

  return session;
}

/**
 * Get an active session by its PDA address.
 * Returns null if the session doesn't exist or has been closed.
 */
export function getSession(sessionPda: string): ActiveSession | null {
  return activeSessions.get(sessionPda) ?? null;
}

/**
 * Update the latest IOU for a session.
 * Only accepts IOUs with a higher cumulative amount than the current one
 * (monotonically increasing — prevents replay of older IOUs).
 */
export function updateSessionIou(
  sessionPda: string,
  iou: SignedIou,
  signature: Uint8Array
): void {
  const session = activeSessions.get(sessionPda);

  if (session === undefined) {
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
  session.latestIouSignature = signature;

  logger.debug(
    `Session ${sessionPda}: IOU updated to ${iou.cumulativeUsdc} atomic USDC (${iou.requestCount} requests)`
  );
}

/**
 * Remove a session after settlement or refund.
 * Returns the session data for settlement processing.
 */
export function closeSession(sessionPda: string): ActiveSession | null {
  const session = activeSessions.get(sessionPda);

  if (session === undefined) {
    return null;
  }

  activeSessions.delete(sessionPda);
  logger.info(`Session closed: ${sessionPda}`);

  return session;
}

/**
 * Get the count of currently active sessions.
 * Useful for health checks and monitoring.
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}
