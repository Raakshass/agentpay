/**
 * Service Pricing Config Tests
 */

import { describe, it, expect } from "vitest";
import { servicePricingConfig, getServicePricing } from "../src/config/service-pricing.js";

describe("servicePricingConfig", () => {
  it("has 8 services configured", () => {
    expect(servicePricingConfig.length).toBe(8);
  });

  it("every service has a unique serviceId", () => {
    const ids = servicePricingConfig.map((s) => s.serviceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every service has a positive price", () => {
    for (const service of servicePricingConfig) {
      expect(service.pricePerRequestAtomic).toBeGreaterThan(0);
    }
  });

  it("every service has a displayName and description", () => {
    for (const service of servicePricingConfig) {
      expect(service.displayName.length).toBeGreaterThan(0);
      expect(service.description.length).toBeGreaterThan(0);
    }
  });

  it("includes all expected service IDs", () => {
    const ids = servicePricingConfig.map((s) => s.serviceId);
    expect(ids).toContain("depin-weather");
    expect(ids).toContain("helius-token-balances");
    expect(ids).toContain("birdeye-token-price");
    expect(ids).toContain("jupiter-quote");
    expect(ids).toContain("solana-stats");
    expect(ids).toContain("nft-metadata");
    expect(ids).toContain("token-holders");
    expect(ids).toContain("tx-history");
  });

  it("has valid categories", () => {
    const validCategories = ["depin", "blockchain-data", "market-data", "network", "nft"];
    for (const service of servicePricingConfig) {
      expect(validCategories).toContain(service.category);
    }
  });
});

describe("getServicePricing", () => {
  it("returns correct pricing for known service", () => {
    const pricing = getServicePricing("jupiter-quote");
    expect(pricing.displayName).toBe("Jupiter DEX Swap Quote");
    expect(pricing.pricePerRequestAtomic).toBe(1000);
  });

  it("throws for unknown service", () => {
    expect(() => getServicePricing("nonexistent")).toThrow(
      "Service 'nonexistent' not found"
    );
  });
});
