/**
 * Escrow state-channel test suite.
 *
 * Exercises the full lifecycle against a local validator:
 *   open_channel -> (off-chain IOU signing) -> settle / claim_refund
 *
 * The IOU bytes are signed off-chain here exactly as the program reconstructs
 * them on-chain:
 *
 *   message = channel_id (32 bytes) || cumulative_amount (u64 LE, 8 bytes)
 *
 * so these tests double as the canonical reference for the SDK's IOU encoder.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import nacl from "tweetnacl";
import {
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Escrow } from "../target/types/escrow";
import {
  ONE_USDC,
  fundSol,
  createUsdcMint,
  fundUsdc,
  tokenBalance,
  sleep,
  Keypair,
  PublicKey,
  SystemProgram,
} from "./shared";

const { BN } = anchor;

/**
 * Assert a promise rejects, optionally matching the error string against a
 * regex. Self-contained so the suite needs no chai-as-promised dependency.
 */
async function expectRevert(p: Promise<unknown>, pattern?: RegExp) {
  try {
    await p;
  } catch (err) {
    if (pattern) {
      const msg = `${(err as any)?.message ?? ""} ${JSON.stringify(
        (err as any)?.logs ?? ""
      )} ${String(err)}`;
      assert.match(msg, pattern, `error did not match ${pattern}`);
    }
    return;
  }
  assert.fail("expected the call to revert, but it resolved");
}

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Workspace key casing varies across anchor versions; accept either.
  const program = ((anchor.workspace as any).Escrow ??
    (anchor.workspace as any).escrow) as Program<Escrow>;

  let usdcMint: PublicKey;

  before(async () => {
    usdcMint = await createUsdcMint(provider);
  });

  /** A fresh random 32-byte channel id. */
  function newChannelId(): Buffer {
    return Buffer.from(Keypair.generate().publicKey.toBuffer());
  }

  /** Reconstruct the exact 40 IOU bytes the program verifies. */
  function iouMessage(channelId: Buffer, cumulative: anchor.BN): Buffer {
    return Buffer.concat([
      channelId, // 32 bytes
      cumulative.toArrayLike(Buffer, "le", 8), // u64 LE, 8 bytes
    ]);
  }

  /** Sign an IOU with the agent's ed25519 secret key (tweetnacl, detached). */
  function signIou(
    agent: Keypair,
    channelId: Buffer,
    cumulative: anchor.BN
  ): number[] {
    const sig = nacl.sign.detached(
      iouMessage(channelId, cumulative),
      agent.secretKey
    );
    return Array.from(sig); // [u8; 64]
  }

  function channelPda(agent: PublicKey, channelId: Buffer): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("channel"), agent.toBuffer(), channelId],
      program.programId
    )[0];
  }

  /**
   * Spin up a fresh channel funded with `depositUsdc` USDC. Returns every handle
   * the settle/refund paths need.
   */
  async function openChannel(opts: {
    depositUsdc: number;
    timeoutSeconds: number;
  }) {
    const agent = Keypair.generate();
    const gateway = Keypair.generate();
    const providerAcc = Keypair.generate();
    const channelId = newChannelId();

    // Agents and gateways must hold SOL for rent / init-if-needed ATAs.
    await fundSol(provider, agent.publicKey);
    await fundSol(provider, gateway.publicKey);

    const deposit = opts.depositUsdc * ONE_USDC;
    const agentAta = await fundUsdc(
      provider,
      usdcMint,
      agent.publicKey,
      deposit
    );

    const channel = channelPda(agent.publicKey, channelId);
    const vault = getAssociatedTokenAddressSync(usdcMint, channel, true);

    await program.methods
      .openChannel(
        Array.from(channelId),
        new BN(deposit),
        providerAcc.publicKey,
        gateway.publicKey,
        new BN(opts.timeoutSeconds)
      )
      .accounts({
        agent: agent.publicKey,
        channel,
        usdcMint,
        agentTokenAccount: agentAta,
        vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent])
      .rpc();

    return {
      agent,
      gateway,
      providerAcc,
      channelId,
      deposit,
      channel,
      vault,
      agentAta,
    };
  }

  /** Build the settle accounts object for a given channel handle. */
  function settleAccounts(h: Awaited<ReturnType<typeof openChannel>>) {
    const providerAta = getAssociatedTokenAddressSync(
      usdcMint,
      h.providerAcc.publicKey
    );
    return {
      providerAta,
      accounts: {
        gateway: h.gateway.publicKey,
        channel: h.channel,
        agent: h.agent.publicKey,
        provider: h.providerAcc.publicKey,
        usdcMint,
        vault: h.vault,
        providerTokenAccount: providerAta,
        agentTokenAccount: h.agentAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
    };
  }

  it("open_channel locks the deposit into the vault", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 3600 });

    const ch = await program.account.channel.fetch(h.channel);
    assert.equal(ch.agent.toBase58(), h.agent.publicKey.toBase58());
    assert.equal(ch.gateway.toBase58(), h.gateway.publicKey.toBase58());
    assert.equal(ch.provider.toBase58(), h.providerAcc.publicKey.toBase58());
    assert.ok(ch.depositAmount.eq(new BN(10 * ONE_USDC)));
    assert.equal(ch.settled, false);

    // Funds left the agent and now sit in the vault.
    assert.equal(await tokenBalance(provider, h.agentAta), 0n);
    assert.equal(await tokenBalance(provider, h.vault), BigInt(10 * ONE_USDC));
  });

  it("happy path: 10 USDC deposit, 2 USDC IOU -> 2 to provider, 8 refunded", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 3600 });
    const cumulative = new BN(2 * ONE_USDC);
    const sig = signIou(h.agent, h.channelId, cumulative);

    const { providerAta, accounts } = settleAccounts(h);

    await program.methods
      .settle(cumulative, sig)
      .accounts(accounts)
      .signers([h.gateway])
      .rpc();

    assert.equal(
      await tokenBalance(provider, providerAta),
      BigInt(2 * ONE_USDC),
      "provider should receive 2 USDC"
    );
    assert.equal(
      await tokenBalance(provider, h.agentAta),
      BigInt(8 * ONE_USDC),
      "agent should be refunded 8 USDC"
    );
    // Vault + channel are closed.
    assert.equal(await tokenBalance(provider, h.vault), 0n);
    await expectRevert(
      program.account.channel.fetch(h.channel),
      /Account does not exist|could not find/i
    );
  });

  it("multiple IOUs: settle the LAST cumulative (2.00) of 0.02/0.05/2.00", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 3600 });

    // Agent signs a monotonically increasing sequence off-chain; the gateway
    // only ever submits the latest one.
    const ious = [
      new BN(0.02 * ONE_USDC),
      new BN(0.05 * ONE_USDC),
      new BN(2.0 * ONE_USDC),
    ];
    const signed = ious.map((amt) => ({
      amt,
      sig: signIou(h.agent, h.channelId, amt),
    }));
    const last = signed[signed.length - 1];

    const { providerAta, accounts } = settleAccounts(h);

    await program.methods
      .settle(last.amt, last.sig)
      .accounts(accounts)
      .signers([h.gateway])
      .rpc();

    assert.equal(
      await tokenBalance(provider, providerAta),
      BigInt(2 * ONE_USDC)
    );
    assert.equal(
      await tokenBalance(provider, h.agentAta),
      BigInt(8 * ONE_USDC)
    );
  });

  it("forged signature: wrong keypair signs the IOU -> rejected", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 3600 });
    const cumulative = new BN(2 * ONE_USDC);

    // Correct message, but signed by an attacker rather than the agent.
    const attacker = Keypair.generate();
    const forged = signIou(attacker, h.channelId, cumulative);

    const { accounts } = settleAccounts(h);
    await expectRevert(
      program.methods
        .settle(cumulative, forged)
        .accounts(accounts)
        .signers([h.gateway])
        .rpc(),
      /InvalidSignature/
    );
  });

  it("tampered amount: settle amount differs from the signed amount -> rejected", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 3600 });

    // Agent signed for 2 USDC; gateway tries to settle 5 USDC with that sig.
    const signedAmount = new BN(2 * ONE_USDC);
    const sig = signIou(h.agent, h.channelId, signedAmount);
    const tamperedAmount = new BN(5 * ONE_USDC);

    const { accounts } = settleAccounts(h);
    await expectRevert(
      program.methods
        .settle(tamperedAmount, sig)
        .accounts(accounts)
        .signers([h.gateway])
        .rpc(),
      /InvalidSignature/
    );
  });

  it("overdraw: cumulative_amount > deposit -> rejected", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 3600 });

    // Validly signed, but claims more than was ever deposited.
    const overdraw = new BN(11 * ONE_USDC);
    const sig = signIou(h.agent, h.channelId, overdraw);

    const { accounts } = settleAccounts(h);
    await expectRevert(
      program.methods
        .settle(overdraw, sig)
        .accounts(accounts)
        .signers([h.gateway])
        .rpc(),
      /Overdraw/
    );
  });

  it("double settle: the second settle must fail", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 3600 });
    const cumulative = new BN(2 * ONE_USDC);
    const sig = signIou(h.agent, h.channelId, cumulative);
    const { accounts } = settleAccounts(h);

    await program.methods
      .settle(cumulative, sig)
      .accounts(accounts)
      .signers([h.gateway])
      .rpc();

    // The channel + vault are closed by the first settle, so the second attempt
    // can never release funds again.
    await expectRevert(
      program.methods
        .settle(cumulative, sig)
        .accounts(accounts)
        .signers([h.gateway])
        .rpc()
    );
  });

  it("refund path: after timeout the agent reclaims the full deposit", async () => {
    // Short timeout so the wall-clock validator passes the deadline quickly.
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 1 });
    await sleep(2500); // let created_at + timeout_seconds elapse

    await program.methods
      .claimRefund()
      .accounts({
        agent: h.agent.publicKey,
        channel: h.channel,
        usdcMint,
        vault: h.vault,
        agentTokenAccount: h.agentAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([h.agent])
      .rpc();

    assert.equal(
      await tokenBalance(provider, h.agentAta),
      BigInt(10 * ONE_USDC),
      "agent should get the entire deposit back"
    );
    assert.equal(await tokenBalance(provider, h.vault), 0n);
  });

  it("refund blocked before timeout: claim_refund too early -> rejected", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 3600 });

    await expectRevert(
      program.methods
        .claimRefund()
        .accounts({
          agent: h.agent.publicKey,
          channel: h.channel,
          usdcMint,
          vault: h.vault,
          agentTokenAccount: h.agentAta,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([h.agent])
        .rpc(),
      /TimeoutNotReached/
    );
  });

  it("refund blocked after settle: settle then claim_refund -> rejected", async () => {
    const h = await openChannel({ depositUsdc: 10, timeoutSeconds: 1 });
    const cumulative = new BN(2 * ONE_USDC);
    const sig = signIou(h.agent, h.channelId, cumulative);
    const { accounts } = settleAccounts(h);

    await program.methods
      .settle(cumulative, sig)
      .accounts(accounts)
      .signers([h.gateway])
      .rpc();

    await sleep(2500); // even past the timeout, a settled channel is gone

    await expectRevert(
      program.methods
        .claimRefund()
        .accounts({
          agent: h.agent.publicKey,
          channel: h.channel,
          usdcMint,
          vault: h.vault,
          agentTokenAccount: h.agentAta,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([h.agent])
        .rpc()
    );
  });
});
