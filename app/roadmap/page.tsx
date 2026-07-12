import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Roadmap — networks & exchanges",
  description:
    "Where trackdefi is today and where it's going: Aerodrome, Uniswap v3 and Velodrome live now; Uniswap v3 on more networks next; Uniswap v4 and P&L tracking planned.",
  alternates: { canonical: "/roadmap" },
};

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
      </ul>

      <h2>Next</h2>
      <ul className="roadmap-list">
        <li>
          <Status kind="next" />
          <span>
            <strong>Uniswap v3 on Ethereum, Arbitrum and other major networks</strong> — the same integration that is
            live on Base, network by network.
          </span>
        </li>
      </ul>

      <h2>Planned</h2>
      <ul className="roadmap-list">
        <li>
          <Status kind="planned" />
          <span>
            <strong>Uniswap v4</strong>
            {
              " — the new singleton-and-hooks architecture. Positions and value reuse the engine we already have; reading fees reliably across custom hooks is the harder part, so it follows the v3 rollout."
            }
          </span>
        </li>
        <li>
          <Status kind="planned" />
          <span>
            <strong>More Superchain exchanges</strong>
            {" (Mode, Lisk, Ink and friends) — they share Aerodrome's architecture, so coverage grows fast."}
          </span>
        </li>
        <li>
          <Status kind="planned" />
          <span>
            <strong>The 10 biggest DeFi networks</strong> — the long-term goal: one address, every network, every
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
      </ul>

      <h2>What will never change</h2>
      <ul>
        <li>No login, no wallet connection, no private keys — trackdefi cannot touch funds.</li>
        <li>Honest numbers: when a token has no reliable price we show “—”, never a guess.</li>
        <li>Read straight from the blockchain, so what you see is the on-chain truth.</li>
      </ul>

      <p className="roadmap-updated">Last updated: July 2026.</p>

      <p className="prose-back">
        <Link href="/" className="btn">
          ← Back to search
        </Link>
      </p>
    </main>
  );
}
