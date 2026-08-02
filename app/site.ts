/**
 * Identidade do site num LUGAR SÓ (estratégia anti-retrabalho de SEO):
 * quando o domínio definitivo e/ou o nome mudarem, editar AQUI (e setar
 * NEXT_PUBLIC_SITE_URL na Vercel) — todos os metadados, canonicals,
 * sitemap e dados estruturados se atualizam sozinhos. Ver privado/SEO.md.
 */

export const SITE_NAME = "trackdefi";

/**
 * Domínio definitivo desde 24/07/2026. A Vercel deve ter
 * NEXT_PUBLIC_SITE_URL=https://trackdefi.app (Production) — este valor é só a
 * rede de segurança para quando a variável não estiver setada.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://trackdefi.app").replace(/\/$/, "");

/** título da home (≤ 70 caracteres p/ não truncar no Google) */
export const SITE_TITLE = `${SITE_NAME} — Liquidity Pool Tracker · Aerodrome, Velodrome & Uniswap v3`;

/** descrição da home (~160 caracteres) — "& more" absorve rede nova sem
 *  estourar o limite do Google a cada expansão */
export const SITE_DESCRIPTION =
  "Free LP tracker: paste a wallet address to see every Aerodrome, Velodrome & Uniswap v3 position across Base, Optimism, Robinhood Chain & more — staked included.";

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
