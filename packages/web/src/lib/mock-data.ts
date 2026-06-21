/**
 * Mock registry data.
 *
 * The registry program may not be deployed (or may be empty) on the cluster the
 * app points at. To keep the UI legible with no broken states, the catalog and
 * provider hooks fall back to this data and clearly label it as a demo. Prices
 * are in atomic USDC (1e6 = 1 USDC). Categories/agent types match the on-chain
 * enums in `programs/registry/src/lib.rs`.
 */

import type { ProviderAccount } from "./registry-client";

/** Deterministic placeholder addresses (valid-looking base58, demo only). */
export const MOCK_PROVIDERS: ProviderAccount[] = [
  {
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    owner: "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcz1",
    name: "OpenWeather Realtime",
    endpointHash: "9f2c1ab5d3e8470a2b6c8d1e4f0a7b3c5d9e2f1a8c4b6d0e3f7a1c9b2d4e6f8a0",
    priceUsdc: 1_000,
    category: 0, // Weather
    agentType: 0, // API
    providerWallet: "4Nd1mYHscgwQ7m9rU7zFjB1mQy4w6q2X5pVnW8sLkTfa",
    gatewayAuthority: "GatewayAUth1111111111111111111111111111111",
    totalCalls: 184_204,
    active: true,
    bump: 254,
  },
  {
    address: "3mEwq9rT8kVnZ2pX6sLfH4dCbA7yU1oN5jW8tQ2rKpLd",
    owner: "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcz1",
    name: "GeoRoute Maps",
    endpointHash: "1a2b3c4d5e6f70819a0b1c2d3e4f50617283940a5b6c7d8e9f0a1b2c3d4e5f60",
    priceUsdc: 2_500,
    category: 1, // Mapping
    agentType: 0, // API
    providerWallet: "5qK8vN2mWpX3rT9sLfH4dCbA7yU1oN5jW8tQ2rKpLdZa",
    gatewayAuthority: "GatewayAUth1111111111111111111111111111111",
    totalCalls: 92_840,
    active: true,
    bump: 253,
  },
  {
    address: "8pLwR3tY6kHnZ4qX7sMfG5dDcB8zV2oP6jX9uR3sLqMe",
    owner: "Bk7mQ2rT8kVnZ2pX6sLfH4dCbA7yU1oN5jW8tQ2rKpLd",
    name: "Helius DePIN Feed",
    endpointHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    priceUsdc: 500,
    category: 2, // Network
    agentType: 2, // DePIN
    providerWallet: "6rL9wO3nXqY4sU0tMgI5eEdC9aW3pQ7kY0vS4tMrNpOf",
    gatewayAuthority: "GatewayAUth1111111111111111111111111111111",
    totalCalls: 421_009,
    active: true,
    bump: 255,
  },
  {
    address: "2nDvQ8sX5jGmY3pW6rKeF4cBaZ7yT1oM5iV8tP2qJoKc",
    owner: "Bk7mQ2rT8kVnZ2pX6sLfH4dCbA7yU1oN5jW8tQ2rKpLd",
    name: "GPU Inference Pool",
    endpointHash: "0011223344556677889900aabbccddeeff00112233445566778899aabbccddee",
    priceUsdc: 50_000,
    category: 3, // Compute
    agentType: 0, // API
    providerWallet: "7sM0xP4oYrZ5tV1uNhJ6fFeD0bX4qR8lZ1wT5uNsOqPg",
    gatewayAuthority: "GatewayAUth1111111111111111111111111111111",
    totalCalls: 12_503,
    active: true,
    bump: 252,
  },
  {
    address: "5kFsT2vZ8mJpW6rX9sNgH7eDdC0aY4qS8lA2wU6tMpRf",
    owner: "Cm8nR3sU9lWoA3qY7tMgI5eEdC9aW3pQ7kY0vS4tMrNp",
    name: "Summarizer Agent",
    endpointHash: "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100",
    priceUsdc: 3_200,
    category: 4, // Agent
    agentType: 1, // Agent
    providerWallet: "8tN1yQ5pZsA6uW2vOiK7gGfE1cY5rS9mA2xV6uOtPrQh",
    gatewayAuthority: "GatewayAUth1111111111111111111111111111111",
    totalCalls: 34_771,
    active: true,
    bump: 251,
  },
  {
    address: "9wGtU3xA1nKqX7sY0tOhI8fEeD1bZ5rT9mB3xV7uNqSg",
    owner: "Cm8nR3sU9lWoA3qY7tMgI5eEdC9aW3pQ7kY0vS4tMrNp",
    name: "Legacy Price Oracle",
    endpointHash: "13579bdf02468ace13579bdf02468ace13579bdf02468ace13579bdf02468ace",
    priceUsdc: 800,
    category: 2, // Network
    agentType: 0, // API
    providerWallet: "9uO2zR6qAtB7vX3wPjL8hHgF2dZ6sT0nB3yW7vPuQsRi",
    gatewayAuthority: "GatewayAUth1111111111111111111111111111111",
    totalCalls: 5_120,
    active: false,
    bump: 250,
  },
];

/** Aggregate stats derived from the mock providers (used by the landing strip). */
export const MOCK_STATS = {
  totalProviders: MOCK_PROVIDERS.length,
  totalCallsSettled: MOCK_PROVIDERS.reduce((sum, p) => sum + p.totalCalls, 0),
  // Rough USDC volume = sum(price * calls) in whole USDC.
  usdcVolume: Math.round(
    MOCK_PROVIDERS.reduce(
      (sum, p) => sum + (p.priceUsdc * p.totalCalls) / 1_000_000,
      0,
    ),
  ),
};
