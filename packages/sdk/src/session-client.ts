/**
 * Session Client
 *
 * The main SDK entry point for AI agents. Manages the full lifecycle:
 * 1. Open a session (after on-chain deposit)
 * 2. Make authenticated API calls with auto-signed IOUs
 * 3. Close the session (triggers on-chain settlement)
 *
 * Usage:
 * ```typescript
 * const session = await AgentPaySession.open(gatewayUrl, sessionPda, wallet, depositAtomic);
 * const weather = await session.fetch("/api/depin-weather/london", 1000);
 * const price = await session.fetch("/api/birdeye-token-price/SOL_ADDRESS", 1000);
 * const result = await session.close();
 * ```
 */

import { signIou, buildNextIou } from "./iou-signer.js";
import type {
  SessionState,
  OpenSessionResponse,
  CloseSessionResponse,
} from "./types/session.js";

/** Encodes bytes to Base64 for HTTP header transport */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Encodes bytes to Base58 (Solana standard) */
function bytesToBase58(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  let value = BigInt(0);
  for (const byte of bytes) {
    value = value * BigInt(256) + BigInt(byte);
  }

  let result = "";
  while (value > BigInt(0)) {
    const remainder = Number(value % BigInt(58));
    value = value / BigInt(58);
    result = ALPHABET[remainder] + result;
  }

  // Handle leading zeros
  for (const byte of bytes) {
    if (byte === 0) {
      result = "1" + result;
    } else {
      break;
    }
  }

  return result;
}

export class AgentPaySession {
  private readonly gatewayUrl: string;
  private readonly agentPrivateKey: Uint8Array;
  private state: SessionState;

  private constructor(
    gatewayUrl: string,
    agentPrivateKey: Uint8Array,
    state: SessionState
  ) {
    this.gatewayUrl = gatewayUrl;
    this.agentPrivateKey = agentPrivateKey;
    this.state = state;
  }

  /**
   * Open a session with the gateway.
   *
   * Prerequisites: The agent must have already deposited USDC on-chain
   * via the escrow contract's open_session instruction.
   *
   * @param gatewayUrl - Base URL of the gateway (e.g., http://localhost:4020)
   * @param sessionPda - Base58 escrow PDA address from the deposit transaction
   * @param agentPrivateKey - Agent's 32-byte ed25519 private key
   * @param agentPublicKey - Agent's Base58 public key
   * @param depositAmountAtomic - USDC deposited in atomic units
   */
  static async open(
    gatewayUrl: string,
    sessionPda: string,
    agentPrivateKey: Uint8Array,
    agentPublicKey: string,
    depositAmountAtomic: number
  ): Promise<AgentPaySession> {
    const response = await fetch(`${gatewayUrl}/session/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionPda, agentPublicKey, depositAmountAtomic }),
    });

    if (!response.ok) {
      const errorBody = (await response.json()) as { error?: { message?: string } };
      throw new Error(
        `Failed to open session: ${errorBody.error?.message ?? response.statusText}`
      );
    }

    const sessionResponse = (await response.json()) as OpenSessionResponse;

    const state: SessionState = {
      sessionPda: sessionResponse.sessionPda,
      agentPublicKey,
      depositAmountAtomic: sessionResponse.depositAmountAtomic,
      currentUsageAtomic: 0,
      requestCount: 0,
      isActive: true,
    };

    return new AgentPaySession(gatewayUrl, agentPrivateKey, state);
  }

  /**
   * Make an authenticated API call through the gateway.
   *
   * Automatically signs a new IOU with the updated cumulative amount
   * and attaches it to the request via headers.
   *
   * @param endpoint - API path (e.g., "/api/depin-weather/london")
   * @param servicePriceAtomic - Price per request in atomic USDC (from catalog)
   * @returns The JSON response from the upstream API
   */
  async fetch(endpoint: string, servicePriceAtomic: number): Promise<unknown> {
    if (!this.state.isActive) {
      throw new Error("Session is closed. Open a new session to make requests.");
    }

    const remainingBalance =
      this.state.depositAmountAtomic - this.state.currentUsageAtomic;

    if (servicePriceAtomic > remainingBalance) {
      throw new Error(
        `Insufficient session balance. Remaining: ${remainingBalance}, Required: ${servicePriceAtomic}`
      );
    }

    // Build the next IOU with incremented cumulative usage
    const iou = buildNextIou(
      this.state.sessionPda,
      this.state.currentUsageAtomic,
      this.state.requestCount,
      servicePriceAtomic
    );

    // Sign the IOU with the agent's private key
    const signature = await signIou(iou, this.agentPrivateKey);

    // Serialize the IOU to JSON for the header
    const iouJson = JSON.stringify({
      session: iou.session,
      cumulative_usdc: iou.cumulativeUsdc,
      request_count: iou.requestCount,
      timestamp: iou.timestamp,
    });

    // Make the request with state channel headers
    const response = await fetch(`${this.gatewayUrl}${endpoint}`, {
      headers: {
        "X-SESSION": this.state.sessionPda,
        "X-IOU": iouJson,
        "X-SIGNATURE": bytesToBase64(signature),
      },
    });

    if (!response.ok) {
      const errorBody = (await response.json()) as { error?: { message?: string } };
      throw new Error(
        `API request failed: ${errorBody.error?.message ?? response.statusText}`
      );
    }

    // Update local session state
    this.state.currentUsageAtomic = iou.cumulativeUsdc;
    this.state.requestCount = iou.requestCount;

    return response.json();
  }

  /**
   * Close the session and trigger on-chain settlement.
   * After closing, no more API calls can be made with this session.
   */
  async close(): Promise<CloseSessionResponse> {
    if (!this.state.isActive) {
      throw new Error("Session is already closed");
    }

    const response = await fetch(`${this.gatewayUrl}/session/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionPda: this.state.sessionPda }),
    });

    if (!response.ok) {
      const errorBody = (await response.json()) as { error?: { message?: string } };
      throw new Error(
        `Failed to close session: ${errorBody.error?.message ?? response.statusText}`
      );
    }

    this.state.isActive = false;
    return (await response.json()) as CloseSessionResponse;
  }

  /** Get the current session state */
  getState(): Readonly<SessionState> {
    return { ...this.state };
  }

  /** Get remaining balance in atomic USDC */
  getRemainingBalance(): number {
    return this.state.depositAmountAtomic - this.state.currentUsageAtomic;
  }
}
