/**
 * Session Types
 *
 * Shared type definitions for the state channel protocol.
 * These types define the interface contract between SDK, gateway, and contract.
 */

/**
 * IOU message format.
 *
 * Only `session` (the channel id) and `cumulativeUsdc` are part of the signed
 * bytes; the contract verifies `channel_id (32) || cumulative_amount (u64 LE)`
 * via brine-ed25519. Serialization must match in all three layers:
 * - SDK's iou-signer.ts (serializeIou)
 * - Gateway's iou-verifier.ts (serializeIouForSigning)
 * - Contract's `settle` instruction
 */
export interface IouMessage {
  /**
   * Base58-encoded 32-byte `channel_id` — the value stored in the contract's
   * `channel.channel_id` (used as a PDA seed when the channel was opened).
   * This is what the signature is verified against on-chain; it is NOT the
   * channel PDA address.
   */
  session: string;

  /** Cumulative USDC spent in atomic units (monotonically increasing) */
  cumulativeUsdc: number;

  /** Total API requests made. Off-chain bookkeeping only — NOT signed. */
  requestCount: number;

  /** Unix timestamp in seconds. Off-chain bookkeeping only — NOT signed. */
  timestamp: number;
}

/** Session state as tracked by the SDK client */
export interface SessionState {
  /** Base58 escrow PDA address */
  sessionPda: string;

  /** Agent's Base58 public key */
  agentPublicKey: string;

  /** Total USDC deposited in atomic units */
  depositAmountAtomic: number;

  /** Current cumulative USDC used in atomic units */
  currentUsageAtomic: number;

  /** Total API requests made in this session */
  requestCount: number;

  /** Whether this session is still active */
  isActive: boolean;
}

/** Gateway's response when opening a session */
export interface OpenSessionResponse {
  status: "active";
  sessionPda: string;
  depositAmountAtomic: number;
  registeredAt: number;
  message: string;
}

/** Gateway's response when closing a session */
export interface CloseSessionResponse {
  status: "closed";
  sessionPda: string;
  usage: {
    totalRequestsMade: number;
    totalUsdcUsedAtomic: number;
    depositAmountAtomic: number;
    refundAmountAtomic: number;
  };
  settlement: {
    isSuccess: boolean;
    transactionSignature: string | null;
    reason?: string;
  };
}

/** Service entry from the gateway catalog */
export interface CatalogService {
  serviceId: string;
  displayName: string;
  description: string;
  category: string;
  pricing: {
    perRequestAtomic: number;
    currency: string;
    model: string;
  };
  endpoint: string;
}

/** Full catalog response from the gateway */
export interface CatalogResponse {
  protocol: string;
  version: string;
  paymentModel: string;
  network: string;
  totalServices: number;
  services: CatalogService[];
}
