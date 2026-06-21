/**
 * Shared test helpers for the Conduit contract suites.
 *
 * Provides a local test USDC mint (6 decimals), wallet funding, and ATA
 * helpers so the escrow/registry specs can focus on behavior.
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

/** USDC has 6 decimals; 1 USDC = 1_000_000 atomic units. */
export const USDC_DECIMALS = 6;
export const ONE_USDC = 1_000_000;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Airdrop SOL to a pubkey and wait for confirmation. */
export async function fundSol(
  provider: anchor.AnchorProvider,
  to: PublicKey,
  sol = 5
): Promise<void> {
  const sig = await provider.connection.requestAirdrop(
    to,
    sol * LAMPORTS_PER_SOL
  );
  const bh = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction(
    { signature: sig, ...bh },
    "confirmed"
  );
}

/** Create a fresh 6-decimal mint authored by the provider wallet (the "USDC" mint). */
export async function createUsdcMint(
  provider: anchor.AnchorProvider
): Promise<PublicKey> {
  const payer = (provider.wallet as anchor.Wallet).payer;
  return createMint(
    provider.connection,
    payer,
    payer.publicKey, // mint authority
    null,
    USDC_DECIMALS
  );
}

/** Ensure `owner` has an ATA for `mint` and mint `amount` atomic units into it. */
export async function fundUsdc(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  owner: PublicKey,
  amount: number
): Promise<PublicKey> {
  const payer = (provider.wallet as anchor.Wallet).payer;
  const ata = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    owner,
    true
  );
  if (amount > 0) {
    await mintTo(
      provider.connection,
      payer,
      mint,
      ata.address,
      payer, // mint authority
      amount
    );
  }
  return ata.address;
}

/** Read an SPL token account balance as a bigint (0n if the account is gone). */
export async function tokenBalance(
  provider: anchor.AnchorProvider,
  ata: PublicKey
): Promise<bigint> {
  try {
    const acc = await getAccount(provider.connection, ata);
    return acc.amount;
  } catch {
    return 0n;
  }
}

export {
  Keypair,
  PublicKey,
  SystemProgram,
  getAssociatedTokenAddressSync,
};
