import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { COVERAGE, humanList, networksSentence, pageMetadata } from "../site";

/**
 * Glossário: o que é cada informação que a página de carteira mostra.
 *
 * Nasceu em 26/09/2026 de uma pergunta do Alan olhando um card ("o que é cada
 * coisa aqui?"). A ordem segue a da TELA, de cima para baixo — quem chega aqui
 * está com uma carteira aberta na outra aba procurando um rótulo.
 *
 * ⚠️ Manter em dia: rótulo novo ou renomeado em `app/ui/` (PositionsView,
 * PositionCard, LockCard, RangeBar, notices.ts) tem de entrar aqui também. E a
 * regra do `app/site.ts` vale: nome de rede NUNCA à mão — sai de `NETWORKS`.
 */

export const metadata: Metadata = pageMetadata({
  path: "/glossary",
  title: "Glossary — what every number means",
  description:
    "Plain-English guide to everything trackdefi shows for a wallet: position value, claimable rewards, Earning now, price ranges, gauges, governance locks and more.",
});

interface Term {
  /** âncora — permite linkar direto para um termo (#earning-now) */
  id: string;
  /** exatamente como aparece na tela */
  term: string;
  def: ReactNode;
}

interface Section {
  id: string;
  title: string;
  intro?: ReactNode;
  terms: Term[];
}

const EXCHANGES = humanList(COVERAGE.map((c) => c.protocol));

const SECTIONS: Section[] = [
  {
    id: "summary",
    title: "The summary at the top",
    intro: "The boxes above the cards add up the whole wallet.",
    terms: [
      {
        id: "total-in-pools",
        term: "Total in pools",
        def: "The dollar value of every liquidity position in the wallet, at current prices. It counts the tokens sitting in each position — not the rewards waiting to be claimed, and not governance locks, which have their own box.",
      },
      {
        id: "without-reliable-price",
        term: "+ N positions without a reliable price",
        def: (
          <>
            Positions holding at least one token our price source doesn&apos;t cover. They are left out of the total
            instead of guessed. This is not an error, and refreshing won&apos;t change it. See{" "}
            <a href="#dash">“—”</a>.
          </>
        ),
      },
      {
        id: "locked",
        term: "Locked",
        def: (
          <>
            The dollar value of the wallet&apos;s <a href="#governance-lock">governance locks</a> (veAERO, veVELO).
            Shown only when the wallet has one.
          </>
        ),
      },
      {
        id: "claimable-rewards",
        term: "Claimable rewards",
        def: "Everything the wallet can collect right now, in dollars: swap fees and emissions from its positions, plus lock rewards. Nothing here has been collected yet — it is what's waiting.",
      },
      {
        id: "rewards-without-price",
        term: "+ N rewards without a reliable price",
        def: "Claimable tokens with no price in our price source. Their amounts are listed on each card, but they can't be added to a dollar total.",
      },
      {
        id: "positions",
        term: "Positions · scanned in N s",
        def: `How many liquidity positions were found, and how long it took to read ${networksSentence()} to find them.`,
      },
      {
        id: "showing-top",
        term: "Showing the top N positions",
        def: "Some wallets hold thousands of tiny positions. Past a limit, only the largest are shown as cards — but the totals above still include every one of them.",
      },
      {
        id: "scan-warnings",
        term: "⚠ Yellow notices",
        def: (
          <>
            Something that didn&apos;t go as planned during this scan, one line each: a network that didn&apos;t answer,
            a price service that failed, fees that had to be estimated. A line ends in “Refresh to retry” only when a
            refresh can actually help — the others describe a known limit that reloading won&apos;t change.
          </>
        ),
      },
    ],
  },
  {
    id: "position-card",
    title: "A position card",
    intro: "Each card is one position: liquidity you deposited in one pool.",
    terms: [
      {
        id: "pool-name",
        term: "Pool name (e.g. CL100-WETH/USDC)",
        def: (
          <>
            The two tokens in the pool, plus a prefix or suffix that says what kind of pool it is:
            <ul>
              <li>
                <strong>CL + number</strong> — a concentrated pool. The number is its tick spacing: how finely the price
                range can be set. Small numbers are used for pairs that move little against each other.
              </li>
              <li>
                <strong>vAMM</strong> — a classic volatile pool; <strong>sAMM</strong> — a classic stable pool, built for
                tokens that should trade near 1:1.
              </li>
              <li>
                <strong>A percentage (e.g. WETH/USDC 0.05%)</strong> — a Uniswap pool and its fee tier: the share of every
                swap paid to the pool&apos;s liquidity.
              </li>
            </ul>
            Clicking the name opens the pool on the network&apos;s block explorer.
          </>
        ),
      },
      {
        id: "position-value",
        term: "Value (top right)",
        def: (
          <>
            What the tokens in this position are worth right now, in dollars. Claimable rewards are not included. A “—”
            means one of the tokens has no reliable price.
          </>
        ),
      },
      {
        id: "network",
        term: "Network badge",
        def: `The blockchain the position lives on — one of ${networksSentence()}.`,
      },
      {
        id: "exchange",
        term: "Exchange badge",
        def: `The exchange that holds the pool: ${EXCHANGES}.`,
      },
      {
        id: "concentrated",
        term: "Concentrated",
        def: (
          <>
            A position that provides liquidity only inside a <a href="#price-range">price range</a> you picked. Inside the
            range it earns more fees per dollar than a classic position; outside it earns nothing. Each one is an NFT.
          </>
        ),
      },
      {
        id: "classic",
        term: "Classic · volatile / Classic · stable",
        def: "A position spread across every possible price, so it is never out of range — it earns less per dollar, but always earns. Stable pools use a curve designed for tokens that trade near the same price; volatile pools, for everything else.",
      },
      {
        id: "in-range",
        term: "✓ In range / ⚠ Out of range",
        def: "Whether the current price is inside the position's range. In range, it is earning. Out of range, it earns no swap fees, and if it is staked, gauge emissions stop too. Fees earned before it left the range stay claimable.",
      },
      {
        id: "staked",
        term: "Staked in gauge",
        def: "The position was deposited into the exchange's gauge — a contract that pays emissions (the exchange's own token) to liquidity providers. Staking moves the position out of the wallet, which is why most wallets and many trackers stop showing it. trackdefi reads the gauges directly.",
      },
      {
        id: "alm",
        term: "ALM-managed",
        def: "The position is run by an automated liquidity manager, which moves the price range for you as the market moves.",
      },
      {
        id: "nft",
        term: "NFT #",
        def: "The ID of the NFT that represents a concentrated position. It is how you find the exact position on the exchange or on a block explorer.",
      },
    ],
  },
  {
    id: "earning",
    title: "What the position is earning",
    intro: (
      <>
        Rates here are <strong>annualised</strong>: what the position would earn over a year if the current pace held.
        They are estimates from live data, not a return you have already made — and the pace can change quickly.
      </>
    ),
    terms: [
      {
        id: "earning-now",
        term: "Earning now",
        def: "What THIS position is earning right now — your own position, not the pool's average. A narrower range usually earns more per dollar than the pool average while it stays in range.",
      },
      {
        id: "last-24h",
        term: "Last 24 h / Last 15 min",
        def: (
          <>
            Swap fees this position actually earned, measured in the pool contract over two windows. Each row shows the
            annualised rate and the dollars earned inside that window. Read them together: a 15-minute rate far above the
            24-hour one means the pool is busy right now; far below means the rush already passed. Annualising 15 minutes
            multiplies it by 35,040, so keep an eye on the dollar figure next to it.
          </>
        ),
      },
      {
        id: "emissions-rate",
        term: "Emissions · current rate",
        def: "The reward token the gauge is paying this position, at the gauge's current rate and the token's current price. Only for staked positions that are in range.",
      },
      {
        id: "fees-plus-emissions",
        term: "fees X% + emissions Y%",
        def: "The two parts that add up to Earning now. When the line shows this instead of the 24 h / 15 min rows, the fees couldn't be measured in the contract for this scan, so their rate is estimated from pool-wide data and your share of the pool's active liquidity.",
      },
      {
        id: "pool-apr-ref",
        term: "pool X%",
        def: "The average rate for all in-range liquidity in the pool, from DefiLlama — a reference to compare your position against.",
      },
      {
        id: "out-of-range-zero",
        term: "Earning now 0% · out of range",
        def: "The price left your range, so the position is earning nothing until it comes back — or until you move the range.",
      },
      {
        id: "just-opened",
        term: "Earning now — · just opened",
        def: "The position is too new to measure. The shortest window is 15 minutes, so the first reading appears once the position is that old.",
      },
      {
        id: "pool-apr",
        term: "Pool APR · 30d avg",
        def: "Shown when we can't compute a number for your own position: the pool's current rate and its 30-day average, from DefiLlama. It describes the pool, not your personal return.",
      },
    ],
  },
  {
    id: "tokens-range",
    title: "Tokens and price range",
    terms: [
      {
        id: "token-rows",
        term: "Token rows (e.g. WETH 1.5 $4,500.00)",
        def: "How much of each token the position holds right now, and what that is worth. The mix changes with the price: as one token gets more expensive, the pool sells it from your position in exchange for the other.",
      },
      {
        id: "price-range",
        term: "Price range bar",
        def: (
          <>
            The left and right numbers are the edges of the range; <strong>now</strong> is the current price, and the
            marker shows where it sits. Green means in range. When the price is past an edge, the bar turns orange and
            the marker is pinned to that side — the position is then 100% in one of the two tokens.
          </>
        ),
      },
      {
        id: "price-unit",
        term: "Price unit (e.g. USDC/WETH)",
        def: "The unit of the range numbers: how many of the first token one of the second token is worth. USDC/WETH at 3,000 means 1 WETH = 3,000 USDC.",
      },
    ],
  },
  {
    id: "claimable",
    title: "Claimable",
    terms: [
      {
        id: "claimable-fees",
        term: "fees",
        def: "Swap fees the position has earned and not collected yet, token by token.",
      },
      {
        id: "claimable-emissions",
        term: "emissions",
        def: "Gauge rewards earned by a staked position and not claimed yet.",
      },
      {
        id: "total-claimable",
        term: "Total claimable",
        def: "The dollar sum of the rows above. When some of them have no price, it shows the priced part followed by the names of the others (e.g. “$12.40 + XYZ”).",
      },
    ],
  },
  {
    id: "locks",
    title: "Governance locks",
    intro: "Shown above the positions when the wallet has locked AERO or VELO to vote.",
    terms: [
      {
        id: "governance-lock",
        term: "veAERO #id / veVELO #id · Governance lock",
        def: "Tokens locked in exchange for voting power. Each week, lockers vote on which pools receive emissions, and are paid for it. The lock is an NFT; the number is its ID.",
      },
      {
        id: "locked-amount",
        term: "AERO locked / VELO locked",
        def: "How many tokens are inside the lock, and what they are worth now.",
      },
      {
        id: "voting-power",
        term: "Voting power",
        def: "The lock's current weight in votes. It shrinks steadily toward zero as the unlock date approaches — unless the lock is permanent.",
      },
      {
        id: "unlocks",
        term: "Unlocks <date>",
        def: "The date the tokens can be withdrawn.",
      },
      {
        id: "permanent",
        term: "Permanent lock",
        def: "Locked with no unlock date; its voting power doesn't decay.",
      },
      {
        id: "expired",
        term: "⚠ Expired — withdrawable",
        def: "The unlock date has passed. The tokens are still sitting in the lock, free to take out — and the lock no longer has voting power.",
      },
      {
        id: "managed",
        term: "In managed lock #",
        def: "This lock was deposited into a managed lock (a relay) that votes on its behalf. The tokens now live in the managed lock, so this one shows zero.",
      },
      {
        id: "rebase",
        term: "rebase",
        def: "New tokens paid to lockers every week, to offset the dilution from emissions.",
      },
      {
        id: "votes",
        term: "votes",
        def: "Voting rewards: swap fees and incentives from the pools this lock voted for.",
      },
    ],
  },
  {
    id: "symbols",
    title: "Symbols",
    terms: [
      {
        id: "dash",
        term: "—",
        def: "No reliable number to show, so we show nothing rather than guess. For a price, it almost always means our price source doesn't cover that token; hover over it (or tap it) to see which one.",
      },
      {
        id: "dotted",
        term: "Dotted underline",
        def: "Text with a dotted underline has an explanation: hover over it with a mouse, or tap it on a phone. The Earning now box and the badges on a lock work the same way.",
      },
    ],
  },
];

export default function Glossary() {
  return (
    <main className="container prose">
      <h1>Glossary</h1>

      <p className="prose-lede">
        What every number and label on a wallet page means, in the order they appear on screen.
      </p>

      <nav className="glossary-toc" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="glossary-section">
          <h2>{s.title}</h2>
          {s.intro && <p>{s.intro}</p>}
          <dl className="glossary">
            {s.terms.map((t) => (
              <div key={t.id} id={t.id} className="glossary-item">
                <dt>{t.term}</dt>
                <dd>{t.def}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="prose-note">
        Dollar values use public price data from DefiLlama and can lag the chain by up to a minute. Nothing here is
        financial advice — verify on-chain before acting. See also{" "}
        <Link href="/how-it-works">how it works &amp; why it&apos;s safe</Link>.
      </p>

      <p className="prose-back">
        <Link href="/" className="btn">
          ← Back to search
        </Link>
      </p>
    </main>
  );
}
