/**
 * Textos da interface (inglês — o idioma-mãe). Tudo que o NAVEGADOR precisa
 * ler vive aqui: o servidor entrega este objeto ao `I18nProvider`.
 *
 * O formato deste arquivo define o tipo `UiMessages`: os outros idiomas são
 * obrigados pelo TypeScript a ter exatamente as mesmas chaves.
 *
 * Marcadores: `{valor}` (preenchido por `fill`), `<b>…</b>` e `<link>…</link>`
 * (trechos formatados, via `rich`) e `{ one, other }` (plural, via `pl`).
 * Nome de rede NUNCA à mão — vem de `app/site.ts` (regra do site inteiro).
 */

import { DONATION_PHRASES } from "../../../donate";
import type { Plural } from "../../rich";
import { EN_DATE_LABELS } from "../../../ui/format";

const ui = {
  common: {
    dash: "—",
    chainFallback: "chain {id}",
  },

  header: {
    readOnly: "Read-only · we never ask for keys",
    language: "Language",
    theme: "Switch between day and night theme",
    tools: "Tools",
  },

  costbar: {
    aria: "Cost of building trackdefi",
    line: {
      one: "So far this site has taken about {n} hour of work and US$ {usd} to build and run.",
      other: "So far this site has taken about {n} hours of work and US$ {usd} to build and run.",
    } as Plural,
    tips: "Tips are optional:",
    copyAria: "Copy tip address",
    copy: "Copy",
    copied: "Copied ✓",
  },

  donate: {
    aria: "Support trackdefi",
    tipJar: "Tip jar",
    note: "Same address on any EVM network · always optional",
    copyAria: "Copy tip address",
    copy: "Copy",
    copied: "Copied ✓",
    phrases: [...DONATION_PHRASES] as string[],
  },

  ads: {
    label: "Advertisement",
  },

  footer: {
    safety:
      "<b>{name}</b> reads public blockchain data only. It never asks for private keys or seed phrases, and cannot move funds. <link>How it works & why it's safe →</link>",
    disclaimer:
      "Not financial advice. Verify data on-chain before acting. Prices by DefiLlama and DexScreener, or read from the pools themselves.",
    coverage:
      "Coverage: {list} — <roadmap>see the roadmap</roadmap> · <changelog>what's new</changelog> · <glossary>what each number means</glossary>.",
    feedback: "Feedback",
  },

  search: {
    placeholder: "Paste a wallet address (0x… or Solana)",
    aria: "Wallet address",
    invalid: "That doesn't look like a wallet address. Paste the full address: 0x… (42 characters) or a Solana address (32 to 44 letters and numbers).",
    submit: "Track positions",
    opening: "Opening…",
  },

  tapTips: { close: "Close" },

  wallet: {
    copyAddress: "Copy address",
    copied: "Copied ✓",
    refresh: "Refresh",
    scanning: "Scanning the blockchains…",
    scanningBody:
      "Reading Aerodrome, Velodrome, Uniswap, PancakeSwap, SushiSwap, Ramses and Orca across {networks} — classic, concentrated and staked positions.",
    elapsed: "{secs}s — a full scan takes ~15 s on the first visit",
    errors: {
      invalid_address: { title: "Invalid address", body: "That doesn't look like a valid wallet address." },
      rate_limited: { title: "Too many requests", body: "Please wait a few seconds and try again." },
      timeout: { title: "The blockchain took too long", body: "The network is slow right now. Try again in a moment." },
      upstream: { title: "Couldn't reach the blockchain", body: "A network hiccup on our side. Try again in a moment." },
      busy: { title: "Server is busy", body: "We're scanning other wallets right now. Try again in a few seconds." },
      network: { title: "Connection problem", body: "Check your internet connection and try again." },
    } as Record<string, { title: string; body: string }>,
    tryAgain: "Try again",
    invalidAddress: {
      title: "Invalid address",
      body: "“{address}” is not a valid wallet address.",
      back: "Back to search",
    },
    empty: {
      title: "No liquidity positions found",
      body: "This wallet has no active positions on Aerodrome, Velodrome, Uniswap, PancakeSwap, SushiSwap, Ramses or Orca across {networks} right now.",
      another: "Track another wallet",
    },
    kpi: {
      totalInPools: "Total in pools",
      positionsWithoutPrice: {
        one: "+ {n} position without a reliable price",
        other: "+ {n} positions without a reliable price",
      } as Plural,
      locked: "Locked",
      lockedHint: "{tokens} governance locks",
      claimable: "Claimable rewards",
      claimableHintLocks: "fees, emissions & lock rewards",
      claimableHint: "fees + emissions",
      rewardsWithoutPrice: {
        one: "+ {n} reward without a reliable price",
        other: "+ {n} rewards without a reliable price",
      } as Plural,
      positions: "Positions",
      scannedIn: "scanned in {s} s",
    },
    glossaryLink: "What do these numbers mean? →",
    showingTop: "Showing the top {shown} positions by value (of {total}). Totals include all of them.",
    refreshToRetry: "Refresh to retry.",
    sectionLocks: "Governance locks",
    sectionPositions: "Liquidity positions",
  },

  card: {
    kind: {
      concentrated: "Concentrated",
      v2stable: "Classic · stable",
      v2volatile: "Classic · volatile",
    },
    viewPool: "View pool on {explorer}",
    theExplorer: "the explorer",
    inRange: "✓ In range",
    outOfRange: "⚠ Out of range",
    staked: "Staked in gauge",
    /** PancakeSwap chama o seu "gauge" de farm (contrato MasterChef) */
    stakedFarm: "Staked in farm",
    alm: "ALM-managed",
    nft: "NFT #{id}",
    earningNow: "Earning now",
    poolShort: "pool {pct}",
    poolRef: " · pool {pct}",
    lastWindow: "Last {window}",
    perYear: "{pct}/yr",
    inFees: "{usd} in fees",
    emissions: "Emissions",
    currentRate: "current rate",
    /** gauge que parou de pagar (periodFinish no passado) */
    emissionsEnded: "ended {date}",
    tipEmissionsAero:
      "Emissions ended: since the Aero launch on Oct 22, 2026, Aerodrome and Velodrome gauges are switched off. Any rewards earned before that stay claimable.",
    tipEmissionsEnded:
      "Emissions ended: this pool's gauge stopped paying on {date}. Any rewards earned before that stay claimable.",
    /** contexto do % de emissões, que pode ser altíssimo e verdadeiro */
    emissionPerDay: "{usd}/day at this rate",
    partFees: "fees {pct}",
    partEmissions: "emissions {pct}",
    outOfRangeSub: "out of range",
    justOpenedSub: "just opened · first reading in ~15 min",
    tipWindows:
      "Swap fees this position actually earned, measured in the pool contract. Each row shows one measurement window: the rate is annualised, the dollar figure is what was earned inside that window. A short window running far above the long one means the pool is busy right now.",
    tipPoolAvg: "Pool average of all in-range liquidity: {pct}/yr ({source}).",
    tipOutOfRange:
      "Out of range: this position is earning no swap fees right now. Fees already accrued stay claimable.",
    tipOutOfRangeStaked:
      "Out of range: this position is earning no swap fees right now and its staking emissions are paused. Fees already accrued stay claimable.",
    tipPoolInRange: "In-range liquidity in this pool averages {pct}/yr ({source}).",
    tipEstimate: "Estimated yield THIS position is earning right now ({parts}).",
    tipEstimateNote: "Estimate from live pool data — not a realized return.",
    tipJustOpened:
      "This position was opened moments ago. Fees are measured over a window, and the shortest window the site uses is 15 minutes — so the first reading appears once the position is old enough to fill it.",
    earningLine: "Earning now <b>{pct}</b>",
    poolAprLine: "Pool APR <b>{pct}</b>",
    poolAprSub: "30d avg {mean} · {source}",
    poolAprTip:
      "Pool APR — fees: {base} · rewards: {reward} · 30d average: {mean}. Property of the pool, not your personal return. Source: {source}.",
    claimable: "Claimable",
    rewardEmission: "emissions",
    rewardFee: "fees",
    totalClaimable: "Total claimable",
  },

  lock: {
    badge: "Governance lock",
    managed: "In managed lock #{id}",
    managedTip:
      "This lock was deposited into a managed lock (a relay). The tokens now live in that managed lock, so this one shows zero locked.",
    permanent: "Permanent lock",
    permanentTip: "Permanently locked: voting power does not decay and there is no unlock date.",
    expired: "⚠ Expired — withdrawable",
    expiredTip:
      "This lock expired on {date}. The tokens are still in it, but they can be withdrawn — and it no longer has voting power.",
    unlocks: "Unlocks {date}",
    unlocksTip: "Voting power decays linearly until this date, when the tokens can be withdrawn.",
    locked: "{symbol} locked",
    votingPower: "Voting power",
    votingPowerTip: "Current voting power. It decays toward zero as the unlock date approaches.",
    claimable: "Claimable",
    rebase: "rebase",
    votes: "votes",
    rebaseTip: "Rebase: new tokens paid to lockers every week to offset emission dilution.",
    votesTip: "Voting rewards: swap fees and incentives from the pools this lock voted for.",
    aeroUpgrade:
      "Locks can be upgraded to sAERO on Aero. An upgraded lock disappears from this list — its new sAERO position isn't read yet.",
    totalClaimable: "Total claimable",
  },

  range: {
    ariaIn: "Price range {lower} to {upper} {quote}, current {current}, in range",
    ariaOut: "Price range {lower} to {upper} {quote}, current {current}, out of range",
    now: "now {price}",
    deltasTip: "How far the price has to move from now to reach each end of the range",
  },

  notices: {
    source: "Couldn't read {where} — positions there are missing from this list.",
    partial: "Some data from {where} didn't load, so a position or reward may be missing.",
    locks: "Couldn't read governance locks on {where}.",
    prices: "The price service didn't answer for some tokens, so their dollar values show \"—\".",
    apr: "Pool APR data didn't load, so pool averages show \"—\".",
    fees: {
      one: "Live fee measurement wasn't available for {n} position — its fee rate is estimated from pool-wide data where possible.",
      other:
        "Live fee measurement wasn't available for {n} positions — their fee rate is estimated from pool-wide data where possible.",
    } as Plural,
    capped:
      "This wallet holds a very large number of position NFTs on {where}; only {checked} were checked.",
    pairsCapped:
      "This wallet holds a very large number of classic (v2) pool positions on {where}; only {checked} were read.",
    tokensCapped:
      "This wallet holds a very large number of tokens on {network}; only {checked} were checked for classic (v2) pool positions.",
    hooks: {
      one: "{n} {where} position sits in a pool with a custom hook — any extra rewards the hook pays aren't counted.",
      other:
        "{n} {where} positions sit in a pool with a custom hook — any extra rewards the hook pays aren't counted.",
    } as Plural,
    where: "{protocol} on {network}",
    /** lançamento do Aero — textos aprovados pelo Alan em 21/10/2026 */
    aeroMerged:
      "Aerodrome and Velodrome merged into Aero on Oct 22, 2026. Their old gauges no longer pay emissions, so staked positions here now earn swap fees only. Positions and locks moved to Aero aren't read by trackdefi yet.",
    aeroLeaf: "Velodrome on {network} keeps trading and liquidity after the Aero launch, but without gauges or emissions.",
    aeroLisk: "Velodrome asks for deposits on Lisk to be withdrawn by Oct 31, 2026.",
    thisToken: "this token",
    noPriceFailed:
      "No USD price for {who} right now — either our price source doesn't cover {them}, or it didn't answer this time (see the warning above).",
    noPrice:
      "No reliable USD price for {who} — our price source doesn't cover {them}, so {they} no dollar value instead of a guess. This isn't an error; refreshing won't change it.",
    itOne: "it",
    itMany: "them",
    getsOne: "it gets",
    getsMany: "they get",
    poolPrice:
      "Priced from a pool: our price sources don't cover {symbol}, so this is {symbol}'s price inside a pool on this network right now — this position's own pool whenever it can be. A small or thin pool can price it differently from other markets.",
    summaryPositions:
      "These positions hold a token our price source doesn't cover, so they're left out of the total instead of guessed.",
    summaryRewards:
      "Some claimable tokens have no price in our price source, so they're left out of this total instead of guessed. The amounts are listed on each card.",
    summaryFailed: "The price service also failed to answer for some tokens this time — refreshing may bring those back.",
    summaryNotError: "This isn't an error; refreshing won't change it.",
  },

  feedback: {
    errors: {
      message_too_short: "Please write a few more words.",
      message_too_long: "Please keep it under {max} characters.",
      invalid_email: "That email address doesn't look right.",
      rate_limited: "Too many messages in a row — please wait a few minutes.",
    } as Record<string, string>,
    generic: "Couldn't send right now. Please try again in a moment.",
    sentTitle: "Thanks — message received.",
    sentWithEmail: "Every message is read by a person. If it needs an answer, we'll reply to the email you left.",
    sentNoEmail:
      "Every message is read by a person. You didn't leave an email, so we can't reply — but it still counts.",
    sendAnother: "Send another",
    messageLabel: "Your message",
    messagePlaceholder: "An idea, a network you'd like to see, a position we missed, something that looks off…",
    emailLabel: "Your email <em>(optional — only if you want a reply)</em>",
    emailPlaceholder: "you@example.com",
    honeypot: "Website",
    send: "Send",
    sending: "Sending…",
  },

  /** simulador de APR (`/tools/apr-simulator`) */
  simulator: {
    poolLabel: "Pool address, Uniswap v4 pool ID or link",
    poolPlaceholder: "0x… address, Uniswap v4 pool ID, or a link from the explorer, DexScreener or GeckoTerminal",
    load: "Load pool",
    loading: "Reading the pool…",
    supported: "Works with concentrated-liquidity pools from {protocols}, and with the classic pools of {classic}, on the networks trackdefi covers.",
    errors: {
      invalid: "That doesn't contain a pool address (0x followed by 40 characters) or a Uniswap v4 pool ID (0x followed by 64).",
      not_found: "No supported pool at this address. It may be a Solana pool, a network or exchange trackdefi doesn't cover yet, or a Uniswap v4 pool where nobody has opened a position through the official app.",
      rate_limited: "Too many simulations in a row — please wait a few seconds.",
      busy: "The server is busy right now. Try again in a few seconds.",
      timeout: "The blockchain read took too long. Please try again.",
      generic: "Couldn't read the pool right now. Please try again in a moment.",
    } as Record<string, string>,
    alsoOn: "This address exists on more than one network:",
    poolOn: "{protocol} on {network}",
    feeTier: "Fee {fee}",
    tvl: "In the pool: {usd}",
    viewPool: "View the pool on {explorer}",
    currentPrice: "Current price",
    perUnit: "{quote} per {base}",
    flip: "Flip price direction",
    amountLabel: "Amount to deposit (US$)",
    rangeLabel: "Price range",
    minLabel: "Min price",
    maxLabel: "Max price",
    presetsAria: "Range presets",
    fullRange: "Full range",
    stakedLabel: "Staked in the gauge (needed for {token} emissions)",
    adjusted: "Adjusted to the nearest prices the pool allows: {min} – {max}.",
    noPrice: "No reliable price for {token}, so dollars can't be turned into a position.",
    smallPool: "Small pool ({usd}): a single trade can move these numbers a lot.",
    outOfRange: "The current price is outside this range. The position would hold a single token and earn 0% until the price moves into it.",
    headline: "Earning while in range",
    headlineClassic: "Earning now",
    classicNote:
      "Classic pool ({kind}): the liquidity covers every price, so there is no range to choose — it earns whenever there are trades.",
    kindStable: "stable",
    kindVolatile: "volatile",
    timeAlways: "Always — a classic pool has no range",
    feesToVoters: "Staked, the swap fees go to voters; the position earns only the emissions.",
    v4Hook:
      "This Uniswap v4 pool has a hook ({hook}). A hook can charge or pay amounts outside the swap fee that this estimate doesn't see.",
    v4Dynamic: "Dynamic fee: the hook sets the fee on every swap. The fee shown is the current one; the measured fees already reflect what was actually charged.",
    perYear: "{pct}/yr",
    perDayMonth: "≈ {day} a day · {month} a month",
    feesLabel: "Fees",
    feesRow: "Fees — last {window}",
    emissionsLabel: "Emissions",
    feesNone: "Fees couldn't be measured right now (the network didn't return the pool's past state).",
    emissionsRow: "Emissions ({token})",
    emissionsEnded: "ended on {date}",
    emissionsNeedStake: "only if staked",
    noIncentive: "This pool pays no emissions.",
    timeRow: "Time in range — last 7 days",
    timeValue: "{pct} of the hours",
    timeNone: "No price history for this pair.",
    historyRange: "7-day low – high: {low} – {high}",
    repeatRow: "If the last 7 days repeated",
    depositRow: "Your deposit becomes",
    atMin: "If the price falls to {price}, it is all {token}: {amount}",
    atMax: "If it rises to {price}, it is all {token}: {amount}",
    concentration: "{x}× the fees of the same money spread over the full range.",
    share: "You would be {pct} of the pool's active liquidity.",
    howTitle: "Where these numbers come from",
    how: [
      "<b>Fees</b> are what the pool actually paid per unit of liquidity over the last 24 hours and 15 minutes, read from the pool contract, scaled to your amount — including the dilution your own deposit adds.",
      "<b>Emissions</b> use the gauge's current reward rate, shared with the liquidity already there.",
      "<b>Time in range</b> uses hourly prices of both tokens from DefiLlama over the last 7 days. Out of range, a position earns nothing.",
    ],
    caveat:
      "This is an estimate of the current pace, not a promise: volume, liquidity and prices change. It does not include impermanent loss or network fees. Not financial advice.",
  },

  /** descoberta de pares (`/tools/pairs`) */
  pairs: {
    loading: "Loading pools…",
    error: "Couldn't load the pool list right now. Please try again in a moment.",
    aprNotice:
      "<b>APR here is the pool average</b>, as reported by DefiLlama — total fees and rewards divided by everything deposited. It is not what one position earns: a narrow concentrated range can earn several times more while the price stays inside it, and nothing while it's out. To see a specific range, use the <link>APR simulator</link>.",
    search: "Token",
    searchPlaceholder: "e.g. WETH, USDC",
    network: "Network",
    protocol: "Exchange",
    all: "All",
    minApr: "Min APR (%)",
    minVolume: "Min volume (24 h)",
    minMcap: "Min market cap (smaller token)",
    minTvl: "Min TVL",
    any: "Any",
    sortBy: "Sort by",
    sort: {
      apr: "APR",
      volume1d: "Volume (24 h)",
      tvlUsd: "TVL",
      mcapMin: "Market cap (smaller token)",
    } as Record<string, string>,
    count: { one: "{n} pool matches", other: "{n} pools match" } as Plural,
    showing: "showing the first {n}",
    colPair: "Pair",
    colWhere: "Exchange · network",
    colApr: "APR",
    colVolume: "Volume 24 h",
    colTvl: "TVL",
    colMcap: "Market cap (smaller token)",
    aprSplit: "fees {base} · rewards {reward}",
    simulate: "Simulate",
    simulateTitle: "Open this pool in the APR simulator",
    soon: "Soon",
    soonTitle: "The APR simulator doesn't handle this pool yet",
    none: "No pool matches these filters.",
    source:
      "Pools from the exchanges and networks trackdefi reads. Data: DefiLlama, refreshed about once an hour. Market cap is the smaller of the two tokens; wrapped ETH, BNB and SOL count as the coin itself. “—” means DefiLlama has no figure for it — never a guess. “Soon” marks pools we can't link to the simulator yet: Solana pools; Uniswap v4 pools, because DefiLlama doesn't give their pool ID (paste it in the simulator yourself); and the few whose on-chain balance doesn't match DefiLlama's figure.",
    caveat: "A list to start research, not a recommendation. Not financial advice.",
  },

  /** datas à mão (ver `fmtDate`) — o `Intl` varia entre servidor e navegador */
  dates: EN_DATE_LABELS,
};

export type UiMessages = typeof ui;
export default ui;
