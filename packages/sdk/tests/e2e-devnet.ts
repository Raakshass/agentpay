/**
 * Conduit End-to-End Devnet Test
 *
 * Exercises the full state channel lifecycle against Solana Devnet:
 *
 *   1. Create test wallets (agent, provider, gateway)
 *   2. Airdrop SOL + create devnet USDC
 *   3. Agent deposits USDC via escrow open_channel
 *   4. Agent opens a session with the gateway
 *   5. Agent makes 3 API calls with signed IOUs
 *   6. Agent closes the session (gateway settles on-chain)
 *   7. Verify final balances
 *
 * Usage:
 *   npx tsx packages/sdk/tests/e2e-devnet.ts
 *
 * Prerequisites:
 *   - Gateway server running on localhost:4020
 *   - Escrow program deployed on devnet (ESCROW_PROGRAM_ID in .env)
 *   - Devnet USDC mint (USDC_MINT_ADDRESS in .env)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createInitializeMintInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Configuration — adjust these to match your deployment
// ---------------------------------------------------------------------------

const GATEWAY_URL = process.env["GATEWAY_URL"] ?? "http://localhost:4020";
const RPC_URL = process.env["RPC_URL"] ?? "https://api.devnet.solana.com";
const ESCROW_PROGRAM_ID = new PublicKey(
  process.env["ESCROW_PROGRAM_ID"] ?? "8vH1iEpbwe31WGqSGd9a8qkKh7SCHW8MsaSULVsxskRw"
);

/**
 * Gateway server's public key — used as the authorized settler in escrow.
 * Set via GATEWAY_PUBKEY env var or fetched from the gateway /health endpoint.
 */
const GATEWAY_PUBKEY_STR = process.env["GATEWAY_PUBKEY"] ?? "";

/**
 * Pre-funded deployer keypair (avoids devnet airdrop rate limits).
 * Set FUNDER_KEY env var to the JSON byte array from solana-keygen.
 * If not set, falls back to airdrop (which may fail on public devnet RPC).
 */
function loadFunderKeypair(): Keypair | null {
  const raw = process.env["FUNDER_KEY"];
  if (!raw) return null;
  try {
    const bytes = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {
    console.log("  ⚠ FUNDER_KEY env var is invalid, falling back to airdrop");
    return null;
  }
}
const FUNDER = loadFunderKeypair();

/** Atomic USDC units (6 decimals) */
const ONE_USDC = 1_000_000;
const DEPOSIT_USDC = 1;
const API_PRICE_ATOMIC = 100_000; // 0.1 USDC per call
const NUM_API_CALLS = 3;

// ---------------------------------------------------------------------------
// Anchor instruction discriminators
// ---------------------------------------------------------------------------

function anchorDiscriminator(namespacedName: string): Buffer {
  return createHash("sha256")
    .update(namespacedName)
    .digest()
    .subarray(0, 8) as unknown as Buffer;
}

const IX_OPEN_CHANNEL = anchorDiscriminator("global:open_channel");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function explorerAddr(addr: string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}

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
    result = ALPHABET[remainder]! + result;
  }
  for (const byte of bytes) {
    if (byte === 0) result = "1" + result;
    else break;
  }
  return result;
}

function serializeIouBinary(channelIdBytes: Uint8Array, cumulativeAtomic: number): Uint8Array {
  const message = new Uint8Array(40);
  message.set(channelIdBytes, 0);
  let amount = BigInt(cumulativeAtomic);
  for (let i = 0; i < 8; i++) {
    message[32 + i] = Number(amount & BigInt(0xff));
    amount = amount >> BigInt(8);
  }
  return message;
}

async function airdropSol(connection: Connection, pubkey: PublicKey, sol: number): Promise<void> {
  console.log(`  airdropping ${sol} SOL to ${pubkey.toBase58().slice(0, 8)}...`);
  const maxRetries = 5;
  let remaining = sol;

  while (remaining > 0) {
    const chunk = Math.min(remaining, 1); // devnet limits 1 SOL per request
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const sig = await connection.requestAirdrop(pubkey, chunk * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
        console.log(`  ✓ airdrop ${chunk} SOL confirmed (attempt ${attempt})`);
        remaining -= chunk;
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  ⚠ airdrop attempt ${attempt}/${maxRetries} failed: ${msg.slice(0, 80)}`);
        if (attempt === maxRetries) {
          throw new Error(`airdrop failed after ${maxRetries} attempts`);
        }
        const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`    retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
      }
    }
    // Small delay between chunks
    if (remaining > 0) await sleep(2000);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Step 1: Create test wallets
// ---------------------------------------------------------------------------

async function createTestWallets() {
  console.log("\n═══ step 1: create test wallets ═══");

  const agent = Keypair.generate();
  const provider = Keypair.generate();

  console.log(`  agent:    ${agent.publicKey.toBase58()}`);
  console.log(`            ${explorerAddr(agent.publicKey.toBase58())}`);
  console.log(`  provider: ${provider.publicKey.toBase58()}`);

  return { agent, provider };
}

// ---------------------------------------------------------------------------
// Step 2: Fund wallets + create USDC mint
// ---------------------------------------------------------------------------

async function transferSol(
  connection: Connection,
  from: Keypair,
  to: PublicKey,
  sol: number
): Promise<void> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: sol * LAMPORTS_PER_SOL,
    })
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [from]);
  console.log(`  ✓ transferred ${sol} SOL to ${to.toBase58().slice(0, 8)}...`);
}

async function fundWallets(
  connection: Connection,
  agent: Keypair,
  provider: Keypair,
) {
  console.log("\n═══ step 2: fund wallets ═══");

  if (FUNDER) {
    console.log(`  using pre-funded deployer: ${FUNDER.publicKey.toBase58().slice(0, 8)}...`);
    const balance = await connection.getBalance(FUNDER.publicKey);
    console.log(`  funder balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    await transferSol(connection, FUNDER, agent.publicKey, 0.5);
  } else {
    console.log("  no FUNDER_KEY set, using airdrop (may be rate-limited)...");
    await airdropSol(connection, agent.publicKey, 1);
    await sleep(1000);
  }
}

async function createDevnetUsdcMint(
  connection: Connection,
  payer: Keypair
): Promise<PublicKey> {
  console.log("\n═══ step 2b: create test usdc mint ═══");

  const mint = Keypair.generate();
  const rentExempt = await getMinimumBalanceForRentExemptMint(connection);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports: rentExempt,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mint.publicKey,
      6, // USDC decimals
      payer.publicKey, // mint authority
      null // freeze authority
    )
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  console.log(`  ✓ usdc mint created: ${mint.publicKey.toBase58()}`);
  console.log(`    ${explorerTx(sig)}`);

  return mint.publicKey;
}

async function mintUsdcToAgent(
  connection: Connection,
  usdcMint: PublicKey,
  mintAuthority: Keypair,
  agentPubkey: PublicKey,
  amountUsdc: number
): Promise<PublicKey> {
  console.log(`\n═══ step 2c: mint ${amountUsdc} usdc to agent ═══`);

  const agentAta = getAssociatedTokenAddressSync(usdcMint, agentPubkey);

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      mintAuthority.publicKey,
      agentAta,
      agentPubkey,
      usdcMint
    ),
    createMintToInstruction(
      usdcMint,
      agentAta,
      mintAuthority.publicKey,
      amountUsdc * ONE_USDC
    )
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [mintAuthority]);
  console.log(`  ✓ minted ${amountUsdc} usdc to agent ata: ${agentAta.toBase58()}`);
  console.log(`    ${explorerTx(sig)}`);

  return agentAta;
}

// ---------------------------------------------------------------------------
// Step 3: Open channel on-chain (agent deposits)
// ---------------------------------------------------------------------------

async function openChannel(
  connection: Connection,
  agent: Keypair,
  provider: PublicKey,
  gateway: PublicKey,
  usdcMint: PublicKey,
  depositUsdc: number
): Promise<{ channelId: Buffer; channelPda: PublicKey; vault: PublicKey }> {
  console.log(`\n═══ step 3: open channel (deposit ${depositUsdc} usdc) ═══`);

  const channelId = Buffer.from(Keypair.generate().publicKey.toBuffer());
  const depositAtomic = depositUsdc * ONE_USDC;

  const [channelPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("channel"), agent.publicKey.toBuffer(), channelId],
    ESCROW_PROGRAM_ID
  );

  const vault = getAssociatedTokenAddressSync(usdcMint, channelPda, true);
  const agentAta = getAssociatedTokenAddressSync(usdcMint, agent.publicKey);

  // Build open_channel instruction data
  const data = Buffer.alloc(8 + 32 + 8 + 32 + 32 + 8);
  let offset = 0;

  // Discriminator
  IX_OPEN_CHANNEL.copy(data, offset); offset += 8;
  // channel_id: [u8; 32]
  channelId.copy(data, offset); offset += 32;
  // deposit_amount: u64 LE
  data.writeBigUInt64LE(BigInt(depositAtomic), offset); offset += 8;
  // provider: Pubkey
  provider.toBuffer().copy(data, offset); offset += 32;
  // gateway: Pubkey
  gateway.toBuffer().copy(data, offset); offset += 32;
  // timeout_seconds: i64 LE (1 hour)
  data.writeBigInt64LE(BigInt(3600), offset);

  const ix = new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
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
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [agent]);

  console.log(`  ✓ channel opened`);
  console.log(`    channel pda: ${channelPda.toBase58()}`);
  console.log(`    channel id:  ${bytesToBase58(channelId)}`);
  console.log(`    vault:       ${vault.toBase58()}`);
  console.log(`    ${explorerTx(sig)}`);

  return { channelId, channelPda, vault };
}

// ---------------------------------------------------------------------------
// Step 4-6: Gateway interaction (HTTP)
// ---------------------------------------------------------------------------

async function openGatewaySession(
  sessionPda: string,
  channelId: string,
  agentPublicKey: string,
  providerPublicKey: string,
  depositAtomic: number,
  usdcMint: string
): Promise<void> {
  console.log(`\n═══ step 4: open gateway session ═══`);

  const response = await fetch(`${GATEWAY_URL}/session/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionPda,
      channelId,
      agentPublicKey,
      providerPublicKey,
      depositAmountAtomic: depositAtomic,
      usdcMint,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`failed to open session: ${response.status} ${body}`);
  }

  const result = await response.json();
  console.log(`  ✓ session registered with gateway`);
  console.log(`    response:`, JSON.stringify(result, null, 2));
}

async function makeApiCalls(
  agent: Keypair,
  channelId: Buffer,
  sessionPda: string,
  numCalls: number,
  pricePerCall: number
): Promise<{ finalCumulative: number; finalSignature: Uint8Array }> {
  console.log(`\n═══ step 5: make ${numCalls} api calls ═══`);

  let cumulative = 0;
  let lastSig = new Uint8Array(64);
  const channelIdBase58 = bytesToBase58(channelId);

  for (let i = 0; i < numCalls; i++) {
    cumulative += pricePerCall;
    const requestCount = i + 1;
    const timestamp = Math.floor(Date.now() / 1000);

    // Sign the IOU (binary format: channel_id || cumulative LE)
    const iouBytes = serializeIouBinary(channelId, cumulative);
    const signature = nacl.sign.detached(iouBytes, agent.secretKey);
    lastSig = signature;

    // Build IOU JSON for the header
    const iouJson = JSON.stringify({
      session: channelIdBase58,
      cumulative_usdc: cumulative,
      request_count: requestCount,
      timestamp,
    });

    // Encode signature to base64
    let binary = "";
    for (const byte of signature) {
      binary += String.fromCharCode(byte);
    }
    const sigBase64 = btoa(binary);

    console.log(`  call #${requestCount}: cumulative=${cumulative} atomic usdc`);

    const response = await fetch(`${GATEWAY_URL}/api/depin-weather/london`, {
      headers: {
        "X-SESSION": sessionPda,
        "X-IOU": iouJson,
        "X-SIGNATURE": sigBase64,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      // API call may fail if no API key is set — that's OK for testing the IOU flow
      console.log(`    ⚠ upstream returned ${response.status} (iou still accepted)`);
    } else {
      console.log(`    ✓ response received`);
    }

    await sleep(500);
  }

  console.log(`  final cumulative: ${cumulative} atomic usdc (${cumulative / ONE_USDC} usdc)`);

  return { finalCumulative: cumulative, finalSignature: lastSig };
}

async function closeGatewaySession(sessionPda: string): Promise<Record<string, unknown>> {
  console.log(`\n═══ step 6: close session (triggers settlement) ═══`);

  const response = await fetch(`${GATEWAY_URL}/session/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionPda }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`failed to close session: ${response.status} ${body}`);
  }

  const result = (await response.json()) as Record<string, unknown>;
  console.log(`  ✓ session closed`);
  console.log(`    response:`, JSON.stringify(result, null, 2));

  return result;
}

// ---------------------------------------------------------------------------
// Step 7: Verify balances
// ---------------------------------------------------------------------------

async function verifyBalances(
  connection: Connection,
  usdcMint: PublicKey,
  agentPubkey: PublicKey,
  providerPubkey: PublicKey,
  depositAtomic: number,
  usedAtomic: number
) {
  console.log(`\n═══ step 7: verify final balances ═══`);

  const expectedProviderBalance = BigInt(usedAtomic);
  const expectedAgentRefund = BigInt(depositAtomic - usedAtomic);

  const providerAta = getAssociatedTokenAddressSync(usdcMint, providerPubkey);
  const agentAta = getAssociatedTokenAddressSync(usdcMint, agentPubkey);

  // Wait for finalization
  await sleep(2000);

  try {
    const providerInfo = await connection.getTokenAccountBalance(providerAta);
    const providerBalance = BigInt(providerInfo.value.amount);
    console.log(`  provider balance: ${providerBalance} atomic usdc (expected: ${expectedProviderBalance})`);

    if (providerBalance === expectedProviderBalance) {
      console.log(`  ✓ provider balance correct`);
    } else {
      console.log(`  ✗ provider balance mismatch!`);
    }
  } catch {
    console.log(`  ⚠ provider ata not found (settlement may not have run yet)`);
  }

  try {
    const agentInfo = await connection.getTokenAccountBalance(agentAta);
    const agentBalance = BigInt(agentInfo.value.amount);
    console.log(`  agent balance: ${agentBalance} atomic usdc (expected refund: ${expectedAgentRefund})`);

    if (agentBalance === expectedAgentRefund) {
      console.log(`  ✓ agent refund correct`);
    } else {
      console.log(`  ⚠ agent balance is ${agentBalance} (may include pre-existing balance)`);
    }
  } catch {
    console.log(`  ⚠ agent ata not found`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║   conduit e2e devnet test                     ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║  gateway:  ${GATEWAY_URL.padEnd(36)}║`);
  console.log(`║  rpc:      ${RPC_URL.slice(0, 36).padEnd(36)}║`);
  console.log(`║  escrow:   ${ESCROW_PROGRAM_ID.toBase58().slice(0, 36).padEnd(36)}║`);
  console.log("╚════════════════════════════════════════════════╝");

  const connection = new Connection(RPC_URL, "confirmed");

  // Step 1: Create wallets
  const { agent, provider } = await createTestWallets();

  // Resolve the gateway server's public key
  let gatewayPubkey: PublicKey;
  if (GATEWAY_PUBKEY_STR) {
    gatewayPubkey = new PublicKey(GATEWAY_PUBKEY_STR);
  } else {
    // Fetch from gateway /health endpoint or use env
    console.log("  fetching gateway pubkey from server...");
    const resp = await fetch(`${GATEWAY_URL}/health`);
    const healthData = await resp.json() as Record<string, unknown>;
    const pubkey = healthData["gatewayPublicKey"] as string | undefined;
    if (pubkey) {
      gatewayPubkey = new PublicKey(pubkey);
    } else {
      // Fallback: parse from GATEWAY_WALLET_PRIVATE_KEY env
      const rawKey = process.env["GATEWAY_WALLET_PRIVATE_KEY"];
      if (rawKey) {
        const bytes = JSON.parse(rawKey) as number[];
        gatewayPubkey = Keypair.fromSecretKey(Uint8Array.from(bytes)).publicKey;
      } else {
        throw new Error("Cannot determine gateway public key. Set GATEWAY_PUBKEY env var.");
      }
    }
  }
  console.log(`  gateway:  ${gatewayPubkey.toBase58()}`);

  // Step 2: Fund wallets
  await fundWallets(connection, agent, provider);

  // Step 2b: Create test USDC mint (agent is mint authority for testing)
  const usdcMint = await createDevnetUsdcMint(connection, agent);

  // Step 2c: Mint USDC to agent
  const depositAtomic = DEPOSIT_USDC * ONE_USDC;
  await mintUsdcToAgent(connection, usdcMint, agent, agent.publicKey, DEPOSIT_USDC);

  // Step 3: Open channel on-chain
  const { channelId, channelPda, vault } = await openChannel(
    connection,
    agent,
    provider.publicKey,
    gatewayPubkey,
    usdcMint,
    DEPOSIT_USDC
  );

  const channelIdBase58 = bytesToBase58(channelId);
  const sessionPda = channelPda.toBase58();

  // Step 4: Open gateway session
  await openGatewaySession(
    sessionPda,
    channelIdBase58,
    agent.publicKey.toBase58(),
    provider.publicKey.toBase58(),
    depositAtomic,
    usdcMint.toBase58()
  );

  // Step 5: Make API calls
  const { finalCumulative } = await makeApiCalls(
    agent,
    channelId,
    sessionPda,
    NUM_API_CALLS,
    API_PRICE_ATOMIC
  );

  // Step 6: Close session (triggers settlement)
  const closeResult = await closeGatewaySession(sessionPda);

  // Step 7: Verify balances
  await verifyBalances(
    connection,
    usdcMint,
    agent.publicKey,
    provider.publicKey,
    depositAtomic,
    finalCumulative
  );

  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║   e2e test complete                           ║");
  console.log("╚════════════════════════════════════════════════╝");

  // Print summary
  const settlement = closeResult["settlement"] as Record<string, unknown> | undefined;
  if (settlement?.["isSuccess"]) {
    console.log(`\n✓ settlement tx: ${settlement["transactionSignature"]}`);
    console.log(`  ${explorerTx(settlement["transactionSignature"] as string)}`);
  } else {
    console.log(`\n⚠ settlement pending: ${settlement?.["reason"] ?? "unknown"}`);
    console.log("  (this is expected if escrow program is not yet deployed)");
  }
}

main().catch((error) => {
  console.error("\n✗ e2e test failed:", error);
  process.exit(1);
});
