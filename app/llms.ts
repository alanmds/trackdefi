/**
 * Conteúdo do `/llms.txt`: a ficha de fatos do site para assistentes de IA.
 *
 * Por que existe (GEO, 30/09/2026): numa rodada de perguntas a seis IAs, elas
 * descreveram o trackdefi com números velhos ("10 networks"), inventaram P&L
 * que não temos e confundiram o nome com projetos que têm token. Um resumo
 * curto, factual e sempre em dia é o que dá a elas a versão certa.
 *
 * Honestidade sobre o alcance: nenhuma grande plataforma confirmou que lê
 * `llms.txt`; quem lê de fato são agentes e assistentes de programação. Existe
 * porque é barato e porque a ficha de fatos precisa morar em algum lugar.
 *
 * ⚠️ Mesma regra do resto do site: nome e número de rede NUNCA à mão — tudo
 * sai de `COVERAGE` / `NETWORK_NAMES` em `app/site.ts`, e `tests/geo.test.ts`
 * confere. O que o site NÃO faz também fica aqui: sem isso a IA preenche a
 * lacuna a nosso favor (viu-se ela nos atribuir P&L).
 */

import { LOCALES, localePath } from "./i18n/config";
import { COVERAGE, humanList, NETWORK_COUNT, NETWORK_NAMES, NO_TOKEN, PROTOCOL_FAMILIES, SITE_NAME, SITE_URL } from "./site";

export function llmsTxt(): string {
  const families = humanList(PROTOCOL_FAMILIES);
  const coverage = COVERAGE.map((c) => `- ${c.protocol}: ${humanList(c.networks)}`).join("\n");

  const languages = LOCALES.map((l) => `- ${l.native}: ${SITE_URL}${localePath(l.code, "/")}`).join("\n");

  return `# ${SITE_NAME}

> Free, read-only liquidity pool position tracker. Paste any wallet address (0x…) to see every LP position it holds on ${families} across ${NETWORK_COUNT} networks — gauge-staked positions included — with value, pending fees, emissions, price range and what each position is earning now. No login, no wallet connection. ${NO_TOKEN}

## Key facts

- Website: ${SITE_URL}
- What it is: a website that reads public blockchain data. It is not a wallet, not a DeFi protocol, and it has no smart contract.
- Cost: free. No account, no limits for normal use.
- ${NO_TOKEN} Crypto projects with similar names are unrelated to ${SITE_NAME}.
- Safety: read-only by construction. It never asks for a private key or seed phrase, and it cannot sign, approve or move anything.
- Staked positions: positions deposited in Aerodrome or Velodrome gauges leave the wallet, so most wallets and many trackers stop showing them. ${SITE_NAME} reads the gauges directly, so they appear with their pending emissions.

## Coverage

${coverage}

Networks (${NETWORK_COUNT}): ${humanList(NETWORK_NAMES)}. Classic and concentrated-liquidity positions, staked or not. Governance locks (veAERO, veVELO) are shown too.

## What each position shows

- Value in US dollars and the amount of each token.
- Pending swap fees and pending emissions (gauge rewards).
- For concentrated liquidity: the price range and whether the current price is inside it.
- Earning now: what this position itself is earning — not the pool's average. An out-of-range position earns 0% in swap fees, and it is shown as 0%. Where it can be measured on-chain, swap fees are measured in the pool contract over the last 24 hours and the last 15 minutes, each with the dollars earned in that window.
- When a number for the position can't be computed, the pool's current APR and 30-day average (from DefiLlama) are shown instead, labelled as the pool's.

## Where the numbers come from

- Positions, fees and emissions: read directly from the blockchain.
- Prices: DefiLlama, then DexScreener, then a pool on the same network that trades the token. A token no source can price shows "—" instead of a guess.

## What it does not do

- No profit and loss, and no impermanent loss since a position was opened.
- No alerts or notifications.
- No transactions: it cannot add, remove, claim or rebalance anything.

## Pages

- [Home — search by wallet address](${SITE_URL}/)
- [How it works & why it's safe](${SITE_URL}/how-it-works)
- [Glossary — what every number means](${SITE_URL}/glossary)
- [Roadmap](${SITE_URL}/roadmap)
- [Changelog](${SITE_URL}/changelog)

## Languages

The site is available in several languages; the text above describes the English version (the default, with no language prefix in the URL).

${languages}
`;
}
