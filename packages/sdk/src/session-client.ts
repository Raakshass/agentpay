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
 * const session = await ConduitSession.open({
 *   gatewayUrl: "http://localhost:4020",
 *   sessionPda: "<base58 PDA>",
 *   channelId: "<base58 channel_id>",
 *   agentPrivateKey: secretKey,
 *   agentPublicKey: "<base58 pubkey>",
 *   providerPublicKey: "<base58 provider>",
 *   depositAmountAtomic: 10_000_000,
 * });
 * const weather = await session.fetch("/api/depin-weather/london", 1000);
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

/** Encodes raw bytes to Base58 (Solana standard). */
export function bytesToBase58(bytes: Uint8Array): string {
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

/** Parameters for opening a new session. */
export interface OpenSessionParams {
  /** Base URL of the gateway (e.g., http://localhost:4020) */
  gatewayUrl: string;
  /** Base58 escrow PDA address from the deposit transaction */
  sessionPda: string;
  /**
   * Raw 32-byte channel_id used when calling open_channel on-chain.
   * Pass as Uint8Array (will be base58-encoded) or base58 string.
   */
  channelId: Uint8Array | string;
  /** Agent's 32-byte ed25519 private key (seed) */
  agentPrivateKey: Uint8Array;
  /** Agent's Base58 public key */
  agentPublicKey: string;
  /** Base58 provider public key (receives settled funds) */
  providerPublicKey: string;
  /** USDC deposited in atomic units */
  depositAmountAtomic: number;
}

export class ConduitSession {
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
   * via the escrow contract's `open_channel` instruction.
   */
  static async open(params: OpenSessionParams): Promise<ConduitSession> {
    const channelIdBase58 =
      typeof params.channelId === "string"
        ? params.channelId
        : bytesToBase58(params.channelId);

    const response = await fetch(`${params.gatewayUrl}/session/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionPda: params.sessionPda,
        channelId: channelIdBase58,
        agentPublicKey: params.agentPublicKey,
        providerPublicKey: params.providerPublicKey,
        depositAmountAtomic: params.depositAmountAtomic,
      }),
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
      channelId: channelIdBase58,
      agentPublicKey: params.agentPublicKey,
      providerPublicKey: params.providerPublicKey,
      depositAmountAtomic: sessionResponse.depositAmountAtomic,
      currentUsageAtomic: 0,
      requestCount: 0,
      isActive: true,
    };

    return new ConduitSession(params.gatewayUrl, params.agentPrivateKey, state);
  }

  /**
   * Make an authenticated API call through the gateway.
   *
   * Automatically signs a new IOU (over channelId, not PDA) with the
   * updated cumulative amount and attaches it via headers.
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

    // Build the next IOU — channelId goes into IOU.session for signing
    const iou = buildNextIou(
      this.state.channelId,
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
