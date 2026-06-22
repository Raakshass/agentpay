/**
 * Health Check Routes
 *
 * Basic health and readiness endpoints for monitoring.
 * No session required.
 */

import type { Express } from "express";
import { Keypair } from "@solana/web3.js";
import { getActiveSessionCount } from "../services/session-manager.js";
import { environmentConfig } from "../config/environment.js";

/**
 * Derive the gateway public key from the configured wallet.
 * Cached after first call.
 */
let _gatewayPubkey: string | null = null;
function getGatewayPublicKey(): string {
  if (_gatewayPubkey !== null) return _gatewayPubkey;
  try {
    const raw = environmentConfig.gateway.walletPrivateKey;
    if (raw.startsWith("[")) {
      const bytes = JSON.parse(raw) as number[];
      _gatewayPubkey = Keypair.fromSecretKey(Uint8Array.from(bytes)).publicKey.toBase58();
    } else {
      _gatewayPubkey = "unknown";
    }
  } catch {
    _gatewayPubkey = "unknown";
  }
  return _gatewayPubkey;
}

export function registerHealthRoutes(application: Express): void {
  application.get("/health", (_request, response) => {
    response.json({
      status: "healthy",
      service: "conduit-gateway",
      gatewayPublicKey: getGatewayPublicKey(),
      activeSessions: getActiveSessionCount(),
      timestamp: new Date().toISOString(),
    });
  });
}
