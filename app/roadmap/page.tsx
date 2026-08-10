import type { Metadata } from "next";
import Link from "next/link";
import { NETWORK_COUNT, pageMetadata } from "../site";

export const metadata: Metadata = pageMetadata({
  path: "/roadmap",
  title: "Roadmap — networks & exchanges",
  /* o número de redes vem de NETWORK_COUNT: escrito à mão, ficou preso em
     "4 networks" e foi assim para o ar depois da Robinhood Chain. */
  description: `Where trackdefi is today and where it's going: per-position APR, Aerodrome, Velodrome and Uniswap v3 across ${NETWORK_COUNT} networks; Uniswap v4, pool age and P&L planned.`,
});

function Status({ kind }: { kind: "live" | "next" | "planned" | "exploring" }) {
  const map = {
    live: { className: "badge badge-good", label: "✓ Live" },
    next: { className: "badge badge-warn", label: "→ Next" },
    planned: { className: "badge", label: "Planned" },
    exploring: { className: "badge", label: "Exploring" },
  } as const;
  const s = map[kind];
  return <span className={s.className}>{s.label}</span>;
}

export default function Roadmap() {
  return (
    <main className="container prose">
      <h1>Roadmap</h1>
      <p className="prose-lede">
        Where trackdefi is today and where it&apos;s going. No dates and no promises — priorities follow what users
        actually ask for. One thing never changes: <strong>read-only, forever</strong>.
      </p>

      <h2>Live today</h2>
      <ul className="roadmap-list">
        <li>
          <Status kind="live" />
          <span>
            <strong>Per-position APR — &ldquo;Earning now&rdquo;</strong> — what <em>your</em> position earns right
            now, not the pool average: swap fees and emissions counted separately, and an honest 0% when a
            concentrated position is out of range and earning nothing.
          </span>
        </li>
        <li>
          <Status kind="live" />
          <span>
            <strong>Base · Aerodrome</strong> — classic and concentrated (Slipstream) positions, including
            gauge-staked ones, with pending fees and AERO emissions.
          </span>
        </li>
        <li>
          <Status kind="live" />
          <span>
            <strong>Base · Uniswap v3</strong> — concentrated positions with pending fees, read straight from the
            blockchain.
          </span>
        </li>
        <li>
          <Status kind="live" />
          <span>
            <strong>Optimism · Velodrome</strong>
            {" — "}Aerodrome&apos;s sister exchange: staked positions and VELO emissions included. Our first extra
            network.
          </span>
        </li>
        <li>
          <Status kind="live" />
          <span>
            <strong>Ethereum, Arbitrum &amp; Optimism · Uniswap v3</strong> — the Base integration, now across the
            major networks.
          </span>
        </li>
        <li>
          <Status kind="live" />
          <span>
            {/* o texto vai entre chaves de propósito: solto, o JSX come o espaço
                antes do travessão quando o trecho contém entidade HTML — foi
                assim que "Uniswap v3— the tokenized-stock" foi parar no ar. */}
            <strong>Robinhood Chain · Uniswap v3</strong>
            {" — the tokenized-stock L2, live since July 2026 and already one of the largest Uniswap v3 deployments by liquidity. Positions, amounts, pending fees and range status all work; pool APR shows “—” until public yield data covers this network."}
          </span>
        </li>
        <li>
          <Status kind="live" />
          <span>
            <strong>Unichain, Ink, Mode, Soneium &amp; Fraxtal · Velodrome</strong>
            {" — Velodrome's Superchain deployment. Five networks in one step, because they share the same architecture we already read: staked positions and pending XVELO emissions included. Emission "}
            <em>values</em>
            {" show “—” while public price data doesn't cover XVELO — the amounts are exact either way."}
          </span>
        </li>
      </ul>

      <h2>Next</h2>
      <ul className="roadmap-list">
        <li>
          <Status kind="next" />
          <span>
            <strong>Uniswap v4</strong>
            {" — now the biggest gap in coverage: wallets already hold v4 positions on networks we support, and today they simply don't appear."}
          </span>
        </li>
      </ul>

      <h2>Planned</h2>
      <ul className="roadmap-list">
        <li>
          <Status kind="planned" />
          <span>
            <strong>More Superchain networks</strong>
            {" (Lisk, Swell, Metal L2, Superseed, Celo) — the tail of the same deployment, added the same way."}
          </span>
        </li>
        <li>
          <Status kind="planned" />
          <span>
            <strong>Every major DeFi network</strong> — the long-term goal: one address, every network, every
            position.
          </span>
        </li>
      </ul>

      <h2>Exploring</h2>
      <ul className="roadmap-list">
        <li>
          <Status kind="exploring" />
          <span>
            <strong>Historical performance</strong>
            {" — profit & loss and impermanent loss since each position was opened."}
          </span>
        </li>
        <li>
          <Status kind="exploring" />
          <span>
            <strong>Out-of-range alerts</strong> — get notified when a concentrated position stops earning fees.
          </span>
        </li>
        <li>
          <Status kind="exploring" />
          <span>
            <strong>Pool age</strong> — how long a pool has existed, shown next to its APR. A brand-new pool with a
            high APR is a different signal from an old one with the same number.
          </span>
        </li>
      </ul>

      <h2>What will never change</h2>
      <ul>
        <li>No login, no wallet connection, no private keys — trackdefi cannot touch funds.</li>
        <li>Honest numbers: when a token has no reliable price we show “—”, never a guess.</li>
        <li>Read straight from the blockchain, so what you see is the on-chain truth.</li>
      </ul>

      <p className="roadmap-updated">Last updated: August 2026.</p>

      <p className="prose-back">
        <Link href="/" className="btn">
          ← Back to search
        </Link>
      </p>
    </main>
  );
}
