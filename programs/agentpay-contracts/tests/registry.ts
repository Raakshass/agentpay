/**
 * Registry test suite.
 *
 * Covers the permissionless provider catalog: register, owner-only updates,
 * gateway-authority call metering, and owner-only deregistration — plus the
 * negative authorization paths for each.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Registry } from "../target/types/registry";
import { fundSol, Keypair, PublicKey, SystemProgram } from "./shared";

const { BN } = anchor;

/** Assert a promise rejects, optionally matching its error against a regex. */
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

// Mirrors the on-chain enums.
const Category = { Weather: 0, Mapping: 1, Network: 2, Compute: 3, Agent: 4 };
const AgentType = { Api: 0, Agent: 1, Depin: 2 };

describe("registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = ((anchor.workspace as any).Registry ??
    (anchor.workspace as any).registry) as Program<Registry>;

  function providerPda(owner: PublicKey, name: string): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("provider"), owner.toBuffer(), Buffer.from(name)],
      program.programId
    )[0];
  }

  /** Register a provider owned by a fresh keypair. Returns the handles. */
  async function register(opts?: {
    name?: string;
    price?: number;
    gatewayAuthority?: PublicKey;
  }) {
    const owner = Keypair.generate();
    await fundSol(provider, owner.publicKey);

    const name = opts?.name ?? `weather-${Date.now()}-${Math.random()}`.slice(0, 50);
    const price = opts?.price ?? 50_000; // 0.05 USDC
    const providerWallet = Keypair.generate().publicKey;
    const gatewayAuthority = opts?.gatewayAuthority ?? Keypair.generate().publicKey;
    const endpointHash = Array.from(Buffer.alloc(32, 7)); // keccak256(url) stand-in

    const pda = providerPda(owner.publicKey, name);

    await program.methods
      .registerProvider(
        name,
        endpointHash,
        new BN(price),
        Category.Weather,
        AgentType.Api,
        providerWallet,
        gatewayAuthority
      )
      .accounts({
        owner: owner.publicKey,
        provider: pda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    return { owner, name, price, providerWallet, gatewayAuthority, pda, endpointHash };
  }

  it("register -> all fields persisted", async () => {
    const r = await register({ name: "acme-weather", price: 50_000 });

    const acc = await program.account.apiProvider.fetch(r.pda);
    assert.equal(acc.owner.toBase58(), r.owner.publicKey.toBase58());
    assert.equal(acc.name, "acme-weather");
    assert.deepEqual(Array.from(acc.endpointHash), r.endpointHash);
    assert.ok(acc.priceUsdc.eq(new BN(50_000)));
    assert.equal(acc.category, Category.Weather);
    assert.equal(acc.agentType, AgentType.Api);
    assert.equal(acc.providerWallet.toBase58(), r.providerWallet.toBase58());
    assert.equal(
      acc.gatewayAuthority.toBase58(),
      r.gatewayAuthority.toBase58()
    );
    assert.ok(acc.totalCalls.eq(new BN(0)));
    assert.equal(acc.active, true);
  });

  it("register rejects an empty name and a zero price", async () => {
    const owner = Keypair.generate();
    await fundSol(provider, owner.publicKey);
    const gatewayAuthority = Keypair.generate().publicKey;
    const providerWallet = Keypair.generate().publicKey;
    const hash = Array.from(Buffer.alloc(32, 1));

    // Zero price.
    await expectRevert(
      program.methods
        .registerProvider(
          "zero-price",
          hash,
          new BN(0),
          Category.Weather,
          AgentType.Api,
          providerWallet,
          gatewayAuthority
        )
        .accounts({
          owner: owner.publicKey,
          provider: providerPda(owner.publicKey, "zero-price"),
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc(),
      /InvalidPrice/
    );
  });

  it("update price + deactivate as owner; non-owner cannot update", async () => {
    const r = await register({ price: 50_000 });

    // Owner updates price and deactivates.
    await program.methods
      .updateProvider(new BN(123_456), false)
      .accounts({ owner: r.owner.publicKey, provider: r.pda })
      .signers([r.owner])
      .rpc();

    let acc = await program.account.apiProvider.fetch(r.pda);
    assert.ok(acc.priceUsdc.eq(new BN(123_456)));
    assert.equal(acc.active, false);

    // Partial update: flip active back on, leave price untouched (null).
    await program.methods
      .updateProvider(null, true)
      .accounts({ owner: r.owner.publicKey, provider: r.pda })
      .signers([r.owner])
      .rpc();

    acc = await program.account.apiProvider.fetch(r.pda);
    assert.ok(acc.priceUsdc.eq(new BN(123_456)), "price unchanged on null");
    assert.equal(acc.active, true);

    // A non-owner cannot update: the seeds derive from the signer, so a
    // stranger's signature can never address the real provider PDA.
    const attacker = Keypair.generate();
    await fundSol(provider, attacker.publicKey);
    await expectRevert(
      program.methods
        .updateProvider(new BN(1), null)
        .accounts({ owner: attacker.publicKey, provider: r.pda })
        .signers([attacker])
        .rpc()
    );
  });

  it("increment_call_count: gateway authority succeeds, random signer fails", async () => {
    const gatewayAuthorityKp = Keypair.generate();
    await fundSol(provider, gatewayAuthorityKp.publicKey);
    const r = await register({
      gatewayAuthority: gatewayAuthorityKp.publicKey,
    });

    await program.methods
      .incrementCallCount()
      .accounts({
        gatewayAuthority: gatewayAuthorityKp.publicKey,
        provider: r.pda,
      })
      .signers([gatewayAuthorityKp])
      .rpc();

    let acc = await program.account.apiProvider.fetch(r.pda);
    assert.ok(acc.totalCalls.eq(new BN(1)));

    // A random signer is rejected by the gateway_authority constraint.
    const stranger = Keypair.generate();
    await fundSol(provider, stranger.publicKey);
    await expectRevert(
      program.methods
        .incrementCallCount()
        .accounts({ gatewayAuthority: stranger.publicKey, provider: r.pda })
        .signers([stranger])
        .rpc(),
      /Unauthorized/
    );

    // Counter unchanged after the failed attempt.
    acc = await program.account.apiProvider.fetch(r.pda);
    assert.ok(acc.totalCalls.eq(new BN(1)));
  });

  it("deregister: non-owner fails, owner closes the account", async () => {
    const r = await register();

    // Non-owner cannot deregister.
    const attacker = Keypair.generate();
    await fundSol(provider, attacker.publicKey);
    await expectRevert(
      program.methods
        .deregisterProvider()
        .accounts({ owner: attacker.publicKey, provider: r.pda })
        .signers([attacker])
        .rpc()
    );

    // Owner deregisters; PDA is closed and rent reclaimed.
    await program.methods
      .deregisterProvider()
      .accounts({ owner: r.owner.publicKey, provider: r.pda })
      .signers([r.owner])
      .rpc();

    await expectRevert(
      program.account.apiProvider.fetch(r.pda),
      /Account does not exist|could not find/i
    );
  });
});
