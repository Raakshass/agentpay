/**
 * Upstream Proxy Service
 *
 * Forwards requests to upstream API providers and returns responses.
 * Handles timeouts, error classification, and response normalization.
 */

import { logger } from "../utilities/logger.js";

export interface UpstreamRequestOptions {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMilliseconds?: number;
}

export interface UpstreamResponse {
  statusCode: number;
  data: unknown;
  isSuccess: boolean;
}

const DEFAULT_TIMEOUT_MILLISECONDS = 10_000;

export async function forwardToUpstream(
  options: UpstreamRequestOptions
): Promise<UpstreamResponse> {
  const timeout = options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeout);

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: abortController.signal,
    });

    const data = (await response.json()) as unknown;

    return { statusCode: response.status, data, isSuccess: response.ok };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      logger.warn(`Upstream timed out after ${timeout}ms: ${options.url}`);
      return { statusCode: 504, data: { error: "Upstream request timed out" }, isSuccess: false };
    }

    logger.error(`Upstream failed: ${options.url}`, error);
    return { statusCode: 502, data: { error: "Upstream service unavailable" }, isSuccess: false };
  } finally {
    clearTimeout(timeoutId);
  }
}
