/**
 * Conduit SDK Error Classes
 *
 * Typed error hierarchy for clear error handling by agents.
 * Each error includes a machine-readable code, a human-readable message,
 * and optional context for debugging.
 */

/** Base error class for all Conduit SDK errors. */
export class ConduitError extends Error {
  /** Machine-readable error code matching gateway error codes */
  readonly code: string;
  /** HTTP status code if this came from a gateway response */
  readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = "ConduitError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Thrown when a session operation fails (open, close, not found). */
export class SessionError extends ConduitError {
  constructor(message: string, code = "SESSION_ERROR", statusCode?: number) {
    super(message, code, statusCode);
    this.name = "SessionError";
  }
}

/** Thrown when the session has insufficient balance for an API call. */
export class InsufficientBalanceError extends ConduitError {
  /** Remaining balance in atomic USDC */
  readonly remainingAtomic: number;
  /** Price of the requested service in atomic USDC */
  readonly priceAtomic: number;

  constructor(remainingAtomic: number, priceAtomic: number) {
    super(
      `Insufficient session balance: ${remainingAtomic} atomic USDC remaining, ` +
        `but the service costs ${priceAtomic} atomic USDC. ` +
        `Open a new session with a larger deposit.`,
      "INSUFFICIENT_BALANCE",
      402
    );
    this.name = "InsufficientBalanceError";
    this.remainingAtomic = remainingAtomic;
    this.priceAtomic = priceAtomic;
  }
}

/** Thrown when IOU signature verification fails. */
export class SignatureError extends ConduitError {
  constructor(message = "IOU signature verification failed") {
    super(message, "INVALID_SIGNATURE", 401);
    this.name = "SignatureError";
  }
}

/** Thrown when the gateway or upstream API is unreachable or times out. */
export class GatewayError extends ConduitError {
  /** The upstream URL that failed, if applicable */
  readonly upstreamUrl?: string;

  constructor(message: string, upstreamUrl?: string, statusCode?: number) {
    super(message, "GATEWAY_ERROR", statusCode ?? 502);
    this.name = "GatewayError";
    this.upstreamUrl = upstreamUrl;
  }
}

/** Thrown when the gateway rate limits the agent. */
export class RateLimitError extends ConduitError {
  /** Milliseconds to wait before retrying */
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(
      `Rate limited. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      "RATE_LIMITED",
      429
    );
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Thrown when settlement fails on-chain. */
export class SettlementError extends ConduitError {
  /** Solana transaction signature if available */
  readonly transactionSignature?: string;

  constructor(message: string, transactionSignature?: string) {
    super(message, "SETTLEMENT_FAILED", 500);
    this.name = "SettlementError";
    this.transactionSignature = transactionSignature;
  }
}

/** Thrown when the on-chain deposit doesn't match or can't be verified. */
export class DepositError extends ConduitError {
  constructor(message: string) {
    super(message, "DEPOSIT_UNVERIFIED", 403);
    this.name = "DepositError";
  }
}

/**
 * Parse a gateway error response into a typed ConduitError.
 * Used internally by the SDK to convert HTTP error responses.
 */
export function parseGatewayError(
  statusCode: number,
  body: { error?: { message?: string; code?: string; retryAfterMs?: number } }
): ConduitError {
  const errorBody = body?.error;
  const message = errorBody?.message ?? "Unknown gateway error";
  const code = errorBody?.code ?? "UNKNOWN";

  switch (code) {
    case "INSUFFICIENT_BALANCE":
      return new InsufficientBalanceError(0, 0);
    case "INVALID_SIGNATURE":
      return new SignatureError(message);
    case "RATE_LIMITED":
    case "SESSION_RATE_LIMITED":
      return new RateLimitError(errorBody?.retryAfterMs ?? 60_000);
    case "SESSION_NOT_FOUND":
      return new SessionError(message, code, statusCode);
    case "DEPOSIT_UNVERIFIED":
      return new DepositError(message);
    case "UPSTREAM_ERROR":
      return new GatewayError(message, undefined, statusCode);
    default:
      return new ConduitError(message, code, statusCode);
  }
}
