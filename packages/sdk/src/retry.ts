/**
 * Retry Utility
 *
 * Exponential backoff with jitter for transient failures.
 * Used by the SDK's session client to retry failed API calls.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 500) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (caps exponential growth, default: 10_000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** If true, adds random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Optional predicate — only retry if this returns true for the error */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Optional callback fired before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Execute a function with automatic retry on failure.
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => session.fetch("/api/depin-weather/london", 1000),
 *   { maxRetries: 3, onRetry: (err, attempt) => console.log(`Retry #${attempt}`) }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt >= opts.maxRetries) break;

      // Check if we should retry this specific error
      if (opts.shouldRetry && !opts.shouldRetry(error, attempt + 1)) {
        break;
      }

      // Calculate delay with exponential backoff
      let delay = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt);
      delay = Math.min(delay, opts.maxDelayMs);

      // Add jitter (±25%) to prevent thundering herd
      if (opts.jitter) {
        const jitterRange = delay * 0.25;
        delay = delay + (Math.random() * 2 - 1) * jitterRange;
      }

      delay = Math.round(delay);

      // Notify before retry
      if (opts.onRetry) {
        opts.onRetry(error, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Default shouldRetry predicate for HTTP-based operations.
 * Retries on network errors, 429 (rate limited), and 5xx (server errors).
 * Does NOT retry on 4xx client errors (except 429).
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors (fetch failures, timeouts)
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  // Errors with HTTP status codes
  if (error && typeof error === "object" && "statusCode" in error) {
    const status = (error as { statusCode: number }).statusCode;
    return status === 429 || status >= 500;
  }

  // Generic errors that look transient
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("socket hang up") ||
      msg.includes("network")
    );
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
