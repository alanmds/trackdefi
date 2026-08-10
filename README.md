# trackdefi

**Live at [trackdefi.app](https://trackdefi.app) — free, no login, no wallet connection.**

Paste any wallet address and see all of its liquidity-pool positions across
ten networks, including the gauge-staked ones that most trackers miss.
Read-only: trackdefi never asks for private keys or seed phrases, and cannot
move funds.

[![trackdefi — liquidity pool tracker](https://trackdefi.app/opengraph-image)](https://trackdefi.app)

## Why it exists

Three things were missing from the trackers we tried:

- **Staked positions disappear.** Once you stake an LP position in a gauge, the
  NFT leaves your wallet and most trackers stop seeing it. trackdefi reads the
  gauge too, so a staked position looks exactly like an unstaked one.
- **APR is usually a lie for your position.** Pool APR is an average. What a
  *concentrated* position actually earns depends on its range — and a position
  sitting out of range earns nothing in fees, no matter what the pool's number
  says. trackdefi computes the APR of the position, and shows `0%` when that is
  the truth.
- **You shouldn't have to connect a wallet to look at public data.** LP
  positions are on-chain and public. Reading them needs an address, not a
  signature.

When a token has no reliable price, trackdefi shows `—` instead of guessing.

## Coverage

| Exchange | Networks |
|---|---|
| Aerodrome | Base |
| Velodrome | Optimism, Unichain, Ink, Mode, Soneium, Fraxtal |
| Uniswap v3 | Base, Ethereum, Arbitrum, Optimism, Robinhood Chain |

Classic (v2-style) and concentrated positions, staked or not, with pending fees
and emissions. The [roadmap](https://trackdefi.app/roadmap) tracks what's next;
[how it works](https://trackdefi.app/how-it-works) explains where every number
comes from.

## Stack

- **Next.js (App Router) + TypeScript** — site + API
- **viem** — read-only on-chain access (Sugar contracts for the Aerodrome/
  Velodrome family; the NonfungiblePositionManager for Uniswap v3)
- **DefiLlama** — USD prices and pool yield data (free, no key)
- **Vercel** — hosting; **Vercel Analytics** — cookieless usage stats

## Architecture

Protocol-specific code lives behind one interface (`core/types.ts` →
`ProtocolAdapter`). Adding a network or exchange means writing an adapter and
registering it in `core/adapters/registry.ts` — the API, the price layer and the
UI don't change.

Money is handled as `BigInt` throughout the core; floats appear only at the
display edge.

```
core/            pure engine, testable without a UI
  types.ts       LpPosition + ProtocolAdapter interface
  chain.ts       per-network viem readers (RPC from env or public endpoints)
  service.ts     adapters + prices -> JSON DTO (USD computed server-side)
  guards.ts      TTL cache, rate limiter, concurrency semaphore
  math/          Q96 concentrated-liquidity math (BigInt)
  prices/        DefiLlama price client
  yields/        position-level APR ("what is this position earning now")
  adapters/      aerodrome/ (Sugar family) · uniswap-v3/ · registry.ts
app/             Next.js site + /api/positions
  w/[address]/   wallet results page
  how-it-works/  trust / safety page
  roadmap/       what's live and what's next
tests/           unit tests with frozen real-wallet fixtures
poc/             CLI + validation scripts (see below)
```

## Develop

```bash
npm install
npm run dev
```

Dev mode is slow for full scans — use a production build to measure real speed:

```bash
npm run build && npm run start
```

Scripts:

| Command | What it does |
|---|---|
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run poc -- 0x…` | print a wallet's positions from the terminal |
| `npm run check-api` | hit the API handler against the live chain |
| `npx tsx poc/validate-batch.ts` | full validation battery (run before releases) |
| `npx tsx poc/validate-live.ts https://trackdefi.app` | validate a deployed site over HTTP |
| `npx tsx poc/find-wallets.ts` | find active LP wallets from recent events |
| `npx tsx poc/check-outage.ts` | verify a dead RPC returns a clean 502 |

## Environment

Copy `.env.example`. All variables are optional:

- `NEXT_PUBLIC_SITE_URL` — canonical origin used for metadata, canonicals and
  the sitemap. Defaults to `https://trackdefi.app`.
- `BASE_RPC_URLS` — comma-separated RPC URLs (e.g. an Alchemy key) to speed up
  scans. Server-side only, never exposed to the browser. Falls back to public
  RPCs.
- `TRACKDEFI_FIXTURE` — **dev only**; serve a frozen DTO instead of reading the
  chain. Ignored on Vercel.

## Deploy

See [DEPLOY.md](DEPLOY.md) for the step-by-step (GitHub + Vercel, free tier).

## Notes

- Pin TypeScript to 5.x — TS 7 (the native port) breaks Next 16's TS integration.
- Not financial advice. Verify data on-chain before acting. Data can lag the
  chain by up to a minute.
