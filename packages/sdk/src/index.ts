/**
 * Conduit SDK — Public API
 *
 * Everything an AI agent needs to consume paid APIs via state channels.
 */

export { ConduitSession, bytesToBase58 } from "./session-client.js";
export type { OpenSessionParams, UsageSummary } from "./session-client.js";
export { fetchCatalog, findService } from "./catalog-client.js";
export { signIou, buildNextIou, serializeIou } from "./iou-signer.js";
export {
  openChannel,
  claimRefund,
  deriveChannelPda,
  generateChannelId,
  DEFAULT_ESCROW_PROGRAM_ID,
} from "./channel-client.js";
export type {
  OpenChannelParams,
  OpenChannelResult,
  ClaimRefundParams,
} from "./channel-client.js";

// Error classes for typed error handling
export {
  ConduitError,
  SessionError,
  InsufficientBalanceError,
  SignatureError,
  GatewayError,
  RateLimitError,
  SettlementError,
  DepositError,
  parseGatewayError,
} from "./errors.js";

// Retry utility for custom retry strategies
export { withRetry, isRetryableError } from "./retry.js";
export type { RetryOptions } from "./retry.js";

export type {
  IouMessage,
  SessionState,
  OpenSessionResponse,
  CloseSessionResponse,
  CatalogService,
  CatalogResponse,
} from "./types/session.js";
