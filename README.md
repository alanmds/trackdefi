# trackdefi

Public, read-only liquidity-pool position tracker. Paste any wallet address and
see all of its LP positions — including gauge-staked ones that most trackers
miss. No login, no wallet connection, no keys.

**Coverage:** Base network · Aerodrome exchange (more networks/exchanges by
design — see `core/adapters/`).

## Stack

- **Next.js (App Router) + TypeScript** — site + API
- **viem** — read-only on-chain access via Aerodrome's LP Sugar contract
- **DefiLlama** — USD prices (free, no key)
- **Vercel** — hosting; **Vercel Analytics** — cookieless usage stats

## Architecture

Protocol-specific code lives behind one interface (`core/types.ts` →
`ProtocolAdapter`). Adding a network/exchange = a new adapter; the API, prices,
and UI don't change.

```
core/            pure engine, testable without a UI
  types.ts       LpPosition + ProtocolAdapter interface
  chain.ts       shared viem reader (RPC from BASE_RPC_URLS or public)
  service.ts     adapter + prices -> JSON DTO (USD computed server-side)
  guards.ts      TTL cache, rate limiter, concurrency semaphore
  math/          Q96 concentrated-liquidity math (BigInt)
  prices/        DefiLlama client
  adapters/aerodrome/
app/             Next.js site + /api/positions
  w/[address]/   wallet results page
  how-it-works/  trust / safety page
tests/           unit tests with frozen real-wallet fixtures
poc/             CLI + validation scripts (see below)
```

## Develop

```bash
npm install
npm run dev            # http://localhost:3000  (dev mode is slow for scans)
npm run build && npm run start   # production — use this to check scan speed
```

Scripts:

| Command | What it does |
|---|---|
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run poc -- 0x…` | print a wallet's positions from the terminal |
| `npm run check-api` | hit the API handler against the live chain |
| `npx tsx poc/validate-batch.ts` | full validation battery (run before releases) |
| `npx tsx poc/find-wallets.ts` | find active LP wallets from recent events |
| `npx tsx poc/check-outage.ts` | verify a dead RPC returns a clean 502 |

## Environment

Copy `.env.example`. All variables are optional:

- `BASE_RPC_URLS` — comma-separated RPC URLs (e.g. an Alchemy key) to speed up
  scans. Server-side only; never exposed to the browser. Falls back to public RPCs.
- `TRACKDEFI_FIXTURE` — **dev only**; serve a frozen DTO instead of reading the
  chain. Ignored on Vercel.

## Deploy

See [DEPLOY.md](DEPLOY.md) for the step-by-step (GitHub + Vercel, free tier).

## Notes

- Pin TypeScript to 5.x — TS 7 (native port) breaks Next 16's TS integration.
- Not financial advice. Data can lag the chain by up to a minute.
