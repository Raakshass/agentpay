# @agentpay/sdk

TypeScript SDK for AI agents to consume paid Web3 / DePIN APIs over [AgentPay](../../README.md) state channels.

The SDK handles the hard parts of the payment protocol for you:

- **Session lifecycle** — open, use, close.
- **Automatic IOU signing** — every API call is paid for with a fresh, cryptographically-signed IOU.
- **Canonical serialization** — produces the exact bytes the gateway and the on-chain escrow contract verify against, so a signature made here always settles on-chain.
- **Balance tracking** — refuses to overspend the deposit before a request ever leaves your machine.

> One on-chain deposit → thousands of off-chain signed payments → one on-chain settlement.

---

## Installation

Inside the monorepo it's a workspace dependency:

```json
{ "dependencies": { "@agentpay/sdk": "workspace:*" } }
```

Standalone:

```bash
pnpm add @agentpay/sdk
```

The only runtime dependency is [`@noble/ed25519`](https://github.com/paulmillr/noble-ed25519). Requires an environment with `fetch`, `btoa`, and `TextEncoder` (Node ≥ 20 or any modern browser).

---

## Quick start

```typescript
import { AgentPaySession, fetchCatalog } from "@agentpay/sdk";

const GATEWAY = "http://localhost:4020";

// 1. Discover what's available (no session needed)
const catalog = await fetchCatalog(GATEWAY);
for (const s of catalog.services) {
  console.log(s.serviceId, s.pricing.perRequestAtomic, "atomic USDC/req");
}

// 2. Open a session.
//    Prerequisite: you have already deposited USDC on-chain by calling the
//    escrow program's `open_channel` with this same `channelId`.
const session = await AgentPaySession.open({
  gatewayUrl: GATEWAY,
  sessionPda: "<base58 channel PDA>",     // session lookup key
  channelId: channelIdBytes,              // raw 32-byte Uint8Array OR base58 string
  agentPrivateKey: agentSecretKey,        // 32-byte ed25519 seed
  agentPublicKey: "<base58 agent pubkey>",
  providerPublicKey: "<base58 provider>", // receives settled funds
  depositAmountAtomic: 10_000_000,        // 10 USDC (6 decimals)
});

// 3. Call paid APIs. The IOU is built, signed, and attached for you.
const london = await session.fetch("/api/depin-weather/london", 1000);
const tokyo  = await session.fetch("/api/depin-weather/tokyo", 1000);

console.log("Remaining:", session.getRemainingBalance(), "atomic USDC");

// 4. Close — the gateway settles the final IOU on-chain.
const result = await session.close();
console.log(result.usage);       // requests made, USDC used, refund amount
console.log(result.settlement);  // { isSuccess, transactionSignature, reason? }
```

---

## API reference

### `AgentPaySession`

The main client. Manages one state-channel session.

#### `AgentPaySession.open(params): Promise<AgentPaySession>`

Registers a session with the gateway. Call this **after** your on-chain `open_channel` deposit has confirmed.

```typescript
interface OpenSessionParams {
  gatewayUrl: string;            // e.g. "http://localhost:4020"
  sessionPda: string;           // base58 channel PDA — the gateway's lookup key
  channelId: Uint8Array | string; // raw 32 bytes, or its base58 encoding
  agentPrivateKey: Uint8Array;  // 32-byte ed25519 seed (signs IOUs)
  agentPublicKey: string;       // base58 agent public key
  providerPublicKey: string;    // base58 provider (settlement recipient)
  depositAmountAtomic: number;  // USDC deposited, atomic units (1 USDC = 1_000_000)
}
```

> **`channelId` vs `sessionPda`** — these are different values and both are required.
> `channelId` is the raw 32-byte identifier you chose when calling `open_channel`; it is what the IOU signature is computed over and what the contract verifies. `sessionPda` is the program-derived address (`["channel", agent, channel_id]`) and is only used as the gateway's session lookup key. Don't swap them.

#### `session.fetch(endpoint, servicePriceAtomic): Promise<unknown>`

Makes a paid API request through the gateway.

- Checks the price against your remaining balance and throws **before** sending if you'd overspend.
- Builds the next IOU (`cumulative += servicePriceAtomic`), signs it, and attaches `X-SESSION`, `X-IOU`, `X-SIGNATURE` headers.
- On success, advances local usage/request counters and returns the upstream JSON.

```typescript
const data = await session.fetch("/api/depin-weather/berlin", 1000);
```

`servicePriceAtomic` should match the catalog price for that endpoint (`pricing.perRequestAtomic`).

#### `session.close(): Promise<CloseSessionResponse>`

Closes the session and asks the gateway to settle the final IOU on-chain.

```typescript
interface CloseSessionResponse {
  status: "closed";
  sessionPda: string;
  usage: {
    totalRequestsMade: number;
    totalUsdcUsedAtomic: number;
    depositAmountAtomic: number;
    refundAmountAtomic: number;
  };
  settlement: {
    isSuccess: boolean;
    transactionSignature: string | null; // null if there was no usage to settle
    reason?: string;
  };
}
```

If the agent made **zero** calls, there's nothing to settle on-chain — reclaim the full deposit with the contract's `claim_refund` after the timeout.

#### `session.getState(): Readonly<SessionState>`

Returns a snapshot: `sessionPda`, `channelId`, `agentPublicKey`, `providerPublicKey`, `depositAmountAtomic`, `currentUsageAtomic`, `requestCount`, `isActive`.

#### `session.getRemainingBalance(): number`

`depositAmountAtomic - currentUsageAtomic`, in atomic USDC.

---

### Catalog helpers

#### `fetchCatalog(gatewayUrl): Promise<CatalogResponse>`

Fetches the full service catalog (no session required).

#### `findService(gatewayUrl, serviceId): Promise<CatalogService | null>`

Convenience lookup for a single service by id (e.g. `"depin-weather"`). Returns `null` if absent.

```typescript
const weather = await findService(GATEWAY, "depin-weather");
if (weather) {
  await session.fetch(weather.endpoint, weather.pricing.perRequestAtomic);
}
```

---

### Low-level IOU primitives

You normally never call these — `session.fetch()` uses them internally — but they're exported for custom integrations and for verifying byte-compatibility with the gateway/contract.

#### `buildNextIou(channelId, currentUsageAtomic, currentRequestCount, servicePriceAtomic): IouMessage`

Builds the next IOU. **`channelId` is the base58 32-byte channel id, not the PDA.**

#### `serializeIou(iou: IouMessage): Uint8Array`

Produces the canonical 40-byte message that gets signed (see format below).

#### `signIou(iou, agentPrivateKey): Promise<Uint8Array>`

Serializes and signs an IOU, returning the raw 64-byte ed25519 signature.

#### `bytesToBase58(bytes): string`

Encodes raw bytes (e.g. a 32-byte `channel_id`) to Solana-style base58.

---

## The IOU message format

This is the contract between the SDK, the gateway, and the on-chain program. All three serialize an IOU to the **exact same 40 bytes**:

```
┌────────────────────────────┬──────────────────────────────┐
│ channel_id (32 bytes)      │ cumulative_amount (u64, LE)   │
│ big-endian decode of the   │ 8 bytes, little-endian        │
│ base58 channel id          │                               │
└────────────────────────────┴──────────────────────────────┘
                          40 bytes total
```

- The agent signs these 40 bytes with its ed25519 key.
- The gateway re-serializes and verifies with `@noble/ed25519`.
- The escrow program re-serializes and verifies on-chain with `brine-ed25519` against `channel.agent`.

`request_count` and `timestamp` travel in the JSON IOU for off-chain bookkeeping but are **deliberately excluded** from the signed bytes — the contract neither stores nor verifies them.

This byte-exactness is why a signature produced in the browser settles successfully on Solana. Don't change the field order, widths, or endianness in one layer without changing all three.

---

## Error handling

```typescript
try {
  await session.fetch("/api/depin-weather/london", 1000);
} catch (err) {
  // Thrown locally before sending if price > remaining balance, or
  // re-thrown from the gateway response (e.g. INSUFFICIENT_BALANCE,
  // INVALID_SIGNATURE, SESSION_NOT_FOUND).
  console.error(err.message);
}
```

Common cases:

| Situation | Where it's caught | Message / code |
|---|---|---|
| Request would exceed deposit | Locally, before sending | `Insufficient session balance...` |
| Cumulative > deposit | Gateway → 402 | `INSUFFICIENT_BALANCE` |
| Bad/forged signature | Gateway → 401 | `INVALID_SIGNATURE` |
| Session expired/closed | Gateway → 404 | `SESSION_NOT_FOUND` |
| `fetch()` after `close()` | Locally | `Session is closed.` |

---

## Full example

A complete, runnable agent lives at [`agents/src/weather-agent.ts`](../../agents/src/weather-agent.ts). Run it with:

```bash
pnpm --filter agents run demo
```

---

## License

MIT
