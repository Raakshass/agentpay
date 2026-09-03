/**
 * Rate Limiter Middleware
 *
 * Protects the gateway from abuse:
 * - Public endpoints (health, catalog, session): 60 requests/minute per IP
 * - Paid API endpoints: 300 requests/minute per session
 *
 * Uses a simple sliding-window counter in memory. For production scale,
 * this can be swapped for a Redis-backed limiter.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../utilities/logger.js";

interface RateBucket {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, RateBucket>();
const sessionBuckets = new Map<string, RateBucket>();

/** Clean up expired buckets every 5 minutes to prevent memory leaks. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of ipBuckets) {
    if (bucket.resetAt <= now) ipBuckets.delete(key);
  }
  for (const [key, bucket] of sessionBuckets) {
    if (bucket.resetAt <= now) sessionBuckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);

function checkLimit(
  bucketMap: Map<string, RateBucket>,
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = bucketMap.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    bucketMap.set(key, bucket);
  }

  bucket.count++;

  return {
    allowed: bucket.count <= maxRequests,
    remaining: Math.max(0, maxRequests - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * Rate limiter for public endpoints (by IP address).
 * Default: 60 requests per minute.
 */
export function publicRateLimiter(maxRequests = 60, windowMs = 60_000) {
  return function rateLimitMiddleware(
    request: Request,
    response: Response,
    next: NextFunction
  ): void {
    const ip =
      (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      request.socket.remoteAddress ??
      "unknown";

    const result = checkLimit(ipBuckets, ip, maxRequests, windowMs);

    response.set("X-RateLimit-Limit", String(maxRequests));
    response.set("X-RateLimit-Remaining", String(result.remaining));
    response.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      response.status(429).json({
        error: {
          message: "Too many requests. Please slow down.",
          code: "RATE_LIMITED",
          retryAfterMs: result.resetAt - Date.now(),
        },
      });
      return;
    }

    next();
  };
}

/**
 * Rate limiter for paid API endpoints (by session PDA).
 * Default: 300 requests per minute per session.
 */
export function sessionRateLimiter(maxRequests = 300, windowMs = 60_000) {
  return function sessionRateLimitMiddleware(
    request: Request,
    response: Response,
    next: NextFunction
  ): void {
    const sessionPda = request.headers["x-session"] as string;

    // If no session header, the session-gate middleware will handle rejection.
    if (!sessionPda) {
      next();
      return;
    }

    const result = checkLimit(sessionBuckets, sessionPda, maxRequests, windowMs);

    response.set("X-RateLimit-Limit", String(maxRequests));
    response.set("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      logger.warn(`Session rate limit exceeded: ${sessionPda}`);
      response.status(429).json({
        error: {
          message: "Session rate limit exceeded. Slow down API calls.",
          code: "SESSION_RATE_LIMITED",
          retryAfterMs: result.resetAt - Date.now(),
        },
      });
      return;
    }

    next();
  };
}
