/**
 * Environment Configuration
 *
 * Validates all environment variables at startup using Zod.
 * Fails immediately with clear errors if anything is missing.
 */

import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const environmentSchema = z.object({
  solana: z.object({
    network: z.enum(["devnet", "mainnet-beta"]).default("devnet"),
    rpcUrl: z.string().url(),
    usdcMintAddress: z.string().min(32),
  }),

  gateway: z.object({
    port: z.coerce.number().int().positive().default(4020),
    host: z.string().default("0.0.0.0"),
    walletPrivateKey: z.string().min(1),
    revenueWalletAddress: z.string().min(32),
  }),

  session: z.object({
    timeoutSeconds: z.coerce.number().int().positive().default(3600),
    maxDepositUsdc: z.coerce.number().positive().default(100),
  }),

  upstreamApis: z.object({
    openWeatherMapApiKey: z.string().default(""),
    heliusApiKey: z.string().default(""),
  }),

  contracts: z.object({
    escrowProgramId: z.string().optional(),
    registryProgramId: z.string().optional(),
  }),
});

type EnvironmentConfig = z.infer<typeof environmentSchema>;

function loadEnvironmentConfig(): EnvironmentConfig {
  const parseResult = environmentSchema.safeParse({
    solana: {
      network: process.env["SOLANA_NETWORK"],
      rpcUrl: process.env["HELIUS_RPC_URL"],
      usdcMintAddress: process.env["USDC_MINT_ADDRESS"],
    },
    gateway: {
      // Prefer GATEWAY_PORT; fall back to PORT (injected by Railway/most PaaS).
      port: process.env["GATEWAY_PORT"] ?? process.env["PORT"],
      host: process.env["GATEWAY_HOST"],
      walletPrivateKey: process.env["GATEWAY_WALLET_PRIVATE_KEY"],
      revenueWalletAddress: process.env["GATEWAY_REVENUE_WALLET_ADDRESS"],
    },
    session: {
      timeoutSeconds: process.env["SESSION_TIMEOUT_SECONDS"],
      maxDepositUsdc: process.env["SESSION_MAX_DEPOSIT_USDC"],
    },
    upstreamApis: {
      openWeatherMapApiKey: process.env["OPENWEATHERMAP_API_KEY"],
      heliusApiKey: process.env["HELIUS_API_KEY"],
    },
    contracts: {
      escrowProgramId: process.env["ESCROW_PROGRAM_ID"],
      registryProgramId: process.env["REGISTRY_PROGRAM_ID"],
    },
  });

  if (!parseResult.success) {
    const formattedErrors = parseResult.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${formattedErrors}\n\nSee .env.example for required variables.`
    );
  }

  return parseResult.data;
}

export const environmentConfig = loadEnvironmentConfig();
export type { EnvironmentConfig };
