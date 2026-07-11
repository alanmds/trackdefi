import Link from "next/link";
import SearchForm from "./ui/SearchForm";

const DEMO_WALLET = "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";

export default function Home() {
  return (
    <main className="container">
      <section className="hero">
        <h1>
          Every LP position.
          <br />
          One wallet address.
        </h1>
        <p className="lede">
          Paste any wallet address and see all of its liquidity pool positions — value, pending fees, emissions and
          price ranges. Including positions staked in gauges, which most trackers miss.
        </p>
        <SearchForm autoFocus />
        <p className="try-demo">
          No wallet handy? <Link href={`/w/${DEMO_WALLET}`}>Try a demo wallet →</Link>
        </p>
        <div className="coverage">
          <span className="chip">Base · Aerodrome</span>
          <span className="chip">Base · Uniswap v3</span>
          <span className="chip">
            More networks <span className="soon">— coming</span>
          </span>
        </div>
      </section>

      <section className="features" aria-label="How it works">
        <div className="feature">
          <h3>Read-only, by design</h3>
          <p>
            We only read public blockchain data. No login, no wallet connection, no keys — trackdefi cannot touch
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
    </main>
  );
}
