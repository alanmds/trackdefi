/**
 * Identidade do site num LUGAR SÓ (estratégia anti-retrabalho de SEO):
 * quando o domínio definitivo e/ou o nome mudarem, editar AQUI (e setar
 * NEXT_PUBLIC_SITE_URL na Vercel) — todos os metadados, canonicals,
 * sitemap e dados estruturados se atualizam sozinhos. Ver privado/SEO.md.
 */

import { DEFAULT_LOCALE, GRAMMAR, type Locale } from "./i18n/config";

export const SITE_NAME = "trackdefi";

/**
 * Carteira do botão "Try a demo wallet" da home — a VITRINE do site.
 *
 * Trocada em 26/09/2026. A anterior (a de teste do repo `sugar`) mostrava
 * posições fora da faixa, tokens sem preço e valores de centavos: boa para
 * validar, fraca como propaganda. Esta foi escolhida pelo Alan entre
 * candidatas achadas em dado público (depositantes do gauge CL100-WETH/USDC
 * da Aerodrome): posições em 4 redes, Uniswap v3 e Aerodrome, em stake e com
 * as janelas de 24 h / 15 min. É de terceiro, nunca de alguém daqui.
 *
 * ⚠️ As faixas dela são MANUAIS — posições podem sair da faixa se o preço
 * andar muito. O `poc/validate-live.ts` mostra a saúde dela depois de cada
 * deploy, para saber quando trocar. Candidatas reservas em
 * `privado/DEMO_CANDIDATAS.md`.
 */
export const DEMO_WALLET = "0xad93e07a25e815ebb69bc3272b36ff563197d33b";

/**
 * Redes suportadas, na ordem em que aparecem nos textos.
 *
 * Vive aqui, e não em `core/chains.ts`, porque componentes client importam
 * este arquivo e `core/chains.ts` carrega as definições do viem — não vale
 * engordar o bundle do navegador por causa de uma frase.
 *
 * `label` é o nome curto (badge do card de posição, onde o espaço é apertado);
 * `name` é o nome por extenso do texto corrido. Só a Robinhood Chain difere.
 *
 * A duplicação é PROTEGIDA: `tests/chains.test.ts` compara os `label` com o
 * `CHAINS` de verdade. Rede nova sem atualizar aqui **quebra o teste**, não o
 * site — foi o que aconteceu em 02/08/2026, quando a Robinhood Chain entrou e
 * a página de resultados continuou anunciando quatro redes.
 *
 * ⚠️ REGRA: **nenhum texto do site escreve nome ou número de rede à mão.**
 * Toda frase de cobertura sai das funções deste arquivo. Foi escrevendo à mão
 * que "the Base blockchain" (quando já eram quatro redes) e "across 4
 * networks" (quando já eram cinco) foram parar no ar sem ninguém ver.
 * Exceção consciente: o /roadmap, onde cada item é um marco histórico e
 * *deve* citar a rede daquela expansão pelo nome.
 */
export const NETWORKS = [
  { label: "Base", name: "Base" },
  { label: "Optimism", name: "Optimism" },
  { label: "Ethereum", name: "Ethereum" },
  { label: "Arbitrum", name: "Arbitrum" },
  { label: "Robinhood", name: "Robinhood Chain" },
  { label: "Unichain", name: "Unichain" },
  { label: "Ink", name: "Ink" },
  { label: "Mode", name: "Mode" },
  { label: "Soneium", name: "Soneium" },
  { label: "Fraxtal", name: "Fraxtal" },
  { label: "Lisk", name: "Lisk" },
  { label: "Swell", name: "Swell" },
  { label: "Metal L2", name: "Metal L2" },
  { label: "Superseed", name: "Superseed" },
  { label: "Celo", name: "Celo" },
  { label: "BNB Chain", name: "BNB Chain" },
  { label: "HyperEVM", name: "HyperEVM" },
] as const;

/** nomes por extenso, na ordem de exibição */
export const NETWORK_NAMES: readonly string[] = NETWORKS.map((n) => n.name);

/** quantas redes o site cobre — usar isto em vez de digitar o número */
export const NETWORK_COUNT = NETWORKS.length;

/**
 * "A, B and C" (ou "A, B & C") — sem vírgula de Oxford, como o resto do site.
 * O conector vem da gramática do idioma ("A, B e C" em português).
 */
export function humanList(items: readonly string[], last: "and" | "&" = "and", locale: Locale = DEFAULT_LOCALE): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  const g = GRAMMAR[locale];
  return `${items.slice(0, -1).join(", ")} ${last === "and" ? g.and : g.amp} ${items[items.length - 1]}`;
}

/** "Base, Optimism, Ethereum, Arbitrum and Robinhood Chain" */
export function networksSentence(last: "and" | "&" = "and", locale: Locale = DEFAULT_LOCALE): string {
  return humanList(NETWORK_NAMES, last, locale);
}

/** "Base · Optimism · Ethereum · Arbitrum · Robinhood Chain" */
export function networksDotted(): string {
  return NETWORK_NAMES.join(" · ");
}

/**
 * Quem lê o quê, por protocolo.
 *
 * ⚠️ Até 10/08/2026 o Uniswap v3 rodava em TODAS as redes registradas e esta
 * tabela dizia `networks: NETWORK_NAMES`. **Deixou de ser verdade** quando as
 * leaf chains da Superchain entraram (Receita A): a Velodrome roda nelas, o
 * Uniswap v3 não. Cada protocolo agora lista as suas redes explicitamente, e
 * `tests/chains.test.ts` compara ESTAS listas com os registries de verdade
 * (os `config.ts` de cada adapter em `core/adapters/`) — protocolo que ganhe
 * ou perca rede sem atualizar aqui quebra o teste, não o site.
 */
export const COVERAGE = [
  { protocol: "Aerodrome", networks: ["Base"] as readonly string[] },
  {
    protocol: "Velodrome",
    networks: [
      "Optimism",
      "Unichain",
      "Ink",
      "Mode",
      "Soneium",
      "Fraxtal",
      "Lisk",
      "Swell",
      "Metal L2",
      "Superseed",
      "Celo",
    ] as readonly string[],
  },
  {
    protocol: "Uniswap v3",
    networks: ["Base", "Optimism", "Ethereum", "Arbitrum", "Robinhood Chain", "Unichain", "BNB Chain"] as readonly string[],
  },
  { protocol: "Uniswap v4", networks: ["Robinhood Chain"] as readonly string[] },
  { protocol: "PancakeSwap v3", networks: ["BNB Chain"] as readonly string[] },
  { protocol: "Ramses", networks: ["Robinhood Chain", "HyperEVM"] as readonly string[] },
] as const;

/**
 * Redes de UM protocolo. Existe para que uma frase que fale de um protocolo
 * específico ("gauges da Velodrome em…") continue saindo da tabela, e não da
 * memória de quem escreveu — é a mesma regra do `NETWORKS`, um nível abaixo.
 */
export function networksOf(protocol: string): readonly string[] {
  const c = COVERAGE.find((c) => c.protocol === protocol);
  if (!c) throw new Error(`protocolo fora de COVERAGE: ${protocol}`);
  return c.networks;
}

/**
 * "Aerodrome, Velodrome & Uniswap" — as FAMÍLIAS, sem número de versão.
 *
 * Título e meta description precisam citar os protocolos e são curtos demais
 * para caber "Uniswap v3 & v4" (o título já batia no teto de 70 caracteres
 * com uma versão só). Citar a família resolve os dois problemas: cabe, e não
 * envelhece a cada versão nova — que foi exatamente o que aconteceu com os
 * nomes de rede antes do `NETWORKS`.
 */
export const PROTOCOL_FAMILIES: readonly string[] = [
  ...new Set(COVERAGE.map((c) => c.protocol.replace(/ v\d+$/, ""))),
];

/**
 * Famílias por VOLUME negociado, maior primeiro — decide quem sai do título
 * quando ele não cabe em 70 caracteres (regra do Alan, 02/10/2026: em
 * conflito, ficam os protocolos de maior volume). Fonte: DefiLlama,
 * api.llama.fi/overview/dexs, volume de 30 dias em 02/10/2026 — Uniswap
 * US$ 93 bi, PancakeSwap US$ 30 bi, Aerodrome US$ 14 bi, Ramses US$ 3 bi,
 * Velodrome US$ 0,6 bi.
 * Família nova precisa entrar aqui (teste cobra), conferida na mesma fonte.
 */
export const FAMILIES_BY_VOLUME: readonly string[] = ["Uniswap", "PancakeSwap", "Aerodrome", "Ramses", "Velodrome"];

/** "Aerodrome on Base, Velodrome on Optimism, and Uniswap v3 on Base, …" */
export function coverageSentence(locale: Locale = DEFAULT_LOCALE): string {
  const g = GRAMMAR[locale];
  const parts = COVERAGE.map((c) => `${c.protocol} ${g.on} ${humanList(c.networks, "and", locale)}`);
  return `${parts.slice(0, -1).join(", ")}${g.coverageAnd} ${parts[parts.length - 1]}`;
}

/**
 * Frase de "sem token", num lugar só (FAQ da home, /roadmap, llms.txt, README).
 *
 * Existe por causa dos homônimos (GEO, 30/09/2026): ao perguntar "What is
 * trackdefi?", IAs responderam com projetos de nome parecido QUE TÊM token —
 * um deles vivo, na Base. Dizer isto com todas as letras é o que deixa a IA (e
 * o visitante) responder sozinha. É promessa pública e permanente: decidida
 * pelo Alan em 30/09/2026 — não suavizar nem remover sem ele.
 */
export const NO_TOKEN = "No token, no presale, no airdrop.";

/**
 * Domínio definitivo desde 24/07/2026. A Vercel deve ter
 * NEXT_PUBLIC_SITE_URL=https://trackdefi.app (Production) — este valor é só a
 * rede de segurança para quando a variável não estiver setada.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://trackdefi.app").replace(/\/$/, "");
