# Changelog

All notable changes to the Conduit project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-09-03

### Added

#### API Routes
- **Jupiter DEX Swap Quote** (`/api/jupiter-quote/:in/:out/:amount`) — real-time swap quotes via Jupiter aggregator
- **Solana Network Stats** (`/api/solana-stats`) — live TPS, epoch progress, slot height
- **NFT Metadata** (`/api/nft-metadata/:mint`) — Metaplex DAS API for NFT/cNFT data
- **Top Token Holders** (`/api/token-holders/:mint`) — largest holders for any SPL token
- **Transaction History** (`/api/tx-history/:wallet`) — recent transactions with Explorer links
- All 5 routes include free `/preview/*` endpoints for the web playground

#### Infrastructure
- **Redis session persistence** — sessions survive gateway restarts (with in-memory fallback for dev)
- **On-chain deposit verification** — channel PDA checked on Solana before session registration
- **Rate limiting** — 60 req/min per IP (public), 300 req/min per session
- **Prometheus metrics endpoint** (`GET /metrics`) — request counters, duration histograms, session gauges, USDC throughput
- **Dynamic pricing** — reads provider prices from on-chain registry with 5-min cache + static fallback

#### SDK (`conduit-pay`)
- **Typed error hierarchy** — 8 error classes: `ConduitError`, `SessionError`, `InsufficientBalanceError`, `SignatureError`, `GatewayError`, `RateLimitError`, `SettlementError`, `DepositError`
- **Automatic retry** — exponential backoff with jitter for transient failures (`withRetry`, `isRetryableError`)
- **Usage summary** — `getUsageSummary()` returns human-readable session stats
- **`parseGatewayError()`** — converts gateway HTTP errors to typed SDK errors

#### Testing
- 41 unit tests across gateway and SDK
- Rate limiter tests (5)
- Service pricing validation tests (8)
- Session store CRUD + TTL tests (6)
- SDK error class tests (10)
- SDK retry utility tests (12)

### Security

- **Mint constraint on Settle** — `vault.mint == usdc_mint.key()` prevents fake-mint substitution
- **Mint constraint on ClaimRefund** — same fix applied to the refund path
- **Reentrancy defense** — `channel.settled = true` set BEFORE CPI transfers
- **Provider address check** — explicit `address = channel.provider` on `UncheckedAccount`
- **CPI account info** — fixed `.key()` → `.to_account_info()` in 6 CPI contexts
- **Request body limit** — 1MB max to prevent payload abuse

### Changed
- Session manager functions are now fully async (supports Redis + in-memory stores)
- Service pricing config expanded from 3 to 8 services with new categories (`network`, `nft`)

## [0.1.0] — 2026-06-01

### Added
- Initial escrow smart contract (open_channel, settle, claim_refund)
- Provider registry smart contract
- Gateway server with DePIN Weather, Helius Token Balances, and Birdeye Token Price routes
- Session management with IOU signing and verification
- Conduit SDK with session client, catalog client, and channel client
- Next.js web frontend with landing page, catalog, demo, and docs
