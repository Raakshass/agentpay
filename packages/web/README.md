# @agentpay/web

The AgentPay marketing site + dApp — a dark, monochromatic frontend for the
permissionless agent payment protocol on Solana. Built with Next.js 16 (App
Router), Tailwind v4, Framer Motion, and the Solana wallet adapter.

## Pages

| Route        | What it does |
|--------------|--------------|
| `/`          | Landing page — hero, problem, how-it-works, stats, CTA |
| `/catalog`   | Browse on-chain providers (search + filter), detail drawer |
| `/providers` | Wallet-gated dashboard — register, edit price, toggle active, deregister |
| `/demo`      | Live payment visualization (simulated by default) |

## Running locally

Requires Node 18+ and `pnpm`. From the **repo root** (the package is part of the
pnpm workspace):

```bash
pnpm install
cp packages/web/.env.example packages/web/.env.local   # then edit if needed
pnpm --filter @agentpay/web dev
```

Open http://localhost:3000.

> **No contracts required to explore.** If the registry program isn't deployed
> (or is empty) on the configured cluster, the catalog and stats fall back to
> clearly-labeled demo data, and the live demo runs in simulated mode. Connect a
> wallet and use the provider dashboard to send real transactions once the
> programs are deployed.

## Configuration

All config lives in [`src/lib/config.ts`](src/lib/config.ts), driven by the
`NEXT_PUBLIC_*` env vars documented in [`.env.example`](.env.example):

- `NEXT_PUBLIC_SOLANA_NETWORK` / `NEXT_PUBLIC_RPC_URL` — cluster + RPC
- `NEXT_PUBLIC_REGISTRY_PROGRAM_ID` / `NEXT_PUBLIC_ESCROW_PROGRAM_ID` — programs
- `NEXT_PUBLIC_USDC_MINT` — pricing/settlement mint
- `NEXT_PUBLIC_GATEWAY_URL` — gateway HTTP base (used in catalog snippets)
- `NEXT_PUBLIC_GATEWAY_WS_URL` — optional; live demo streams real events when set

## How on-chain data works

There's no generated IDL in this package, so
[`src/lib/registry-client.ts`](src/lib/registry-client.ts) reads `ApiProvider`
accounts straight from the RPC (manual borsh decode matching
`programs/registry/src/lib.rs`) and builds `register` / `update` / `deregister`
instructions by hand. Writes are signed through the connected wallet.

## Scripts

```bash
pnpm --filter @agentpay/web dev      # dev server (Turbopack)
pnpm --filter @agentpay/web build    # production build
pnpm --filter @agentpay/web start    # serve the production build
pnpm --filter @agentpay/web lint     # ESLint
```

## Deploy (Vercel)

Set the project root to `packages/web`, add the `NEXT_PUBLIC_*` env vars, and
deploy. The default build command (`next build`) works as-is.
