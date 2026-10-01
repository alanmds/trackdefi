/**
 * O que já chegou ao site, em ordem — fonte ÚNICA das datas de atualização.
 *
 * Alimenta três lugares: a página `/changelog`, a linha "Updated …" da home e
 * o rodapé "Last updated" do `/roadmap`. Ter isso num arquivo só é o ponto:
 * o rodapé do roadmap era escrito à mão e envelhecia calado (ficou em
 * "August 2026" mesmo depois do deploy de 15/09).
 *
 * REGRAS AO ADICIONAR UMA ENTRADA
 * 1. `date` é o dia em que a mudança foi AO AR (o commit que publicou), não o
 *    dia em que o código foi escrito. Confirmar no histórico do git.
 * 2. Mais recente primeiro — tem teste que trava a ordem.
 * 3. Texto para o USUÁRIO, não para quem programa: o que mudou na tela dele e
 *    por que importa. Nada de nome de arquivo, função ou commit.
 * 4. O texto escrito AQUI é o inglês. Cada idioma novo do site precisa da
 *    entrada traduzida em `app/i18n/messages/<idioma>/changelog.ts`, com o
 *    mesmo `id` — o teste cobra.
 * 5. ⚠️ Nome de rede aqui é ESCRITO À MÃO de propósito, ao contrário do resto
 *    do site (que sai de `NETWORKS` em `app/site.ts`). Entrada de log é um
 *    fato congelado: "em 10/08 entraram estas cinco redes" continua verdade
 *    mesmo quando a cobertura mudar. NÃO derivar isto de `NETWORKS`.
 */

export type ChangeKind = "network" | "exchange" | "feature" | "improvement" | "maintenance" | "project";

export interface ChangeEntry {
  /**
   * Identificador estável (kebab-case, nunca muda depois de publicado). É a
   * chave das traduções em `app/i18n/messages/<idioma>/changelog.ts`:
   * entrada nova sem tradução em cada idioma QUEBRA `tests/i18n.test.ts`.
   */
  id: string;
  /** AAAA-MM-DD — o dia em que foi ao ar */
  date: string;
  kind: ChangeKind;
  /** manchete curta; aparece na home quando é a mais recente */
  title: string;
  /** uma ou duas frases, em linguagem de usuário */
  body: string;
}

/**
 * Rótulo do selo de cada entrada, em INGLÊS. Os outros idiomas ficam em
 * `pages.changelog.kinds` de cada dicionário.
 */
export const KIND_LABEL: Record<ChangeKind, string> = {
  network: "New network",
  exchange: "New exchange",
  feature: "New feature",
  improvement: "Improved",
  maintenance: "Maintenance",
  project: "Project news",
};

/** mais recente primeiro */
export const CHANGELOG: ChangeEntry[] = [
  {
    id: "portuguese",
    date: "2026-09-30",
    kind: "feature",
    title: "trackdefi now speaks Portuguese",
    body:
      "The whole site — wallet pages, glossary, roadmap, this log — is now available in Brazilian Portuguese, with numbers and dates in Brazilian format. Use the language switch at the top of any page. More languages will follow.",
  },
  {
    id: "range-distance",
    date: "2026-09-30",
    kind: "improvement",
    title: "How far the price is from each edge of your range",
    body:
      "Under each end of the price range bar you now see how far the price has to move from now to reach it — for example −8.03% on the left and +32.48% on the right. When a position is out of range, the same numbers show how far the price is from coming back in.",
  },
  {
    id: "no-token",
    date: "2026-09-30",
    kind: "project",
    title: "No token, no presale, no airdrop",
    body:
      "Some crypto projects with names close to ours sell tokens. trackdefi has none, and it's now written on the site: it's a free, read-only tracker with nothing to buy, claim or connect. If anyone offers you a trackdefi token or airdrop, it's a scam.",
  },
  {
    id: "uniswap-v3-newest-nfts",
    date: "2026-09-29",
    kind: "improvement",
    title: "Uniswap v3: wallets with thousands of NFTs no longer show empty",
    body:
      "Bots and heavy traders can hold thousands of position NFTs. We used to read only the oldest 1,000, which are mostly closed, so a wallet with open positions could show none at all. We now read the newest 1,000 first.",
  },
  {
    id: "cost-in-the-open",
    date: "2026-09-29",
    kind: "project",
    title: "What it costs to build trackdefi, in the open",
    body:
      "A note at the top of every page now shows how many hours of work and how many dollars the site has taken so far, with the tip address next to it. Tips are optional — the tracker stays free and read-only either way.",
  },
  {
    id: "superchain-five-more",
    date: "2026-09-27",
    kind: "network",
    title: "Five more networks: Lisk, Swell, Metal L2, Superseed and Celo",
    body:
      "Velodrome positions on Lisk, Swell, Metal L2, Superseed and Celo now show up too — staked ones included, with pending XVELO emissions. That completes Velodrome's Superchain deployment. Where public price data doesn't reach yet (Swell, Metal L2, Superseed), dollar values are read from the networks' own pools.",
  },
  {
    id: "dexscreener-pool-prices",
    date: "2026-09-27",
    kind: "improvement",
    title: "Even fewer \"—\": DexScreener and network-wide pool prices",
    body:
      "When DefiLlama has no price for a token, we now ask DexScreener too. If neither has it, the price comes from any pool on the same network that trades it — not only the position's own pool — so rewards like XVELO get a dollar value too. Wrapped ETH on Superchain networks is priced as ETH, since it's exchangeable one-for-one. Prices read from a pool keep their dotted underline.",
  },
  {
    id: "prices-from-the-pool",
    date: "2026-09-27",
    kind: "improvement",
    title: "Fewer \"—\": prices from the pool itself",
    body:
      "When our price source doesn't cover a token but the other token in the pair has a price, the missing one now comes from the position's own pool — so more positions show a dollar value instead of \"—\". These values have a dotted underline: tap or hover to see where the price came from. It's the pool's real price, shown as it is, even when a small pool prices a token differently from other markets.",
  },
  {
    id: "feedback",
    date: "2026-09-27",
    kind: "feature",
    title: "Send us feedback",
    body:
      "Found a position we don't show, want a network added, or spotted a number that looks off? There's now a Feedback link at the bottom of every page. Every message is read by a person — leave an email if you'd like a reply.",
  },
  {
    id: "phone-summary",
    date: "2026-09-27",
    kind: "improvement",
    title: "A tighter wallet summary on phones",
    body:
      "On a phone, the totals at the top of a wallet now sit two by two instead of stacking, so your first position shows up without scrolling. And a \"What do these numbers mean?\" link right below them opens the glossary.",
  },
  {
    id: "demo-wallet",
    date: "2026-09-26",
    kind: "improvement",
    title: "A new demo wallet",
    body:
      "The \"Try a demo wallet\" link now opens a wallet that shows what trackdefi does best: positions across four networks on Uniswap and Aerodrome, gauge-staked ones included, with live fee measurements and claimable rewards.",
  },
  {
    id: "tap-tips",
    date: "2026-09-26",
    kind: "improvement",
    title: "Explanations open with a tap on phones",
    body:
      "The details behind the numbers — what adds up to Earning now, why a price shows \"—\", what a lock's status means — used to appear only when a mouse hovered over them, which a phone can't do. Now a tap opens them at the bottom of the screen. Cards also fit iPhones set to a larger display zoom, and long numbers no longer turn into phone-number links in Safari.",
  },
  {
    id: "glossary",
    date: "2026-09-26",
    kind: "feature",
    title: "A glossary for every number on the page",
    body:
      "Not sure what \"Earning now\", \"Staked in gauge\" or a price range like USDC/WETH means? The new glossary explains every label and figure on a wallet page in plain English, in the order they appear on screen. It's linked at the bottom of every page.",
  },
  {
    id: "warnings-say-what-happened",
    date: "2026-09-26",
    kind: "improvement",
    title: "Warnings that say what happened",
    body:
      "The yellow scan notice used to say only that something went wrong. Now each line tells you what: a network that didn't answer, or fees that were estimated because they couldn't be measured. It only suggests a refresh when a refresh can actually help. A \"—\" where a price should be now explains itself when you hover over it: some tokens have no reliable price, and that isn't an error. Claimable rewards also stopped hiding the priced part of a position just because one of its tokens has no price.",
  },
  {
    id: "governance-locks",
    date: "2026-09-25",
    kind: "feature",
    title: "Governance locks: veAERO and veVELO",
    body:
      "Locked AERO and VELO now show up next to your LP positions: how much is locked, its voting power, the unlock date, and what is waiting to be claimed — the weekly rebase plus the fees and incentives from the pools the lock voted for. An expired lock is flagged as withdrawable: the tokens are still sitting in it, free to take out, and no longer voting.",
  },
  {
    id: "tips",
    date: "2026-09-25",
    kind: "project",
    title: "An optional way to support the site",
    body:
      "trackdefi is free and stays free — no account, no paywall. If it saves you time, there is now a tip address at the bottom of every page, the same on any EVM network. Tips help pay for servers and blockchain nodes and for the work of adding networks; nothing changes for anyone who doesn't send one.",
  },
  {
    id: "two-windows",
    date: "2026-09-15",
    kind: "feature",
    title: "Two measurement windows, side by side",
    body:
      "Swap fees are now measured over 24 hours and over 15 minutes at once, each with the dollar amount earned inside that window. Reading them together tells you something neither says alone: a short window far above the long one means the pool is busy right now, and far below means the move already passed. The plausibility cap came off measured fees too — a pool genuinely paying 2,000% now says 2,000%, and judging whether that is worth your money is yours to do, not ours.",
  },
  {
    id: "sharper-apr",
    date: "2026-09-15",
    kind: "improvement",
    title: "Sharper APR for concentrated positions",
    body:
      "Per-position APR is now measured strictly inside your price range, so fees the pool earned while the price sat outside your range no longer count as yours. Narrow ranges were reading several times too high. A freshly opened position also gets a real number within minutes now, instead of borrowing the pool's last 24 hours.",
  },
  {
    id: "security-updates",
    date: "2026-08-12",
    kind: "maintenance",
    title: "Security updates",
    body:
      "Framework and image dependencies updated to close four high-severity advisories. Nothing changes on screen — this is the unglamorous work that keeps a site safe to visit.",
  },
  {
    id: "uniswap-v4-robinhood",
    date: "2026-08-10",
    kind: "exchange",
    title: "Uniswap v4 on Robinhood Chain",
    body:
      "v4 keeps every pool inside a single contract and offers no cheap way to ask which positions a wallet owns, which is why most trackers skip it. We read the history instead: positions, amounts, price ranges and pending fees, checked against Uniswap's own interface to the cent.",
  },
  {
    id: "superchain-five-networks",
    date: "2026-08-10",
    kind: "network",
    title: "Five networks at once: Unichain, Ink, Mode, Soneium and Fraxtal",
    body:
      "Velodrome's Superchain deployment, added in one step because those networks share the architecture we already read. Staked positions and pending emissions included, same as everywhere else.",
  },
  {
    id: "apr-from-pool",
    date: "2026-08-02",
    kind: "improvement",
    title: "APR read from the pool itself",
    body:
      "Fee APR now comes from the pool's own on-chain accumulators instead of a third-party dataset. It describes your position rather than the pool average, and it works on networks no data provider covers yet.",
  },
  {
    id: "robinhood-chain",
    date: "2026-08-02",
    kind: "network",
    title: "Robinhood Chain, the tokenized-stock L2",
    body:
      "Uniswap v3 on the network where tokenized equities trade. Positions, amounts, pending fees and range status all work — on a network that launched weeks earlier.",
  },
  {
    id: "own-domain",
    date: "2026-07-25",
    kind: "improvement",
    title: "Own domain: trackdefi.app",
    body:
      "The site moved to its own address, and wallet links now unfurl with a proper preview card when you share them.",
  },
  {
    id: "earning-now",
    date: "2026-07-24",
    kind: "feature",
    title: "“Earning now” — the APR of your position, not the pool's",
    body:
      "Pool APR tells you what the average dollar in a pool earns. “Earning now” tells you what your position earns: swap fees and emissions counted separately, and an honest 0% when a concentrated position is out of range and earning nothing.",
  },
  {
    id: "pool-apr",
    date: "2026-07-17",
    kind: "feature",
    title: "Pool APR on every position",
    body:
      "Each position started showing the yield of the pool behind it, with a 30-day average where public data covers it — and “—” where it doesn't, instead of a guess.",
  },
  {
    id: "uniswap-v3-major-networks",
    date: "2026-07-12",
    kind: "network",
    title: "Uniswap v3 on Ethereum, Arbitrum and Optimism",
    body: "The same integration that ran on Base, now across the major networks.",
  },
  {
    id: "velodrome-optimism",
    date: "2026-07-12",
    kind: "exchange",
    title: "Velodrome on Optimism",
    body:
      "Aerodrome's sister exchange, and the first network beyond Base. Gauge-staked positions and pending VELO emissions included.",
  },
  {
    id: "uniswap-v3-base",
    date: "2026-07-11",
    kind: "exchange",
    title: "Uniswap v3 on Base",
    body: "The second exchange: concentrated positions with their pending fees, read straight from the blockchain.",
  },
  {
    id: "launch",
    date: "2026-07-10",
    kind: "feature",
    title: "trackdefi goes live",
    body:
      "Paste a wallet address, see its Aerodrome positions on Base — including the ones staked in gauges, which wallets and most trackers stop showing the moment you stake.",
  },
];

/** a entrada que a home mostra */
export const LATEST: ChangeEntry = CHANGELOG[0];

/* A formatação de data mora em `ui/format.ts` desde 25/09/2026, porque o
   card de lock (componente de navegador) também usa — e importar este arquivo
   lá arrastaria o log inteiro para o bundle. Reexportada aqui para os imports
   antigos seguirem valendo. */
export { fmtDate } from "./ui/format";
