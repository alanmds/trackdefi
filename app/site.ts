/**
 * Identidade do site num LUGAR SÓ (estratégia anti-retrabalho de SEO):
 * quando o domínio definitivo e/ou o nome mudarem, editar AQUI (e setar
 * NEXT_PUBLIC_SITE_URL na Vercel) — todos os metadados, canonicals,
 * sitemap e dados estruturados se atualizam sozinhos. Ver privado/SEO.md.
 */

export const SITE_NAME = "trackdefi";

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
] as const;

/** nomes por extenso, na ordem de exibição */
export const NETWORK_NAMES: readonly string[] = NETWORKS.map((n) => n.name);

/** quantas redes o site cobre — usar isto em vez de digitar o número */
export const NETWORK_COUNT = NETWORKS.length;

/** "A, B and C" (ou "A, B & C") — sem vírgula de Oxford, como o resto do site */
export function humanList(items: readonly string[], last: "and" | "&" = "and"): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`;
}

/** "Base, Optimism, Ethereum, Arbitrum and Robinhood Chain" */
export function networksSentence(last: "and" | "&" = "and"): string {
  return humanList(NETWORK_NAMES, last);
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
    networks: ["Optimism", "Unichain", "Ink", "Mode", "Soneium", "Fraxtal"] as readonly string[],
  },
  {
    protocol: "Uniswap v3",
    networks: ["Base", "Optimism", "Ethereum", "Arbitrum", "Robinhood Chain"] as readonly string[],
  },
  { protocol: "Uniswap v4", networks: ["Robinhood Chain"] as readonly string[] },
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

/** "Aerodrome on Base, Velodrome on Optimism, and Uniswap v3 on Base, …" */
export function coverageSentence(): string {
  const parts = COVERAGE.map((c) => `${c.protocol} on ${humanList(c.networks)}`);
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/**
 * Domínio definitivo desde 24/07/2026. A Vercel deve ter
 * NEXT_PUBLIC_SITE_URL=https://trackdefi.app (Production) — este valor é só a
 * rede de segurança para quando a variável não estiver setada.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://trackdefi.app").replace(/\/$/, "");

/** título da home (≤ 70 caracteres p/ não truncar no Google) */
export const SITE_TITLE = `${SITE_NAME} — Liquidity Pool Tracker · ${humanList(PROTOCOL_FAMILIES, "&")}`;

/**
 * Descrição da home (limite ~160 caracteres, guardado por teste).
 *
 * Conta as redes em vez de listá-las de propósito. Listar obrigava a escolher
 * quais três cabiam — e a primeira da lista era sempre a Base, por acaso
 * histórico de ter sido a rede inicial. O número nunca envelhece, não
 * privilegia rede nenhuma e libera espaço para o diferencial (posição em
 * stake). Os NOMES continuam no corpo das páginas, que é onde o Google os lê
 * para ranquear — a meta description só decide a aparência do resultado.
 */
export const SITE_DESCRIPTION = `Free LP tracker: paste a wallet address to see every ${humanList(PROTOCOL_FAMILIES, "&")} position across ${NETWORK_COUNT} networks — gauge-staked ones included.`;

/** sufixo do título, igual ao template do layout (`%s — trackdefi`) */
const titleFor = (title?: string) => (title ? `${title} — ${SITE_NAME}` : SITE_TITLE);

/**
 * Card de compartilhamento, gerado por `app/opengraph-image.tsx`.
 *
 * Precisa ser declarado AQUI, e não só pelo arquivo: o Next atribui a imagem
 * do arquivo aos metadados do segmento, mas uma página que declara o próprio
 * `openGraph` substitui o objeto inteiro — e leva a imagem junto. Foi o que
 * aconteceu em 25/07/2026: só a home saía com imagem.
 */
const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — liquidity pool tracker`,
};

/**
 * Metadados de UMA página. Toda página do site deve usar isto.
 *
 * Existe porque o Next **substitui o objeto `openGraph`/`twitter` inteiro**
 * quando uma página o redefine — não faz merge campo a campo. Sem este helper,
 * uma página que só quisesse acertar o `og:url` perderia description,
 * site_name e type herdados do layout; e uma página que não mexe em nada
 * herda o card da HOME (foi o que aconteceu até 25/07/2026: `/how-it-works` e
 * `/roadmap` se anunciavam no X/Discord com o título, a descrição e a URL da
 * home).
 *
 * Garante também que **canonical e og:url apontem sempre para o mesmo lugar**:
 * um dizendo uma coisa e o outro dizendo outra é sinal contraditório.
 */
export function pageMetadata({
  path,
  title,
  description,
}: {
  /** caminho no site começando com "/" — vira canonical e og:url */
  path: string;
  /** título da página; omitir na home (usa o título padrão do site) */
  title?: string;
  /** descrição da página; omitir usa a do site */
  description?: string;
}): import("next").Metadata {
  const full = titleFor(title);
  const desc = description ?? SITE_DESCRIPTION;
  return {
    ...(title ? { title } : {}),
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title: full,
      description: desc,
      siteName: SITE_NAME,
      type: "website",
      url: path,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: full, description: desc, images: [OG_IMAGE] },
  };
}
