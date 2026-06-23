/**
 * Demo Weather Agent
 *
 * Demonstrates the full Conduit state channel flow:
 * 1. Discover available services via catalog
 * 2. Open a session (after on-chain deposit)
 * 3. Make multiple API calls with automatic IOU signing
 * 4. Close the session (triggers settlement)
 *
 * For MVP testing, the on-chain deposit is simulated.
 * Replace with real escrow deposit when Vineet's contract is ready.
 */

import { ConduitSession, fetchCatalog } from "conduit-pay";

const GATEWAY_URL = "http://localhost:4020";

// Simulated agent wallet (replace with real keypair for devnet)
const MOCK_AGENT_PRIVATE_KEY = new Uint8Array(32).fill(1); // DO NOT use in production
const MOCK_AGENT_PUBLIC_KEY = "SimulatedAgentPublicKey11111111111111111111";
const MOCK_PROVIDER_PUBLIC_KEY = "SimulatedProviderPubKey11111111111111111111";
const MOCK_SESSION_PDA = "SimulatedSessionPda111111111111111111111111";
const MOCK_CHANNEL_ID = "SimulatedChannelId1111111111111111111111111";
const MOCK_DEPOSIT_ATOMIC = 10_000_000; // 10 USDC

async function runWeatherAgent(): Promise<void> {
  console.log("=== Conduit Demo Weather Agent ===\n");

  // Step 1: Discover available services
  console.log("Fetching service catalog...");
  const catalog = await fetchCatalog(GATEWAY_URL);
  console.log(`Found ${catalog.totalServices} services:`);
  for (const service of catalog.services) {
    console.log(`  - ${service.displayName} (${service.pricing.perRequestAtomic} atomic USDC/request)`);
  }

  // Step 2: Open a session
  console.log("\nOpening session...");
  const session = await ConduitSession.open({
    gatewayUrl: GATEWAY_URL,
    sessionPda: MOCK_SESSION_PDA,
    channelId: MOCK_CHANNEL_ID,
    agentPrivateKey: MOCK_AGENT_PRIVATE_KEY,
    agentPublicKey: MOCK_AGENT_PUBLIC_KEY,
    providerPublicKey: MOCK_PROVIDER_PUBLIC_KEY,
    depositAmountAtomic: MOCK_DEPOSIT_ATOMIC,
  });
  console.log(`Session opened. Balance: ${session.getRemainingBalance()} atomic USDC`);

  // Step 3: Make multiple API calls
  const cities = ["London", "Tokyo", "Mumbai", "Berlin", "Sydney"];
  const weatherPriceAtomic = 1000; // 0.001 USDC per request

  for (const city of cities) {
    console.log(`\nFetching weather for ${city}...`);
    try {
      const data = await session.fetch(`/api/depin-weather/${city}`, weatherPriceAtomic);
      console.log(`  Data received. Remaining balance: ${session.getRemainingBalance()} atomic USDC`);
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Step 4: Close the session
  console.log("\nClosing session...");
  const result = await session.close();
  console.log("Session closed.");
  console.log(`  Total requests: ${result.usage.totalRequestsMade}`);
  console.log(`  Total USDC used: ${result.usage.totalUsdcUsedAtomic} atomic`);
  console.log(`  Refund amount: ${result.usage.refundAmountAtomic} atomic`);
  console.log(`  Settlement: ${result.settlement.isSuccess ? "SUCCESS" : result.settlement.reason}`);
}

runWeatherAgent().catch(console.error);
