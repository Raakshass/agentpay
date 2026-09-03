/**
 * SDK Error Classes Tests
 */

import { describe, it, expect } from "vitest";
import {
  ConduitError,
  SessionError,
  InsufficientBalanceError,
  SignatureError,
  GatewayError,
  RateLimitError,
  SettlementError,
  DepositError,
  parseGatewayError,
} from "../src/errors.js";

describe("Error Classes", () => {
  it("ConduitError has correct properties", () => {
    const err = new ConduitError("test message", "TEST_CODE", 500);
    expect(err.message).toBe("test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe("ConduitError");
    expect(err instanceof Error).toBe(true);
  });

  it("SessionError extends ConduitError", () => {
    const err = new SessionError("session gone");
    expect(err instanceof ConduitError).toBe(true);
    expect(err.name).toBe("SessionError");
    expect(err.code).toBe("SESSION_ERROR");
  });

  it("InsufficientBalanceError includes balance info", () => {
    const err = new InsufficientBalanceError(500, 1000);
    expect(err.remainingAtomic).toBe(500);
    expect(err.priceAtomic).toBe(1000);
    expect(err.statusCode).toBe(402);
    expect(err.message).toContain("500");
    expect(err.message).toContain("1000");
  });

  it("RateLimitError includes retry delay", () => {
    const err = new RateLimitError(30_000);
    expect(err.retryAfterMs).toBe(30_000);
    expect(err.statusCode).toBe(429);
  });

  it("GatewayError includes upstream URL", () => {
    const err = new GatewayError("upstream down", "https://api.example.com");
    expect(err.upstreamUrl).toBe("https://api.example.com");
    expect(err.statusCode).toBe(502);
  });
});

describe("parseGatewayError", () => {
  it("parses INSUFFICIENT_BALANCE into InsufficientBalanceError", () => {
    const err = parseGatewayError(402, {
      error: { message: "no balance", code: "INSUFFICIENT_BALANCE" },
    });
    expect(err).toBeInstanceOf(InsufficientBalanceError);
  });

  it("parses RATE_LIMITED into RateLimitError", () => {
    const err = parseGatewayError(429, {
      error: { message: "slow down", code: "RATE_LIMITED", retryAfterMs: 5000 },
    });
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterMs).toBe(5000);
  });

  it("parses INVALID_SIGNATURE into SignatureError", () => {
    const err = parseGatewayError(401, {
      error: { message: "bad sig", code: "INVALID_SIGNATURE" },
    });
    expect(err).toBeInstanceOf(SignatureError);
  });

  it("parses DEPOSIT_UNVERIFIED into DepositError", () => {
    const err = parseGatewayError(403, {
      error: { message: "not verified", code: "DEPOSIT_UNVERIFIED" },
    });
    expect(err).toBeInstanceOf(DepositError);
  });

  it("returns generic ConduitError for unknown codes", () => {
    const err = parseGatewayError(500, {
      error: { message: "kaboom", code: "UNKNOWN_ERROR" },
    });
    expect(err).toBeInstanceOf(ConduitError);
    expect(err.code).toBe("UNKNOWN_ERROR");
  });
});
