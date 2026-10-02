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
    placeholder: "Paste a wallet address (0x…)",
    aria: "Wallet address",
    invalid: "That doesn't look like a wallet address. Paste the full 0x… address (42 characters).",
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
      "Reading Aerodrome, Velodrome, Uniswap and PancakeSwap across {networks} — classic, concentrated and staked positions.",
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
      body: "This wallet has no active positions on Aerodrome, Velodrome, Uniswap or PancakeSwap across {networks} right now.",
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
    hooks: {
      one: "{n} {where} position sits in a pool with a custom hook — any extra rewards the hook pays aren't counted.",
      other:
        "{n} {where} positions sit in a pool with a custom hook — any extra rewards the hook pays aren't counted.",
    } as Plural,
    where: "{protocol} on {network}",
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

  /** datas à mão (ver `fmtDate`) — o `Intl` varia entre servidor e navegador */
  dates: EN_DATE_LABELS,
};

export type UiMessages = typeof ui;
export default ui;
