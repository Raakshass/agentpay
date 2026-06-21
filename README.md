# Conduit

**Stablecoin payment rails for autonomous AI agents — pay-per-call API access over Solana state channels.**

Conduit lets an AI agent consume paid Web3 / DePIN APIs and settle in USDC **per request**, without a credit card, a subscription, or an on-chain transaction on every call. The agent deposits USDC once, streams thousands of cryptographically-signed micro-payments ("IOUs") off-chain at HTTP speed, and the gateway settles the final balance on-chain in a single transaction.

> Think **x402 / Lightning for AI agents**, built on Solana with USDC.

---

## Why this matters

The agent economy needs a way for software to pay software. Today an autonomous agent that wants live weather data, a token price, or an RPC call has bad options:

| Approach | Problem |
|---|---|
| API keys + monthly invoices | Requires a human, a billing relationship, and trust in both directions |
| On-chain transaction per call | ~400ms latency and a fee on *every* request — unusable for high-frequency agents |
| Prepaid credits on a centralized platform | Custodial, walled-garden, no settlement guarantees |

Conduit solves this with **state channels**: one on-chain deposit, unlimited off-chain signed payments, one on-chain settlement. The agent pays exactly for what it uses, the provider is guaranteed payment by a signature it can redeem on-chain, and neither side has to trust the other.

---

## How it works

```
   ┌─────────┐   1. open_channel (deposit USDC)    ┌──────────────────┐
   │         │ ──────────────────────────────────► │  Escrow Program  │
   │  Agent  │                                      │   (Solana PDA)   │
   │  (SDK)  │   4. settle (final IOU + signature)  │  holds USDC in   │
   │         │ ◄──────────────────  ┌────────────┐  │  a vault ATA     │
   └────┬────┘                      │            │  └──────────────────┘
        │                           │  Gateway   │ ───────────┘ submits
        │ 2. signed IOU per request │  (Express) │   settlement, splits funds:
        │    X-SESSION / X-IOU /    │            │   usage → provider
        └─────────X-SIGNATURE────►  │  verifies  │   remainder → agent (refund)
                                     │  + proxies │
            3. upstream API data ◄── │  to API    │ ──► Weather / Helius / Birdeye
                                     └────────────┘
```

**The lifecycle (4 steps):**

1. **DEPOSIT** — Agent calls `open_channel` on the escrow program, locking USDC in a per-channel vault. Seeds: `["channel", agent, channel_id]`.
2. **USE** — For each API call the agent signs an **IOU** (`channel_id ‖ cumulative_amount`) with its ed25519 key and sends it in HTTP headers. The gateway verifies the signature, checks the cumulative total never exceeds the deposit, proxies the upstream API, and keeps the highest-value IOU. **No on-chain activity.**
3. **SETTLE** — On close, the gateway submits the final IOU + signature to the escrow program's `settle` instruction. The contract re-verifies the signature on-chain (via `brine-ed25519`), pays the provider the cumulative amount, refunds the remainder to the agent, and closes the vault.
4. **REFUND (crash safety)** — If the gateway disappears, the agent reclaims 100% of the deposit via `claim_refund` after the channel timeout. **Funds are never at risk.**

### Security model

- **On-chain Ed25519 verification via `brine-ed25519`**, *not* the native precompile — this avoids the instruction-introspection attack class behind the Wormhole / Relay precompile exploits.
- **Monotonic IOUs** — the gateway only accepts a strictly increasing cumulative amount, preventing replay of stale IOUs.
- **Overdraw protection** — both the gateway and the contract reject any IOU whose cumulative amount exceeds the deposit.
- **Byte-exact message format** across all three layers (SDK signer, gateway verifier, on-chain contract) so a signature produced off-chain always verifies on-chain. See [`packages/sdk/README.md`](packages/sdk/README.md#the-iou-message-format).
- **Trustless exit** — the timeout refund means the agent never has to trust the gateway to stay online.

---

## Repository layout

This is a pnpm monorepo.

| Package | Description |
|---|---|
| [`packages/sdk`](packages/sdk) | **`@conduit/sdk`** — TypeScript SDK agents use to open sessions, sign IOUs, and call APIs. [Usage guide →](packages/sdk/README.md) |
| [`packages/gateway`](packages/gateway) | **`@conduit/gateway`** — Express server: service catalog, session manager, IOU verification, upstream proxy, on-chain settlement. |
| [`packages/web`](packages/web) | Next.js frontend — landing page, provider catalog, provider dashboard, live demo. |
| [`programs/conduit-contracts`](programs/conduit-contracts) | Anchor workspace: `escrow` (state channel) + `registry` (provider catalog). [Contract spec →](programs/conduit-contracts/README.md) |
| [`agents`](agents) | Example agent (`weather-agent.ts`) demonstrating the full flow end-to-end. |

### Deployed programs (Solana devnet)

| Program | Address |
|---|---|
| Escrow (state channel) | `8vH1iEpbwe31WGqSGd9a8qkKh7SCHW8MsaSULVsxskRw` |
| Registry (provider catalog) | `XGXadfKb7mru5wcr1yUZWSeBLVUY6NFDAriBUUMiLbk` |

---

## Quickstart

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)

### 1. Install

```bash
git clone https://github.com/Raakshass/agentpay.git
cd agentpay
pnpm install
```

### 2. Configure

```bash
cp .env.example .env
# Fill in: HELIUS_RPC_URL, GATEWAY_WALLET_PRIVATE_KEY, OPENWEATHERMAP_API_KEY, etc.
# The deployed program IDs are already set in .env.example.
```

### 3. Run the gateway

```bash
pnpm dev:gateway
# Conduit Gateway running on http://0.0.0.0:4020
```

Verify it's up:

```bash
curl http://localhost:4020/health
curl http://localhost:4020/catalog
```

### 4. Run the example agent

```bash
pnpm --filter agents run demo
```

This discovers services, opens a session, fetches weather for five cities (signing an IOU each time), and closes the session — printing the usage and settlement summary.

---

## Gateway API

Discovery and session endpoints are public; the `/api/*` data routes require a valid session.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Liveness + active session count |
| `GET` | `/catalog` | — | List services, prices (atomic USDC), and endpoints |
| `POST` | `/session/open` | — | Register a session after an on-chain deposit |
| `POST` | `/session/close` | — | Settle the final IOU on-chain and close the session |
| `GET` | `/api/depin-weather/:city` | Session | DePIN weather data (`0.001 USDC`/req) |
| `GET` | `/api/helius-token-balances/:address` | Session | SPL token balances (`0.002 USDC`/req) |
| `GET` | `/api/birdeye-token-price/:mint` | Session | Token price across Solana DEXes (`0.001 USDC`/req) |

Session-gated routes require three headers, all produced automatically by the SDK:

- `X-SESSION` — Base58 channel PDA (session lookup key)
- `X-IOU` — JSON IOU `{ session, cumulative_usdc, request_count, timestamp }`
- `X-SIGNATURE` — Base64 ed25519 signature over the canonical IOU bytes

---

## Using the SDK

```typescript
import { ConduitSession, fetchCatalog } from "@conduit/sdk";

// 1. Discover services
const catalog = await fetchCatalog("http://localhost:4020");

// 2. Open a session (after depositing USDC on-chain via open_channel)
const session = await ConduitSession.open({
  gatewayUrl: "http://localhost:4020",
  sessionPda: "<base58 channel PDA>",
  channelId: "<base58 32-byte channel_id>",
  agentPrivateKey: secretKey,        // 32-byte ed25519 seed
  agentPublicKey: "<base58 pubkey>",
  providerPublicKey: "<base58 provider>",
  depositAmountAtomic: 10_000_000,   // 10 USDC
});

// 3. Call paid APIs — IOUs are signed and attached automatically
const weather = await session.fetch("/api/depin-weather/london", 1000);

// 4. Close — triggers on-chain settlement
const result = await session.close();
console.log(result.usage, result.settlement);
```

Full API reference, the IOU byte format, and error handling: **[`packages/sdk/README.md`](packages/sdk/README.md)**.

---

## Development

```bash
pnpm build       # build sdk, gateway, web
pnpm typecheck   # type-check all packages
pnpm test        # run unit tests
pnpm dev:gateway # run the gateway in watch mode
```

The Anchor programs are built and deployed from the Solana toolchain (see [`programs/conduit-contracts/README.md`](programs/conduit-contracts/README.md)), not via `pnpm`.

---

## Roadmap

- [x] Escrow state-channel program (deposit / settle / refund) — deployed to devnet
- [x] On-chain provider registry — deployed to devnet
- [x] Gateway with IOU verification + on-chain settlement
- [x] TypeScript SDK with automatic IOU signing
- [x] Web frontend (catalog, provider dashboard, live demo)
- [ ] Eager on-chain deposit verification at `/session/open` (currently lazy/MVP)
- [ ] Redis-backed session persistence for gateway restarts
- [ ] Mainnet deployment with production USDC mint
- [ ] Multi-provider routing and dynamic registry-driven pricing

---

## License

MIT
