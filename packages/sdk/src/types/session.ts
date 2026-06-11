/**
 * Session Types
 *
 * Shared type definitions for the state channel protocol.
 * These types define the interface contract between SDK, gateway, and contract.
 */

/**
 * IOU message format.
 * Must match the serialization in both:
 * - Gateway's iou-verifier.ts (off-chain verification)
 * - Contract's settle_session instruction (on-chain verification via brine-ed25519)
 */
export interface IouMessage {
  /** Base58 escrow PDA address */
  session: string;

  /** Cumulative USDC spent in atomic units (monotonically increasing) */
  cumulativeUsdc: number;

  /** Total number of API requests made */
  requestCount: number;

  /** Unix timestamp in seconds */
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
