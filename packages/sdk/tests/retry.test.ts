/**
 * Retry Utility Tests
 */

import { describe, it, expect, vi } from "vitest";
import { withRetry, isRetryableError } from "../src/retry.js";

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 10,
      jitter: false,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws last error after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      withRetry(fn, { maxRetries: 2, initialDelayMs: 10, jitter: false })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("respects shouldRetry predicate", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        shouldRetry: () => false,
      })
    ).rejects.toThrow("non-retryable");
    expect(fn).toHaveBeenCalledTimes(1); // no retries
  });

  it("calls onRetry callback", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 10,
      jitter: false,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 10);
  });

  it("exponential backoff increases delay", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValue("ok");

    await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      jitter: false,
      onRetry,
    });

    // First retry: 100ms, second retry: 200ms
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0][2]).toBe(100);
    expect(onRetry.mock.calls[1][2]).toBe(200);
  });
});

describe("isRetryableError", () => {
  it("returns true for 429 status", () => {
    const err = Object.assign(new Error("rate limit"), { statusCode: 429 });
    expect(isRetryableError(err)).toBe(true);
  });

  it("returns true for 500+ status", () => {
    const err = Object.assign(new Error("server error"), { statusCode: 503 });
    expect(isRetryableError(err)).toBe(true);
  });

  it("returns false for 400 status", () => {
    const err = Object.assign(new Error("bad request"), { statusCode: 400 });
    expect(isRetryableError(err)).toBe(false);
  });

  it("returns true for timeout errors", () => {
    expect(isRetryableError(new Error("Request timeout"))).toBe(true);
  });

  it("returns true for connection errors", () => {
    expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("socket hang up"))).toBe(true);
  });

  it("returns false for generic errors", () => {
    expect(isRetryableError(new Error("something else"))).toBe(false);
  });
});
