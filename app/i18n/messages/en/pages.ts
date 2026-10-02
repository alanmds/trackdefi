/**
 * Textos das páginas e dos metadados (inglês — o idioma-mãe). Só o SERVIDOR
 * lê este arquivo: ele não vai para o pacote do navegador, então pode ser
 * grande. O que o navegador precisa está em `ui.ts`.
 *
 * Marcadores: `{valor}`, `<b>…</b>`, `<em>…</em>` e marcadores de link
 * específicos de cada trecho (`<roadmap>…</roadmap>`), que a página liga à
 * rota certa já no idioma certo — texto nenhum escreve URL.
 */

import type { ChangeKind } from "../../../changelog";

export type RoadmapKind = "live" | "next" | "planned" | "exploring";

export interface RoadmapItem {
  title: string;
  body: string;
}

export interface GlossaryTerm {
  id: string;
  /** exatamente como aparece na tela (e por isso igual ao que está em `ui.ts`) */
  term: string;
  def: string;
  /** lista logo após `def` (só o "nome do pool" usa) */
  list?: string[];
  /** frase depois da lista */
  after?: string;
}

export interface GlossarySection {
  id: string;
  title: string;
  intro?: string;
  terms: GlossaryTerm[];
}

const pages = {
  common: {
    backToSearch: "← Back to search",
  },

  meta: {
    /** `{families}`: "Aerodrome, Velodrome & Uniswap" */
    siteTitle: "Liquidity Pool Tracker · {families}",
    siteDescription:
      "Free LP tracker: paste a wallet address to see every {families} position across {count} networks — gauge-staked ones included.",
    ogAlt: "{name} — liquidity pool tracker",
    keywordsBase: [
      "liquidity pool tracker",
      "LP position tracker",
      "Aerodrome",
      "Uniswap v3",
      "Velodrome",
      "PancakeSwap v3",
      "Ramses",
    ],
    /** uma por rede */
    keywordNetwork: "{network} LP tracker",
    keywordsExtra: ["DeFi portfolio", "concentrated liquidity", "wallet address"],
    walletFallback: "wallet",
    ogCard: {
      title: "Liquidity Pool Tracker",
      subtitle: "Paste a wallet address — see every LP position, staked ones included.",
      networks: "{count} networks — read-only, no keys, no login",
    },
    /** "Aerodrome, Velodrome & Uniswap v3" no cartão — nomes próprios, não traduzir */
    ogProtocols: "Aerodrome · Velodrome · Uniswap · PancakeSwap · Ramses",
  },

  /** frase de "sem token" — promessa pública e permanente (ver `NO_TOKEN` em app/site.ts) */
  noToken: "No token, no presale, no airdrop.",

  home: {
    heading: ["Every LP position.", "One wallet address."],
    lede: "Paste any wallet address and see all of its liquidity pool positions across {networks} — value, pending fees, emissions and price ranges. Including positions staked in gauges and farms, which most trackers miss.",
    tryDemo: "No wallet handy? <link>Try a demo wallet →</link>",
    whatsNew: "<date>Updated {date}</date> — {title}. <link>What's new →</link>",
    more: "More <soon>— see the roadmap →</soon>",
    featuresAria: "How it works",
    features: [
      {
        title: "Read-only, by design",
        body: "We only read public blockchain data. No login, no wallet connection, no keys — {name} cannot touch funds.",
      },
      {
        title: "Staked positions included",
        body: "Positions staked in Aerodrome or Velodrome gauges, or in PancakeSwap farms, don't show up as tokens in the wallet. We read them straight from the protocol, with their pending emissions.",
      },
      {
        title: "Honest numbers",
        body: "Values come from on-chain state and DefiLlama prices. When a token has no reliable price, we show “—” instead of guessing.",
      },
    ],
    faqAria: "Frequently asked questions",
    faqTitle: "Frequently asked questions",
    /** respostas em texto puro: vão também para os dados estruturados do Google */
    faq: [
      {
        q: "How do I track my liquidity pool positions across networks?",
        a: "Paste your wallet address (0x…) in the search box above. {name} reads the blockchains and lists every LP position that address holds on Aerodrome, Velodrome, Uniswap, PancakeSwap and Ramses across {networks} — value in USD, pending fees, emissions and price ranges.",
      },
      {
        q: "Why don't my staked Aerodrome LP positions show up in my wallet?",
        a: "When you stake a position in an Aerodrome gauge to earn AERO, the LP token (or NFT) moves into the gauge contract, so wallets and most portfolio trackers stop showing it. {name} reads the gauges directly, so staked positions appear with their pending emissions. The same applies to Velodrome gauges on {velodromeNetworks}, and to PancakeSwap v3 positions staked in its farms (the MasterChef) on BNB Chain, with their pending CAKE.",
      },
      {
        q: "Do I need to connect my wallet or create an account?",
        a: "No. You only paste a public address — there is no wallet connection, no login and no private keys. {name} is read-only by construction and cannot touch funds.",
      },
      {
        q: "Which exchanges and networks are supported?",
        a: "Today: {coverage} — classic pools and concentrated liquidity, staked or not. More networks and exchanges are on the roadmap.",
      },
      {
        q: "Is {name} free?",
        a: "Yes — free, no account, no limits for normal use. {noToken} Values come from on-chain data and public price feeds.",
      },
    ],
  },

  howItWorks: {
    title: "How it works & why it's safe",
    description:
      "How trackdefi reads your LP positions straight from the blockchain — no login, no wallet connection, no keys — and why it can never touch your funds.",
    lede: "trackdefi shows the liquidity pool positions of any wallet from just its public address. It is a read-only window into the blockchain — nothing more.",
    safeTitle: "Why it's safe",
    safe: [
      "<b>We never ask for a private key or seed phrase.</b> If any site ever asks you for those to “see your positions,” leave. They are never needed to read public data.",
      "<b>No wallet connection.</b> You paste an address; you don't connect a wallet. trackdefi has no permission to move, approve, or sign anything.",
      "<b>Read-only by construction.</b> The app only makes <em>read</em> calls to the blockchain. There is no code path that can send a transaction, because it never holds a key.",
      "<b>Public data only.</b> A wallet address is public. Anyone can already look it up on a block explorer — trackdefi just makes it readable.",
    ],
    howTitle: "How it works",
    how: [
      "You paste a wallet address. We read the supported exchanges' on-chain data across our networks to find every position that wallet holds — classic pools, concentrated positions, and positions staked in gauges or farms that don't appear as tokens in the wallet.",
      "For each position we compute how much of each token it holds, the pending fees, and the pending emissions where the exchange pays them — and, for concentrated positions, whether the price is inside your chosen range.",
      "US-dollar values come from public price data (DefiLlama, then DexScreener). When neither covers a token, we read its price from a pool on the same network and mark it with a dotted underline. When nothing can price a token, we show “—” instead of guessing.",
    ],
    notTitle: "What we don't do",
    not: [
      "We don't give financial advice. Figures are informational; verify on-chain before acting.",
      "We don't guarantee prices or completeness — data can lag the chain by up to a minute.",
    ],
    coverageTitle: "Coverage",
    coverage:
      "Today: {coverage}. The app is built so more networks and exchanges can be added without changing how it works for you — see <roadmap>the roadmap</roadmap>.",
  },

  roadmap: {
    title: "Roadmap — networks & exchanges",
    heading: "Roadmap",
    description:
      "Where trackdefi is today and where it's going: per-position APR, Aerodrome, Velodrome, Uniswap, PancakeSwap and Ramses across {count} networks; SushiSwap, Polygon, Avalanche and more next.",
    lede: "Where trackdefi is today and where it's going. No deadlines and no promises — priorities follow what users actually ask for. One thing never changes: <b>read-only, forever</b>.",
    status: { live: "✓ Live", next: "→ Next", planned: "Planned", exploring: "Exploring" } as Record<RoadmapKind, string>,
    liveTitle: "Live today",
    live: [
      {
        title: "Per-position APR — “Earning now”",
        body: "what <em>your</em> position earns right now, not the pool average: swap fees and emissions counted separately, and an honest 0% when a concentrated position is out of range and earning nothing.",
      },
      {
        title: "Governance locks · veAERO & veVELO",
        body: "locked AERO and VELO next to your positions: amount, voting power, unlock date, and the rebase and voting rewards waiting to be claimed. Expired locks are flagged as withdrawable.",
      },
      {
        title: "Base · Aerodrome",
        body: "classic and concentrated (Slipstream) positions, including gauge-staked ones, with pending fees and AERO emissions.",
      },
      {
        title: "Base · Uniswap v3",
        body: "concentrated positions with pending fees, read straight from the blockchain.",
      },
      {
        title: "Optimism · Velodrome",
        body: "Aerodrome's sister exchange: staked positions and VELO emissions included. Our first extra network.",
      },
      {
        title: "Ethereum, Arbitrum & Optimism · Uniswap v3",
        body: "the Base integration, now across the major networks.",
      },
      {
        title: "Robinhood Chain · Uniswap v3",
        body: "the tokenized-stock L2, which launched in July 2026 and is already one of the largest Uniswap v3 deployments by liquidity. Positions, amounts, pending fees and range status all work; pool APR shows “—” until public yield data covers this network.",
      },
      {
        title: "Unichain, Ink, Mode, Soneium & Fraxtal · Velodrome",
        body: "Velodrome's Superchain deployment. Five networks in one step, because they share the same architecture we already read: staked positions and pending XVELO emissions included. Emission <em>values</em> show “—” while public price data doesn't cover XVELO — the amounts are exact either way.",
      },
      {
        title: "Robinhood Chain · Uniswap v4",
        body: "the singleton-and-hooks architecture. Positions, amounts, price ranges and pending swap fees, checked against Uniswap's own interface to the cent. Closed positions are hidden, same as Uniswap does.",
      },
      {
        title: "Lisk, Swell, Metal L2, Superseed & Celo · Velodrome",
        body: "the rest of Velodrome's Superchain deployment, read the same way as the first five. Positions, amounts, staked positions and pending XVELO emissions are all exact. Where public price data doesn't reach yet (Swell, Metal L2, Superseed), dollar values are read from the networks' own pools.",
      },
      {
        title: "BNB Chain · PancakeSwap v3",
        body: "the largest exchange on BNB Chain. Concentrated positions, amounts, price ranges and pending fees — and positions staked in PancakeSwap farms, with their pending CAKE and what they earn in CAKE right now. Our first network outside the Ethereum L2s.",
      },
      {
        title: "Robinhood Chain · Ramses",
        body: "the ve(3,3) exchange with dynamic fees, read on the network where most of its liquidity sits: concentrated positions, amounts, price ranges and pending fees.",
      },
    ] as RoadmapItem[],
    nextTitle: "Next",
    next: [
      {
        title: "HyperEVM · Ramses",
        body: "Ramses' other big home, and the one with gauges: it pays RAM to every in-range position in a pool with a gauge, no staking needed. The reading already works in testing — the RAM waiting to be claimed and what each position earns in RAM right now. In most of those pools the swap fees go to RAM voters, so fees will show 0% there: that is the real number, not a gap.",
      },
      {
        title: "Unichain & BNB Chain · Uniswap v3",
        body: "Uniswap v3 on two networks trackdefi already reads: positions, amounts, price ranges and pending fees.",
      },
      {
        title: "Ethereum, Base & Arbitrum · PancakeSwap v3",
        body: "the same reading as on BNB Chain, including positions staked in PancakeSwap farms with their pending CAKE.",
      },
      {
        title: "SushiSwap v3",
        body: "on Ethereum, Optimism, BNB Chain, Base and Arbitrum: concentrated positions, amounts, price ranges and pending fees. It is built like Uniswap v3, so trackdefi already knows how to read it.",
      },
    ] as RoadmapItem[],
    plannedTitle: "Planned",
    planned: [
      {
        title: "HyperEVM · Hyperswap & Project X",
        body: "the two largest native exchanges on HyperEVM, next to Ramses.",
      },
      {
        title: "Polygon · Uniswap v3 & SushiSwap v3",
        body: "a new network, starting with exchanges trackdefi already reads elsewhere.",
      },
      {
        title: "Avalanche · Uniswap v3 & SushiSwap v3",
        body: "the same step on Avalanche C-Chain.",
      },
      {
        title: "Uniswap v4 on more networks",
        body: "Ethereum, Optimism, BNB Chain, Polygon, Base, Arbitrum, Avalanche and Unichain. v4 positions can't be listed by wallet on-chain; a way around that has been tested and works, and it also covers the largest wallets on Robinhood Chain.",
      },
      {
        title: "QuickSwap v3, Camelot v3 & THENA",
        body: "on Polygon, Arbitrum and BNB Chain. These exchanges run on Algebra, a different concentrated-liquidity engine, so they need their own reader.",
      },
      {
        title: "Classic pools (v2)",
        body: "the older 50/50 pools of Uniswap, PancakeSwap, SushiSwap, QuickSwap and Camelot, on every network where they run. A classic position is a token, not an NFT, so it needs a different way to be found.",
      },
      {
        title: "Arc · Aerodrome & Uniswap",
        body: "Circle's network, where the new Aero launches. Aerodrome's part waits for Aero's documentation for integrators.",
      },
      {
        title: "BNB Chain & Base · PancakeSwap Infinity",
        body: "PancakeSwap's newest version, with concentrated pools and liquidity bins: two different kinds of position, each with its own math.",
      },
      {
        title: "Ethereum · Ekubo",
        body: "an exchange designed from scratch, with its own architecture and price math rather than a fork of one trackdefi already reads.",
      },
      {
        title: "Solana · Orca",
        body: "our first network outside the Ethereum family. A proof of concept already reads Orca positions from public data — amounts, price range, in-range status, pending fees and rewards — so the work left is plumbing, not research. Raydium and Meteora would follow.",
      },
      {
        title: "Every major DeFi network",
        body: "the long-term goal: one address, every network, every position.",
      },
    ] as RoadmapItem[],
    exploringTitle: "Exploring",
    exploring: [
      {
        title: "Historical performance",
        body: "profit & loss and impermanent loss since each position was opened.",
      },
      {
        title: "Out-of-range alerts",
        body: "get notified when a concentrated position stops earning fees.",
      },
      {
        title: "Pool age",
        body: "how long a pool has existed, shown next to its APR. A brand-new pool with a high APR is a different signal from an old one with the same number.",
      },
    ] as RoadmapItem[],
    neverTitle: "What will never change",
    never: [
      "No login, no wallet connection, no private keys — trackdefi cannot touch funds.",
      "{noToken} trackdefi is a free tool, not an investment — anyone offering you a trackdefi token is running a scam.",
      "Honest numbers: when a token has no reliable price we show “—”, never a guess.",
      "Read straight from the blockchain, so what you see is the on-chain truth.",
    ],
    updated: "Last updated: {date} — see <link>what shipped and when</link>.",
  },

  changelog: {
    title: "What's new — every update, dated",
    description:
      "Every change that reached {name}, newest first: exchanges and networks added, APR improvements and maintenance, across {count} networks. Dated, in plain language.",
    heading: "What's new",
    lede: "Every change that reached the site, newest first — features, networks, exchanges and the maintenance in between. Dates are the day each one went live, not the day it was written.",
    note: "Where it goes next — and what will never change — is on the <roadmap>roadmap</roadmap>.",
    kinds: {
      network: "New network",
      exchange: "New exchange",
      feature: "New feature",
      improvement: "Improved",
      maintenance: "Maintenance",
      project: "Project news",
    } as Record<ChangeKind, string>,
  },

  feedback: {
    title: "Feedback",
    description:
      "Suggest a feature, ask for a network, or tell us about a position trackdefi missed. Every message is read by a person.",
    lede: "An idea, a network or exchange you'd like to see, a position we missed, a number that looks off — every message is read by a person.",
  },

  glossary: {
    title: "Glossary — what every number means",
    description:
      "Plain-English guide to everything trackdefi shows for a wallet: position value, claimable rewards, Earning now, price ranges, gauges, governance locks and more.",
    heading: "Glossary",
    lede: "What every number and label on a wallet page means, in the order they appear on screen.",
    tocAria: "Sections",
    note: "Dollar values use public price data from DefiLlama and can lag the chain by up to a minute. Nothing here is financial advice — verify on-chain before acting. See also <how>how it works & why it's safe</how>.",
    sections: [
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
            def: "Positions holding at least one token our price source doesn't cover. They are left out of the total instead of guessed. This is not an error, and refreshing won't change it. See <dash>“—”</dash>.",
          },
          {
            id: "locked",
            term: "Locked",
            def: "The dollar value of the wallet's <lock>governance locks</lock> (veAERO, veVELO). Shown only when the wallet has one.",
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
            def: "How many liquidity positions were found, and how long it took to read {networks} to find them.",
          },
          {
            id: "showing-top",
            term: "Showing the top N positions",
            def: "Some wallets hold thousands of tiny positions. Past a limit, only the largest are shown as cards — but the totals above still include every one of them.",
          },
          {
            id: "scan-warnings",
            term: "⚠ Yellow notices",
            def: "Something that didn't go as planned during this scan, one line each: a network that didn't answer, a price service that failed, fees that had to be estimated. A line ends in “Refresh to retry” only when a refresh can actually help — the others describe a known limit that reloading won't change.",
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
            def: "The two tokens in the pool, plus a prefix or suffix that says what kind of pool it is:",
            list: [
              "<b>CL + number</b> — a concentrated pool. The number is its tick spacing: how finely the price range can be set. Small numbers are used for pairs that move little against each other.",
              "<b>vAMM</b> — a classic volatile pool; <b>sAMM</b> — a classic stable pool, built for tokens that should trade near 1:1.",
              "<b>A percentage (e.g. WETH/USDC 0.05%)</b> — a Uniswap pool and its fee tier: the share of every swap paid to the pool's liquidity.",
            ],
            after: "Clicking the name opens the pool on the network's block explorer.",
          },
          {
            id: "position-value",
            term: "Value (top right)",
            def: "What the tokens in this position are worth right now, in dollars. Claimable rewards are not included. A “—” means one of the tokens has no reliable price.",
          },
          {
            id: "network",
            term: "Network badge",
            def: "The blockchain the position lives on — one of {networks}.",
          },
          {
            id: "exchange",
            term: "Exchange badge",
            def: "The exchange that holds the pool: {exchanges}.",
          },
          {
            id: "concentrated",
            term: "Concentrated",
            def: "A position that provides liquidity only inside a <range>price range</range> you picked. Inside the range it earns more fees per dollar than a classic position; outside it earns nothing. Each one is an NFT.",
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
            id: "staked-farm",
            term: "Staked in farm",
            def: "PancakeSwap's version of a gauge: the position was deposited into a PancakeSwap farm (the MasterChef contract), which pays CAKE. Same effect — the position leaves the wallet, and trackdefi reads the farm directly.",
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
        intro:
          "Rates here are <b>annualised</b>: what the position would earn over a year if the current pace held. They are estimates from live data, not a return you have already made — and the pace can change quickly.",
        terms: [
          {
            id: "earning-now",
            term: "Earning now",
            def: "What THIS position is earning right now — your own position, not the pool's average. A narrower range usually earns more per dollar than the pool average while it stays in range.",
          },
          {
            id: "last-24h",
            term: "Last 24 h / Last 15 min",
            def: "Swap fees this position actually earned, measured in the pool contract over two windows. Each row shows the annualised rate and the dollars earned inside that window. Read them together: a 15-minute rate far above the 24-hour one means the pool is busy right now; far below means the rush already passed. Annualising 15 minutes multiplies it by 35,040, so keep an eye on the dollar figure next to it.",
          },
          {
            id: "emissions-rate",
            term: "Emissions · $/day at this rate",
            def: "The reward token the gauge is paying this position, at the gauge's current rate and the token's current price. Only for staked positions that are in range. The percentage has no ceiling: when a gauge pays a lot to a small position, the number is high — and real. The dollars per day next to it say what that means in money.",
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
            def: "The left and right numbers are the edges of the range; <b>now</b> is the current price, and the marker shows where it sits. Green means in range. When the price is past an edge, the bar turns orange and the marker is pinned to that side — the position is then 100% in one of the two tokens. The percentages under each edge show how far the price has to move from now to reach it: −8.00% under the left edge means an 8% drop takes the position out of range on that side. Out of range, both have the same sign — the distance back to each edge.",
          },
          {
            id: "price-unit",
            term: "Price unit (e.g. USDC/WETH)",
            def: "The unit of the range numbers: how many of the first token one of the second token is worth. USDC/WETH at 3,000 means 1 WETH = 3,000 USDC.",
          },
          {
            id: "pool-price",
            term: "Dollar value with a dotted underline",
            def: "Our price sources don't cover that token, so its price comes from a pool on the same network — the position's own pool whenever possible: the other token's market price times the exchange rate inside the pool. It is the pool's real price — shown as it is, even when a small or thin pool prices the token differently from other markets.",
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
            term: "Unlocks [date]",
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
            def: "No reliable number to show, so we show nothing rather than guess. For a price, it means neither our price sources nor any pool on that network could price the token. Hover over it (or tap it) to see which one.",
          },
          {
            id: "dotted",
            term: "Dotted underline",
            def: "Text with a dotted underline has an explanation: hover over it with a mouse, or tap it on a phone. The Earning now box and the badges on a lock work the same way.",
          },
        ],
      },
    ] as GlossarySection[],
  },
};

export type PagesMessages = typeof pages;
export default pages;
