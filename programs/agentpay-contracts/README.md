# AgentPay Contracts

On-chain layer for **AgentPay** — an x402-style agent payment protocol on Solana.
AI agents pay for API calls in USDC through a **state-channel escrow**, and
providers advertise themselves in a permissionless **registry**.

Two Anchor programs live in this workspace:

| Program    | Program ID                                     | Purpose                                    |
| ---------- | ---------------------------------------------- | ------------------------------------------ |
| `escrow`   | `8vH1iEpbwe31WGqSGd9a8qkKh7SCHW8MsaSULVsxskRw`  | State-channel deposit / settle / refund    |
| `registry` | `XGXadfKb7mru5wcr1yUZWSeBLVUY6NFDAriBUUMiLbk`  | On-chain catalog of API/agent/DePIN providers |

USDC is modeled as a standard SPL token with **6 decimals**. All on-chain
amounts are atomic units (`1 USDC = 1_000_000`).

---

## Layout

```
agentpay-contracts/
├── programs/escrow/        # state channel
├── programs/registry/      # provider catalog
├── tests/escrow.ts         # full escrow lifecycle + attack cases
├── tests/registry.ts       # registry CRUD + authorization cases
├── tests/shared.ts         # test USDC mint / funding helpers
├── Anchor.toml
└── package.json
```

## Build & test

> **Note:** there are local Anchor dependency issues in this environment, so the
> programs are intended to be built and tested on a hosted Anchor/Solana
> Playground-style environment rather than locally.

```bash
anchor build         # compiles both programs, generates IDLs + TS types
anchor test          # boots a local validator and runs tests/*.ts
```

Tests create their own test USDC mint, fund fresh wallets, and create ATAs as
needed — no external setup required.

---

## The state-channel flow (escrow)

```
A) DEPOSIT  open_channel   agent locks USDC into a PDA-owned vault
B) USE      (off-chain)    agent signs cumulative IOUs; program is NOT called
C) SETTLE   settle         gateway submits latest IOU; provider paid, agent refunded
D) CRASH    claim_refund   if gateway never settles, agent reclaims after timeout
```

During **USE**, the agent signs a growing cumulative total (e.g. `$0.02`, then
`$0.05`, then `$2.00`). The gateway keeps only the **latest** signed IOU and
submits it once at settlement. The chain is touched exactly twice per channel:
open and close.

### IOU byte format (canonical — the SDK must reproduce this exactly)

The agent signs **exactly these 40 bytes** with their Ed25519 keypair:

```
message = channel_id (32 bytes) || cumulative_amount (u64, little-endian, 8 bytes)
```

- `channel_id` — the 32-byte channel id, byte-for-byte as stored on-chain.
- `cumulative_amount` — the **running total** owed to the provider, in atomic
  USDC units, encoded little-endian as a `u64`.

There is no domain separator, length prefix, or trailing padding. Reference
encoder (matches `tests/escrow.ts`):

```ts
import nacl from "tweetnacl";
import { BN } from "@coral-xyz/anchor";

function signIou(agentSecretKey: Uint8Array, channelId: Buffer, cumulative: BN): Uint8Array {
  const message = Buffer.concat([
    channelId,                          // 32 bytes
    cumulative.toArrayLike(Buffer, "le", 8), // u64 LE, 8 bytes
  ]);
  return nacl.sign.detached(message, agentSecretKey);
}
```

`settle` reconstructs these bytes from on-chain state plus the submitted amount
and verifies the signature against `channel.agent` using **`brine-ed25519`**'s
runtime curve25519 verification.

### Why runtime verification (not the native Ed25519 precompile)?

The cumulative amount is **dynamic** — it isn't known when the settlement
transaction is built by anyone except the gateway, and the native Ed25519
precompile only verifies data hardcoded into the transaction via
instruction-introspection. Using the precompile safely would require:

1. asserting the instructions-sysvar account is the **real** sysvar,
2. validating the Ed25519 instruction's offsets point at the expected
   signature / pubkey / message, and
3. confirming the signed message equals the reconstructed IOU bytes.

Skipping any of these is exactly how **Wormhole** and **Relay** were exploited.
`brine-ed25519` performs the curve check inside the program over bytes we
control, sidestepping that entire class of introspection bugs.

---

## Instruction reference — `escrow`

### `open_channel(channel_id, deposit_amount, provider, gateway, timeout_seconds)`

Creates the `Channel` PDA and its vault ATA, and moves `deposit_amount` USDC
from the agent into the vault.

- **Signer:** `agent` (also rent payer).
- **Validation:** `deposit_amount > 0`; `1 <= timeout_seconds <= 604800` (7 days).
- **PDA seeds:** `["channel", agent, channel_id]`.

| Account                   | Notes                                            |
| ------------------------- | ------------------------------------------------ |
| `agent` (signer, mut)     | Channel owner; signs IOUs off-chain.             |
| `channel` (init)          | `Channel` PDA.                                    |
| `usdc_mint`               | The USDC mint.                                    |
| `agent_token_account`     | Agent ATA (mint + owner pinned).                 |
| `vault` (init)            | ATA owned by the `channel` PDA.                  |
| `associated_token_program`, `token_program`, `system_program` | |

### `settle(cumulative_amount, signature: [u8; 64])`

Verifies the IOU signature, pays the provider `cumulative_amount`, refunds the
remainder to the agent, then closes the vault and channel (rent → agent).

- **Signer:** `gateway` (must equal `channel.gateway`, enforced by `has_one`).
- **Checks:** not already settled; `cumulative_amount <= deposit_amount`;
  signature valid over `channel_id || cumulative_amount` against `channel.agent`.
- **Math:** `refund = deposit_amount - cumulative_amount` (checked).

| Account                   | Notes                                            |
| ------------------------- | ------------------------------------------------ |
| `gateway` (signer)        | Settlement authority + payer for any new ATAs.   |
| `channel` (mut, close=agent) | `has_one = gateway`, `has_one = provider`.     |
| `agent` (mut)             | Pinned to `channel.agent`; receives rent+refund. |
| `provider`                | Pinned by `has_one = provider`.                  |
| `usdc_mint`, `vault` (mut)| Vault is the channel PDA's ATA.                  |
| `provider_token_account`  | Provider ATA (`init_if_needed`).                 |
| `agent_token_account`     | Agent ATA (`init_if_needed`).                    |
| token / ATA / system programs |                                              |

### `claim_refund()`

Crash safety: returns the **full** vault balance to the agent and closes the
channel once the timeout has elapsed with no settlement.

- **Signer:** `agent` (`has_one = agent`).
- **Checks:** `settled == false`; `now >= created_at + timeout_seconds` (checked add).

| Account               | Notes                                  |
| --------------------- | -------------------------------------- |
| `agent` (signer, mut) | Channel owner; receives funds + rent.  |
| `channel` (mut, close=agent) | `has_one = agent`.              |
| `usdc_mint`, `vault` (mut), `agent_token_account` (`init_if_needed`) | |
| token / ATA / system programs |                                |

---

## Instruction reference — `registry`

`ApiProvider` PDA seeds: `["provider", owner, name_bytes]`. `name` ≤ 50 bytes.
`category` ∈ {Weather=0, Mapping=1, Network=2, Compute=3, Agent=4};
`agent_type` ∈ {Api=0, Agent=1, Depin=2}.

| Instruction | Signer | Effect |
| ----------- | ------ | ------ |
| `register_provider(name, endpoint_hash, price_usdc, category, agent_type, provider_wallet, gateway_authority)` | anyone (pays rent → owner) | Creates the provider PDA. Validates non-empty name ≤ 50 bytes, `price > 0`, category/agent_type in range. |
| `update_provider(new_price: Option<u64>, active: Option<bool>)` | owner | Updates price (must stay `> 0`) and/or the `active` flag; `None` leaves a field untouched. |
| `increment_call_count()` | `gateway_authority` | Checked `+1` on `total_calls`. Restricted to the authority recorded at registration. |
| `deregister_provider()` | owner | Closes the PDA, reclaims rent. |

> `gateway_authority` is an addition to the original spec: usage metering must be
> restricted to a designated authority, so it's recorded per-provider rather than
> being globally hard-coded.

---

## Security assumptions & guarantees

**Enforced on-chain:**

- **Signature authenticity** — settlement only releases funds against a valid
  Ed25519 signature by `channel.agent` over the exact IOU bytes (runtime verify).
- **No overdraw** — `cumulative_amount <= deposit_amount`, checked subtraction
  for the refund; the vault can never be drained beyond what was deposited.
- **Single settle** — `settled` guard plus `close = agent`: a channel is paid
  out and closed exactly once. A replayed settle hits a non-existent account.
- **Authorization** — `settle` requires the recorded `gateway`; `claim_refund`
  requires the `agent`; registry mutations require the `owner`; metering requires
  the `gateway_authority`. All enforced via `has_one` / seed derivation / explicit
  constraints with custom `#[error_code]` errors (no generic panics).
- **Token-account integrity** — every token account's mint and owner are pinned
  via `associated_token::{mint, authority}` constraints; the vault is authored by
  the channel PDA, which signs transfers via seeds.
- **Checked math** everywhere; `overflow-checks = true` in the release profile.

**Trusted / out of scope (MVP tradeoffs):**

- **The gateway is trusted to submit the *latest* IOU.** Because IOUs are
  cumulative, a malicious gateway can only submit an *older* (smaller) IOU, which
  underpays the provider — it can never overpay or steal the deposit. Providers
  rely on the gateway's honesty for full payment; the agent's funds are always
  safe via `claim_refund`.
- **`timeout_seconds` is only floor/ceiling validated on-chain.** A too-short
  timeout would let the agent refund before the gateway can settle; the gateway
  is expected to refuse channels whose timeout isn't comfortably larger than its
  settlement latency.
- **No partial/incremental settlement, no channel top-up, no dispute window.** A
  channel is open-once, settle-once.
- **`endpoint_hash` is unverified** — the registry stores a `keccak256(url)`
  commitment but does not prove the URL.

> ⚠️ **A full third-party on-chain audit is required before mainnet.** These
> contracts are an MVP and have not been audited.

---

## Test coverage

`tests/escrow.ts`

- Happy path: 10 USDC deposit, 2 USDC IOU → 2 to provider, 8 refunded, channel closed.
- Multiple IOUs (0.02 / 0.05 / 2.00 cumulative); settle the last only.
- Forged signature (wrong keypair) → rejected.
- Tampered amount (settle ≠ signed amount) → rejected.
- Overdraw (`cumulative > deposit`) → rejected.
- Double settle → second rejected.
- Refund after timeout → agent recovers the full deposit.
- Refund before timeout → rejected.
- Refund after settle → rejected.

`tests/registry.ts`

- Register → all fields persisted; zero price rejected.
- Update price + deactivate as owner; non-owner update rejected.
- Increment call count as gateway authority; random signer rejected.
- Deregister as owner closes the account; non-owner rejected.
