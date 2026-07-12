import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works & why it's safe",
  description:
    "How trackdefi reads your LP positions straight from the Base blockchain — no login, no wallet connection, no keys — and why it can never touch your funds.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorks() {
  return (
    <main className="container prose">
      <h1>How it works &amp; why it&apos;s safe</h1>

      <p className="prose-lede">
        trackdefi shows the liquidity pool positions of any wallet from just its public address. It is a read-only
        window into the blockchain — nothing more.
      </p>

      <h2>Why it&apos;s safe</h2>
      <ul>
        <li>
          <strong>We never ask for a private key or seed phrase.</strong> If any site ever asks you for those to “see
          your positions,” leave. They are never needed to read public data.
        </li>
        <li>
          <strong>No wallet connection.</strong> You paste an address; you don&apos;t connect a wallet. trackdefi has no
          permission to move, approve, or sign anything.
        </li>
        <li>
          <strong>Read-only by construction.</strong> The app only makes <em>read</em> calls to the blockchain. There is
          no code path that can send a transaction, because it never holds a key.
        </li>
        <li>
          <strong>Public data only.</strong> A wallet address is public. Anyone can already look it up on a block
          explorer — trackdefi just makes it readable.
        </li>
      </ul>

      <h2>How it works</h2>
      <ol>
        <li>
          You paste a wallet address. We read Aerodrome&apos;s on-chain data on the Base network to find every position
          that wallet holds — classic pools, concentrated (Slipstream) positions, and positions staked in gauges that
          don&apos;t appear as tokens in the wallet.
        </li>
        <li>
          For each position we compute how much of each token it holds, the pending fees and AERO emissions, and — for
          concentrated positions — whether the price is inside your chosen range.
        </li>
        <li>
          US-dollar values come from public price data (DefiLlama). When a token has no reliable price, we show “—”
          instead of guessing.
        </li>
      </ol>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t store your searches or build a profile of you.</li>
        <li>We don&apos;t give financial advice. Figures are informational; verify on-chain before acting.</li>
        <li>We don&apos;t guarantee prices or completeness — data can lag the chain by up to a minute.</li>
      </ul>

      <h2>Coverage</h2>
      <p>
        Today: Aerodrome and Uniswap v3 on Base, and Velodrome on Optimism. The app is built so more networks and
        exchanges can be added without changing how it works for you — see <Link href="/roadmap">the roadmap</Link>.
      </p>

      <p className="prose-back">
        <Link href="/" className="btn">
          ← Back to search
        </Link>
      </p>
    </main>
  );
}
