/**
 * Channel Client — the on-chain half of the state channel.
 *
 * `ConduitSession` (session-client.ts) handles everything OFF-chain: opening a
 * gateway session, signing IOUs, and requesting settlement. But before any of
 * that, the agent must lock USDC on-chain by calling the escrow program's
 * `open_channel`. This module provides that missing piece, plus the crash-safety
 * `claim_refund` path — so an SDK user never has to hand-build Anchor
 * instructions or derive PDAs themselves.
 *
 * Typical flow:
 * ```typescript
 * import { openChannel, ConduitSession } from "conduit-pay";
 *
 * // 1. Deposit on-chain (this module)
 * const channel = await openChannel({
 *   connection,
 *   agent,                       // web3.js Keypair
 *   provider: providerPubkey,
 *   gateway: gatewayPubkey,
 *   usdcMint,
 *   depositAmountAtomic: 10_000_000, // 10 USDC
 * });
 *
 * // 2. Open the gateway session with what openChannel returned
 * const session = await ConduitSession.open({
 *   gatewayUrl,
 *   sessionPda: channel.channelPda.toBase58(),
 *   channelId: channel.channelId,
 *   agentPrivateKey: agent.secretKey.slice(0, 32), // ed25519 seed
 *   agentPublicKey: agent.publicKey.toBase58(),
 *   providerPublicKey: providerPubkey.toBase58(),
 *   depositAmountAtomic: 10_000_000,
 * });
 * ```
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

/** Devnet + the program's `declare_id!`. Override via `programId` if needed. */
export const DEFAULT_ESCROW_PROGRAM_ID = new PublicKey(
  "8vH1iEpbwe31WGqSGd9a8qkKh7SCHW8MsaSULVsxskRw"
);

/** PDA seed prefix, matching the escrow program's `b"channel"`. */
const CHANNEL_SEED = "channel";

/**
 * Anchor instruction discriminators — the first 8 bytes of
 * `sha256("global:<ix_name>")`. Hardcoded so this module stays dependency-free
 * and isomorphic (no hashing lib, no node `crypto`).
 */
const IX_OPEN_CHANNEL = new Uint8Array([91, 45, 253, 71, 140, 166, 107, 109]);
const IX_CLAIM_REFUND = new Uint8Array([15, 16, 30, 161, 255, 228, 97, 60]);

/** Timeout bounds mirrored from the program (1s .. 7 days). */
const MIN_TIMEOUT_SECONDS = 1;
const MAX_TIMEOUT_SECONDS = 7 * 24 * 60 * 60;
/** Default refund timeout: 1 hour, matching the reference agent. */
const DEFAULT_TIMEOUT_SECONDS = 3600;

function toPublicKey(value: PublicKey | string): PublicKey {
  return typeof value === "string" ? new PublicKey(value) : value;
}

/**
 * A channel id is a raw 32-byte value that is both a PDA seed and part of the
 * signed IOU. It is base58-encoded the same way a pubkey is, so a base58 string
 * round-trips through `PublicKey`.
 */
function channelIdToBytes(channelId: Uint8Array | string): Uint8Array {
  if (typeof channelId === "string") {
    return new PublicKey(channelId).toBytes();
  }
  if (channelId.length !== 32) {
    throw new Error(`channelId must be 32 bytes, got ${channelId.length}`);
  }
  return channelId;
}

/**
 * Generate a fresh, unique 32-byte channel id. Uses a throwaway keypair's
 * public key purely as a source of 32 random, valid bytes.
 */
export function generateChannelId(): Uint8Array {
  return Keypair.generate().publicKey.toBytes();
}

/**
 * Derive the channel PDA and bump for `["channel", agent, channel_id]`.
 * This PDA is the escrow account address AND the vault's token authority.
 */
export function deriveChannelPda(
  agent: PublicKey | string,
  channelId: Uint8Array | string,
  programId: PublicKey | string = DEFAULT_ESCROW_PROGRAM_ID
): { pda: PublicKey; bump: number } {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(CHANNEL_SEED),
      toPublicKey(agent).toBuffer(),
      channelIdToBytes(channelId),
    ],
    toPublicKey(programId)
  );
  return { pda, bump };
}

/** Parameters for {@link openChannel}. */
export interface OpenChannelParams {
  /** Solana RPC connection. */
  connection: Connection;
  /** Agent keypair — signs the deposit and pays account rent. */
  agent: Keypair;
  /** Provider that will receive settled funds. */
  provider: PublicKey | string;
  /** Gateway authorized to settle (its wallet public key). */
  gateway: PublicKey | string;
  /** USDC mint for this cluster. */
  usdcMint: PublicKey | string;
  /** USDC to lock, in atomic units (1 USDC = 1_000_000). */
  depositAmountAtomic: number | bigint;
  /** Refund timeout in seconds (default 3600, bounds 1 .. 604800). */
  timeoutSeconds?: number;
  /** Reuse a specific 32-byte channel id; a fresh one is generated otherwise. */
  channelId?: Uint8Array;
  /** Escrow program id (defaults to the deployed devnet program). */
  programId?: PublicKey | string;
}

/** Result of a successful {@link openChannel}. */
export interface OpenChannelResult {
  /** Confirmed transaction signature. */
  signature: string;
  /** The raw 32-byte channel id (pass this to `ConduitSession.open`). */
  channelId: Uint8Array;
  /** Base58 form of the channel id, for logging/display. */
  channelIdBase58: string;
  /** The channel PDA (use as `sessionPda` for the gateway session). */
  channelPda: PublicKey;
  /** The vault token account owned by the channel PDA. */
  vault: PublicKey;
}

/**
 * DEPOSIT. Lock USDC into a channel vault via the escrow program's
 * `open_channel`. Returns the channel id + PDA that `ConduitSession.open` needs.
 */
export async function openChannel(
  params: OpenChannelParams
): Promise<OpenChannelResult> {
  const {
    connection,
    agent,
    depositAmountAtomic,
    timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
  } = params;

  const provider = toPublicKey(params.provider);
  const gateway = toPublicKey(params.gateway);
  const usdcMint = toPublicKey(params.usdcMint);
  const programId = toPublicKey(params.programId ?? DEFAULT_ESCROW_PROGRAM_ID);

  const deposit = BigInt(depositAmountAtomic);
  if (deposit <= BigInt(0)) {
    throw new Error("depositAmountAtomic must be greater than zero");
  }
  if (
    timeoutSeconds < MIN_TIMEOUT_SECONDS ||
    timeoutSeconds > MAX_TIMEOUT_SECONDS
  ) {
    throw new Error(
      `timeoutSeconds must be between ${MIN_TIMEOUT_SECONDS} and ${MAX_TIMEOUT_SECONDS}`
    );
  }

  const channelId = params.channelId ?? generateChannelId();
  if (channelId.length !== 32) {
    throw new Error(`channelId must be 32 bytes, got ${channelId.length}`);
  }

  const { pda: channelPda } = deriveChannelPda(
    agent.publicKey,
    channelId,
    programId
  );
  const vault = getAssociatedTokenAddressSync(usdcMint, channelPda, true);
  const agentAta = getAssociatedTokenAddressSync(usdcMint, agent.publicKey);

  // open_channel(channel_id, deposit_amount, provider, gateway, timeout_seconds)
  // disc(8) | channel_id(32) | u64 LE(8) | provider(32) | gateway(32) | i64 LE(8)
  const data = new Uint8Array(8 + 32 + 8 + 32 + 32 + 8);
  const view = new DataView(data.buffer);
  let offset = 0;
  data.set(IX_OPEN_CHANNEL, offset);
  offset += 8;
  data.set(channelId, offset);
  offset += 32;
  view.setBigUint64(offset, deposit, true);
  offset += 8;
  data.set(provider.toBytes(), offset);
  offset += 32;
  data.set(gateway.toBytes(), offset);
  offset += 32;
  view.setBigInt64(offset, BigInt(timeoutSeconds), true);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: agent.publicKey, isSigner: true, isWritable: true },
      { pubkey: channelPda, isSigner: false, isWritable: true },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: agentAta, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as unknown as Buffer,
  });

  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [agent]
  );

  return {
    signature,
    channelId,
    channelIdBase58: new PublicKey(channelId).toBase58(),
    channelPda,
    vault,
  };
}

/** Parameters for {@link claimRefund}. */
export interface ClaimRefundParams {
  /** Solana RPC connection. */
  connection: Connection;
  /** Agent keypair — must own the channel. */
  agent: Keypair;
  /** USDC mint for this cluster. */
  usdcMint: PublicKey | string;
  /** The channel id used when the channel was opened (bytes or base58). */
  channelId: Uint8Array | string;
  /** Escrow program id (defaults to the deployed devnet program). */
  programId?: PublicKey | string;
}

/**
 * CRASH SAFETY. Reclaim the full deposit if the gateway never settled and the
 * channel's timeout has elapsed. Fails on-chain with `TimeoutNotReached` if
 * called too early, or `AlreadySettled` if the gateway already settled.
 */
export async function claimRefund(
  params: ClaimRefundParams
): Promise<{ signature: string }> {
  const { connection, agent } = params;
  const usdcMint = toPublicKey(params.usdcMint);
  const programId = toPublicKey(params.programId ?? DEFAULT_ESCROW_PROGRAM_ID);
  const channelId = channelIdToBytes(params.channelId);

  const { pda: channelPda } = deriveChannelPda(
    agent.publicKey,
    channelId,
    programId
  );
  const vault = getAssociatedTokenAddressSync(usdcMint, channelPda, true);
  const agentAta = getAssociatedTokenAddressSync(usdcMint, agent.publicKey);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: agent.publicKey, isSigner: true, isWritable: true },
      { pubkey: channelPda, isSigner: false, isWritable: true },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: agentAta, isSigner: false, isWritable: true },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: IX_CLAIM_REFUND as unknown as Buffer,
  });

  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [agent]
  );

  return { signature };
}
