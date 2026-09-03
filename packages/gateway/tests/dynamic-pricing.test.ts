/**
 * Dynamic Pricing Tests
 *
 * Tests the static fallback path (on-chain registry is unavailable in tests).
 * Uses direct imports of the pricing config instead of the dynamic pricing
 * service (which requires env vars for RPC connection).
 */

import { describe, it, expect } from "vitest";
import { servicePricingConfig } from "../src/config/service-pricing.js";

describe("Dynamic Pricing — Static Fallback", () => {
  it("static config covers all 8 expected services", () => {
    const expectedIds = [
      "depin-weather", "helius-token-balances", "birdeye-token-price",
      "jupiter-quote", "solana-stats", "nft-metadata", "token-holders", "tx-history",
    ];

    const ids = servicePricingConfig.map((s) => s.serviceId);
    for (const id of expectedIds) {
      expect(ids).toContain(id);
    }
  });

  it("every service has a positive price that would be the fallback", () => {
    for (const service of servicePricingConfig) {
      expect(service.pricePerRequestAtomic).toBeGreaterThan(0);
    }
  });

  it("network and nft categories are present", () => {
    const categories = new Set(servicePricingConfig.map((s) => s.category));
    expect(categories.has("network")).toBe(true);
    expect(categories.has("nft")).toBe(true);
  });

  it("market-data category has both birdeye and jupiter", () => {
    const marketServices = servicePricingConfig
      .filter((s) => s.category === "market-data")
      .map((s) => s.serviceId);
    expect(marketServices).toContain("birdeye-token-price");
    expect(marketServices).toContain("jupiter-quote");
  });

  it("blockchain-data category has 3 services", () => {
    const blockchainServices = servicePricingConfig.filter(
      (s) => s.category === "blockchain-data"
    );
    expect(blockchainServices.length).toBe(3);
  });

  it("solana-stats is the cheapest service", () => {
    const solanaStats = servicePricingConfig.find((s) => s.serviceId === "solana-stats");
    expect(solanaStats).toBeDefined();
    expect(solanaStats!.pricePerRequestAtomic).toBe(500);
    for (const service of servicePricingConfig) {
      expect(service.pricePerRequestAtomic).toBeGreaterThanOrEqual(500);
    }
  });
});
