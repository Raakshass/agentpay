/**
 * Conduit Registry — on-chain reader & instruction builder.
 *
 * The shipped `conduit-pay` SDK is gateway-facing and has no on-chain registry
 * helpers, so the web app reads `ApiProvider` accounts directly from the Solana
 * RPC and builds Anchor instructions by hand. There is no generated IDL in the
 * web package, so account/instruction layouts are encoded manually to match the
 * Rust source in `programs/registry/src/lib.rs`.
 *
 * Account layout (after the 8-byte Anchor discriminator):
 *   owner             Pubkey   (32)
 *   name              String   (4-byte LE len + utf8 bytes)
 *   endpoint_hash     [u8; 32] (32)
 *   price_usdc        u64      (8)
 *   category          u8       (1)
 *   agent_type        u8       (1)
 *   provider_wallet   Pubkey   (32)
 *   gateway_authority Pubkey   (32)
 *   total_calls       u64      (8)
 *   active            bool     (1)
 *   bump              u8       (1)
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type GetProgramAccountsFilter,
} from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import { config } from "./config";

/** First 8 bytes of sha256("account:ApiProvider"). */
const PROVIDER_DISCRIMINATOR = Buffer.from([
  102, 209, 123, 213, 94, 188, 210, 61,
]);

/** Instruction discriminators — sha256("global:<name>")[0..8]. */
const IX_REGISTER = Buffer.from([254, 209, 54, 184, 46, 197, 109, 78]);
const IX_UPDATE = Buffer.from([52, 208, 141, 191, 164, 54, 108, 150]);
const IX_DEREGISTER = Buffer.from([155, 165, 230, 205, 237, 143, 134, 112]);

const PROVIDER_SEED = Buffer.from("provider");

export const REGISTRY_PROGRAM_ID = new PublicKey(config.registryProgramId);

/** A deserialized on-chain provider, with display-friendly field shapes. */
export interface ProviderAccount {
  /** The provider PDA address (base58). */
  address: string;
  owner: string;
  name: string;
  /** 32-byte endpoint hash, hex-encoded. */
  endpointHash: string;
  /** Price per call in atomic USDC units (1e6 = 1 USDC). */
  priceUsdc: number;
  category: number;
  agentType: number;
  providerWallet: string;
  gatewayAuthority: string;
  totalCalls: number;
  active: boolean;
  bump: number;
}

/** Create a Connection from the configured RPC endpoint. */
export function getConnection(): Connection {
  return new Connection(config.rpcUrl, "confirmed");
}

/** Derive the provider PDA for an owner + provider name. */
export function deriveProviderPda(owner: PublicKey, name: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [PROVIDER_SEED, owner.toBuffer(), Buffer.from(name)],
    REGISTRY_PROGRAM_ID,
  );
  return pda;
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/**
 * Decode a raw account buffer into a ProviderAccount.
 * Returns null if the buffer does not carry the ApiProvider discriminator or
 * is otherwise malformed (defensive against unrelated accounts).
 */
export function decodeProvider(
  address: PublicKey,
  data: Buffer,
): ProviderAccount | null {
  if (data.length < 8 || !data.subarray(0, 8).equals(PROVIDER_DISCRIMINATOR)) {
    return null;
  }

  try {
    let o = 8;
    const owner = new PublicKey(data.subarray(o, o + 32));
    o += 32;

    const nameLen = data.readUInt32LE(o);
    o += 4;
    const name = data.subarray(o, o + nameLen).toString("utf8");
    o += nameLen;

    const endpointHash = toHex(data.subarray(o, o + 32));
    o += 32;

    const priceUsdc = Number(data.readBigUInt64LE(o));
    o += 8;

    const category = data.readUInt8(o);
    o += 1;
    const agentType = data.readUInt8(o);
    o += 1;

    const providerWallet = new PublicKey(data.subarray(o, o + 32));
    o += 32;
    const gatewayAuthority = new PublicKey(data.subarray(o, o + 32));
    o += 32;

    const totalCalls = Number(data.readBigUInt64LE(o));
    o += 8;
    const active = data.readUInt8(o) === 1;
    o += 1;
    const bump = data.readUInt8(o);

    return {
      address: address.toBase58(),
      owner: owner.toBase58(),
      name,
      endpointHash,
      priceUsdc,
      category,
      agentType,
      providerWallet: providerWallet.toBase58(),
      gatewayAuthority: gatewayAuthority.toBase58(),
      totalCalls,
      active,
      bump,
    };
  } catch {
    return null;
  }
}

/** Base memcmp filter that matches every ApiProvider account. */
function discriminatorFilter(): GetProgramAccountsFilter {
  return {
    memcmp: {
      offset: 0,
      bytes: utils.bytes.bs58.encode(PROVIDER_DISCRIMINATOR),
    },
  };
}

/**
 * Fetch every registered provider from the registry program.
 * Throws on RPC failure — callers (e.g. useRegistry) decide on fallbacks.
 */
export async function getProviders(
  connection: Connection = getConnection(),
): Promise<ProviderAccount[]> {
  const accounts = await connection.getProgramAccounts(REGISTRY_PROGRAM_ID, {
    filters: [discriminatorFilter()],
  });

  return accounts
    .map(({ pubkey, account }) => decodeProvider(pubkey, account.data as Buffer))
    .filter((p): p is ProviderAccount => p !== null)
    .sort((a, b) => b.totalCalls - a.totalCalls);
}

/** Fetch only the providers owned by a given wallet. */
export async function getProvidersByOwner(
  owner: PublicKey,
  connection: Connection = getConnection(),
): Promise<ProviderAccount[]> {
  const accounts = await connection.getProgramAccounts(REGISTRY_PROGRAM_ID, {
    filters: [
      discriminatorFilter(),
      // owner is the first field after the discriminator (offset 8).
      { memcmp: { offset: 8, bytes: owner.toBase58() } },
    ],
  });

  return accounts
    .map(({ pubkey, account }) => decodeProvider(pubkey, account.data as Buffer))
    .filter((p): p is ProviderAccount => p !== null);
}

// ---------------------------------------------------------------------------
// Instruction builders (used by the provider dashboard, Phase 4)
// ---------------------------------------------------------------------------

/** Minimal little-endian borsh writer for the few types we encode. */
class BorshWriter {
  private chunks: Buffer[] = [];

  u8(n: number): this {
    this.chunks.push(Buffer.from([n & 0xff]));
    return this;
  }

  u64(n: number | bigint): this {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(n));
    this.chunks.push(buf);
    return this;
  }

  bool(b: boolean): this {
    return this.u8(b ? 1 : 0);
  }

  string(s: string): this {
    const bytes = Buffer.from(s, "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32LE(bytes.length);
    this.chunks.push(len, bytes);
    return this;
  }

  fixed(bytes: Uint8Array): this {
    this.chunks.push(Buffer.from(bytes));
    return this;
  }

  pubkey(key: PublicKey): this {
    return this.fixed(key.toBuffer());
  }

  /** Option<T>: 0x00 for None, 0x01 + value for Some. */
  option<T>(value: T | null | undefined, write: (w: this, v: T) => void): this {
    if (value === null || value === undefined) return this.u8(0);
    this.u8(1);
    write(this, value);
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

export interface RegisterProviderParams {
  owner: PublicKey;
  name: string;
  /** 32-byte endpoint hash. */
  endpointHash: Uint8Array;
  priceUsdc: number | bigint;
  category: number;
  agentType: number;
  providerWallet: PublicKey;
  gatewayAuthority: PublicKey;
}

/** Build a `register_provider` instruction. */
export function buildRegisterProviderIx(
  params: RegisterProviderParams,
): TransactionInstruction {
  if (params.endpointHash.length !== 32) {
    throw new Error("endpointHash must be exactly 32 bytes");
  }
  const provider = deriveProviderPda(params.owner, params.name);

  const data = new BorshWriter()
    .fixed(IX_REGISTER)
    .string(params.name)
    .fixed(params.endpointHash)
    .u64(params.priceUsdc)
    .u8(params.category)
    .u8(params.agentType)
    .pubkey(params.providerWallet)
    .pubkey(params.gatewayAuthority)
    .toBuffer();

  return new TransactionInstruction({
    programId: REGISTRY_PROGRAM_ID,
    keys: [
      { pubkey: params.owner, isSigner: true, isWritable: true },
      { pubkey: provider, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export interface UpdateProviderParams {
  owner: PublicKey;
  name: string;
  newPrice?: number | bigint | null;
  active?: boolean | null;
}

/** Build an `update_provider` instruction (price and/or active flag). */
export function buildUpdateProviderIx(
  params: UpdateProviderParams,
): TransactionInstruction {
  const provider = deriveProviderPda(params.owner, params.name);

  const data = new BorshWriter()
    .fixed(IX_UPDATE)
    .option(params.newPrice, (w, v) => w.u64(v))
    .option(params.active, (w, v) => w.bool(v))
    .toBuffer();

  return new TransactionInstruction({
    programId: REGISTRY_PROGRAM_ID,
    keys: [
      { pubkey: params.owner, isSigner: true, isWritable: false },
      { pubkey: provider, isSigner: false, isWritable: true },
    ],
    data,
  });
}

/** Build a `deregister_provider` instruction (closes the PDA, refunds owner). */
export function buildDeregisterProviderIx(
  owner: PublicKey,
  name: string,
): TransactionInstruction {
  const provider = deriveProviderPda(owner, name);

  return new TransactionInstruction({
    programId: REGISTRY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: provider, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX_DEREGISTER),
  });
}
