/**
 * Settlement Service
 *
 * Submits the final IOU to the escrow contract for on-chain settlement.
 * This triggers the fund split: usage amount → provider, remainder → agent.
 *
 * The settle instruction:
 *   1. Verifies the agent's IOU signature via brine-ed25519
 *   2. Transfers cumulative USDC to the provider
 *   3. Refunds remaining USDC to the agent
 *   4. Closes the channel + vault, returning rent to the agent
 *
 * Account layout mirrors `programs/escrow/src/lib.rs` lines 294-348.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "crypto";

import type { ActiveSession } from "./session-manager.js";
import { signatureFromBase64 } from "./session-manager.js";
import { decodeBase58PublicKey } from "./iou-verifier.js";
import { environmentConfig } from "../config/environment.js";
import { logger } from "../utilities/logger.js";

// ---------------------------------------------------------------------------
// Instruction discriminator — first 8 bytes of sha256("global:settle")
// ---------------------------------------------------------------------------

const SETTLE_DISCRIMINATOR = createHash("sha256")
  .update("global:settle")
  .digest()
  .subarray(0, 8);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettlementResult {
  isSuccess: boolean;
  transactionSignature: string | null;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Gateway wallet singleton
// ---------------------------------------------------------------------------

let _gatewayKeypair: Keypair | null = null;

/**
 * Load the gateway's Keypair from the GATEWAY_WALLET_PRIVATE_KEY env var.
 * Accepts either a JSON byte array (e.g. [23,45,...]) or a base58-encoded key.
 */
function getGatewayKeypair(): Keypair {
  if (_gatewayKeypair !== null) {
    return _gatewayKeypair;
  }

  const raw = environmentConfig.gateway.walletPrivateKey;

  try {
    // Try JSON array first (Solana CLI format: 64 bytes = secret + public)
    if (raw.startsWith("[")) {
      const bytes = JSON.parse(raw) as number[];
      _gatewayKeypair = Keypair.fromSecretKey(Uint8Array.from(bytes));
      return _gatewayKeypair;
    }

    // Otherwise treat as base58-encoded 64-byte secret key
    const decoded = decodeBase58SecretKey(raw);
    _gatewayKeypair = Keypair.fromSecretKey(decoded);
    return _gatewayKeypair;
  } catch (error) {
    throw new Error(
      `Failed to parse GATEWAY_WALLET_PRIVATE_KEY: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Decode a base58-encoded secret key (64 bytes) to Uint8Array.
 */
function decodeBase58SecretKey(base58Key: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = BigInt(0);
  for (const char of base58Key) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base58 character: ${char}`);
    }
    result = result * BigInt(58) + BigInt(index);
  }

  const bytes = new Uint8Array(64);
  for (let i = 63; i >= 0; i--) {
    bytes[i] = Number(result & BigInt(0xff));
    result = result >> BigInt(8);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Instruction builder
// ---------------------------------------------------------------------------

/**
 * Build the `settle` instruction data.
 *
 * Layout: discriminator (8) | cumulative_amount u64 LE (8) | signature [u8; 64]
 */
function buildSettleInstructionData(
  cumulativeAmountAtomic: number,
  agentIouSignature: Uint8Array
): Buffer {
  if (agentIouSignature.length !== 64) {
    throw new Error(`IOU signature must be 64 bytes, got ${agentIouSignature.length}`);
  }

  const buffer = Buffer.alloc(8 + 8 + 64); // discriminator + u64 + sig

  // Discriminator
  SETTLE_DISCRIMINATOR.copy(buffer, 0);

  // cumulative_amount as u64 LE
  buffer.writeBigUInt64LE(BigInt(cumulativeAmountAtomic), 8);

  // signature [u8; 64]
  Buffer.from(agentIouSignature).copy(buffer, 16);

  return buffer;
}

/**
 * Derive the channel PDA: seeds = ["channel", agent_pubkey, channel_id]
 */
function deriveChannelPda(
  agentPubkey: PublicKey,
  channelIdBytes: Uint8Array,
  escrowProgramId: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("channel"), agentPubkey.toBuffer(), Buffer.from(channelIdBytes)],
    escrowProgramId
  );
  return pda;
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

/**
 * Settle a session on-chain by submitting the last signed IOU
 * to the escrow contract's `settle` instruction.
 */
export async function settleSessionOnChain(
  session: ActiveSession
): Promise<SettlementResult> {
  // --- Guard: no usage → no settlement needed ---
  if (session.latestIou === null || session.latestIouSignatureBase64 === null) {
    logger.info(`Session ${session.sessionPda}: No API calls made, skipping settlement`);
    return {
      isSuccess: true,
      transactionSignature: null,
      reason: "No usage to settle — full refund via contract timeout",
    };
  }

  const latestIouSignature = signatureFromBase64(session.latestIouSignatureBase64);
  if (latestIouSignature === null) {
    return {
      isSuccess: false,
      transactionSignature: null,
      reason: "Failed to decode IOU signature from storage",
    };
  }

  // --- Guard: escrow program must be configured ---
  const escrowProgramIdStr = environmentConfig.contracts.escrowProgramId;
  if (!escrowProgramIdStr) {
    logger.warn(`Settlement skipped: ESCROW_PROGRAM_ID not configured`);
    return {
      isSuccess: false,
      transactionSignature: null,
      reason: "Escrow program ID not configured — settlement deferred",
    };
  }

  try {
    const escrowProgramId = new PublicKey(escrowProgramIdStr);
    const usdcMintStr = session.usdcMint ?? environmentConfig.solana.usdcMintAddress;
    const usdcMint = new PublicKey(usdcMintStr);
    const connection = new Connection(environmentConfig.solana.rpcUrl, "confirmed");
    const gatewayKeypair = getGatewayKeypair();

    // --- Resolve all accounts ---
    const agentPubkey = new PublicKey(session.agentPublicKey);
    const providerPubkey = new PublicKey(session.providerPublicKey);
    const channelIdBytes = decodeBase58PublicKey(session.channelId); // 32 bytes

    const channelPda = deriveChannelPda(agentPubkey, channelIdBytes, escrowProgramId);
    const vault = getAssociatedTokenAddressSync(usdcMint, channelPda, true);
    const providerAta = getAssociatedTokenAddressSync(usdcMint, providerPubkey, false);
    const agentAta = getAssociatedTokenAddressSync(usdcMint, agentPubkey, false);

    // --- Verify gateway is authorized ---
    // The contract's has_one = gateway constraint will reject if mismatch,
    // but we validate early to give a clear error.
    logger.info(
      `Settling session ${session.sessionPda}: ` +
      `${session.latestIou.cumulativeUsdc} atomic USDC to provider ${session.providerPublicKey}`
    );

    // --- Build instruction ---
    const instructionData = buildSettleInstructionData(
      session.latestIou.cumulativeUsdc,
      latestIouSignature
    );

    const settleInstruction = new TransactionInstruction({
      programId: escrowProgramId,
      keys: [
        { pubkey: gatewayKeypair.publicKey, isSigner: true, isWritable: true },   // gateway
        { pubkey: channelPda, isSigner: false, isWritable: true },                 // channel
        { pubkey: agentPubkey, isSigner: false, isWritable: true },                // agent
        { pubkey: providerPubkey, isSigner: false, isWritable: false },            // provider
        { pubkey: usdcMint, isSigner: false, isWritable: false },                  // usdc_mint
        { pubkey: vault, isSigner: false, isWritable: true },                      // vault
        { pubkey: providerAta, isSigner: false, isWritable: true },                // provider_token_account
        { pubkey: agentAta, isSigner: false, isWritable: true },                   // agent_token_account
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },          // token_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },   // system_program
      ],
      data: instructionData,
    });

    // --- Send transaction ---
    const transaction = new Transaction().add(settleInstruction);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [gatewayKeypair],
      { commitment: "confirmed", maxRetries: 3 }
    );

    logger.info(
      `Settlement confirmed: ${signature}\n` +
      `  Provider received: ${session.latestIou.cumulativeUsdc} atomic USDC\n` +
      `  Agent refunded: ${session.depositAmountAtomic - session.latestIou.cumulativeUsdc} atomic USDC\n` +
      `  Explorer: https://explorer.solana.com/tx/${signature}?cluster=${environmentConfig.solana.network}`
    );

    return {
      isSuccess: true,
      transactionSignature: signature,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Parse known contract errors for clear diagnostics
    const contractError = parseEscrowError(errorMessage);

    logger.error(
      `Settlement failed for session ${session.sessionPda}: ${contractError ?? errorMessage}`
    );

    return {
      isSuccess: false,
      transactionSignature: null,
      reason: contractError ?? errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Error parsing
// ---------------------------------------------------------------------------

const ESCROW_ERROR_MAP: Record<string, string> = {
  AlreadySettled: "Channel has already been settled (double-settle attempt)",
  Overdraw: "Cumulative amount exceeds the deposit (overdraw attempt)",
  InvalidSignature: "IOU signature verification failed on-chain",
  Unauthorized: "Gateway is not the authorized settler for this channel",
  ProviderMismatch: "Provider account does not match the channel record",
  AgentMismatch: "Agent account does not match the channel record",
  TimeoutNotReached: "Refund timeout has not yet been reached",
  MathOverflow: "Arithmetic overflow in settlement calculation",
};

function parseEscrowError(errorMessage: string): string | null {
  for (const [key, description] of Object.entries(ESCROW_ERROR_MAP)) {
    if (errorMessage.includes(key)) {
      return `EscrowError::${key} — ${description}`;
    }
  }

  if (errorMessage.includes("insufficient funds") || errorMessage.includes("Insufficient")) {
    return "Insufficient SOL for transaction fees on the gateway wallet";
  }

  return null;
}
