import type { Metadata } from "next";
import Link from "next/link";
import SearchForm from "./ui/SearchForm";
import { SITE_NAME } from "./site";

const DEMO_WALLET = "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** FAQ visível abaixo + dados estruturados correspondentes (mesmo conteúdo,
 * exigência do Google). Perguntas = intenções reais de busca do público-alvo. */
const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "How do I track my liquidity pool positions on Base and Optimism?",
    a: `Paste your wallet address (0x…) in the search box above. ${SITE_NAME} reads the blockchains and lists every LP position that address holds on Aerodrome and Uniswap v3 (Base) and Velodrome (Optimism) — value in USD, pending fees, emissions and price ranges.`,
  },
  {
    q: "Why don't my staked Aerodrome LP positions show up in my wallet?",
    a: `When you stake a position in an Aerodrome gauge to earn AERO, the LP token (or NFT) moves into the gauge contract, so wallets and most portfolio trackers stop showing it. ${SITE_NAME} reads the gauges directly, so staked positions appear with their pending AERO emissions.`,
  },
  {
    q: "Do I need to connect my wallet or create an account?",
    a: `No. You only paste a public address — there is no wallet connection, no login and no private keys. ${SITE_NAME} is read-only by construction and cannot touch funds.`,
  },
  {
    q: "Which exchanges and networks are supported?",
    a: "Today: Aerodrome and Uniswap v3 on Base, and Velodrome on Optimism — classic pools and concentrated liquidity, staked or not. More networks and exchanges are on the roadmap.",
  },
  {
    q: `Is ${SITE_NAME} free?`,
    a: "Yes — free, no account, no limits for normal use. Values come from on-chain data and public price feeds.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Home() {
  return (
    <main className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <section className="hero">
        <h1>
          Every LP position.
          <br />
          One wallet address.
        </h1>
        <p className="lede">
          Paste any wallet address and see all of its liquidity pool positions on Base — value, pending fees, emissions
          and price ranges. Including positions staked in gauges, which most trackers miss.
        </p>
        <SearchForm autoFocus />
        <p className="try-demo">
          No wallet handy? <Link href={`/w/${DEMO_WALLET}`}>Try a demo wallet →</Link>
        </p>
        <div className="coverage">
          <span className="chip">Base · Aerodrome</span>
          <span className="chip">Base · Uniswap v3</span>
          <span className="chip">Optimism · Velodrome</span>
          <Link href="/roadmap" className="chip">
            More networks <span className="soon">— see the roadmap →</span>
          </Link>
        </div>
      </section>

      <section className="features" aria-label="How it works">
        <div className="feature">
          <h3>Read-only, by design</h3>
          <p>
            We only read public blockchain data. No login, no wallet connection, no keys — {SITE_NAME} cannot touch
            funds.
          </p>
        </div>
        <div className="feature">
          <h3>Staked positions included</h3>
          <p>
            Positions staked in Aerodrome gauges don&apos;t show up as tokens in the wallet. We read them straight from
            the protocol, with pending AERO emissions.
          </p>
        </div>
        <div className="feature">
          <h3>Honest numbers</h3>
          <p>
            Values come from on-chain state and DefiLlama prices. When a token has no reliable price, we show “—”
            instead of guessing.
          </p>
        </div>
      </section>

      <section className="faq" aria-label="Frequently asked questions">
        <h2>Frequently asked questions</h2>
        {FAQ.map((f) => (
          <details className="faq-item" key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
