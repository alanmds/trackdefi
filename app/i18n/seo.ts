/**
 * Metadados por idioma — SÓ NO SERVIDOR (lê os dicionários de páginas).
 *
 * Aqui mora o que antes era `SITE_TITLE`, `SITE_DESCRIPTION` e
 * `pageMetadata()` de `app/site.ts`. A lógica é a mesma; o que mudou é que
 * tudo recebe o idioma e que cada página agora anuncia a SUA versão em cada
 * idioma (`hreflang`), para o Google mostrar a certa a cada visitante.
 */

import type { Metadata } from "next";
import { humanList, NETWORK_COUNT, NETWORK_NAMES, PROTOCOL_FAMILIES, SITE_NAME } from "../site";
import { DEFAULT_LOCALE, localeInfo, LOCALES, localePath, type Locale } from "./config";
import { fill } from "./rich";
import { getMessages } from "./get";

/** título da home (≤ 70 caracteres p/ não truncar no Google) */
export function siteTitle(locale: Locale): string {
  return fill(getMessages(locale).pages.meta.siteTitle, {
    name: SITE_NAME,
    families: humanList(PROTOCOL_FAMILIES, "&", locale),
  });
}

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
export function siteDescription(locale: Locale): string {
  return fill(getMessages(locale).pages.meta.siteDescription, {
    families: humanList(PROTOCOL_FAMILIES, "&", locale),
    count: NETWORK_COUNT,
  });
}

export function siteKeywords(locale: Locale): string[] {
  const m = getMessages(locale).pages.meta;
  return [
    ...m.keywordsBase,
    ...NETWORK_NAMES.map((network) => fill(m.keywordNetwork, { network })),
    ...m.keywordsExtra,
  ];
}

/** sufixo do título, igual ao template do layout (`%s — trackdefi`) */
const titleFor = (locale: Locale, title?: string) => (title ? `${title} — ${SITE_NAME}` : siteTitle(locale));

/**
 * Card de compartilhamento, gerado por `app/[lang]/opengraph-image.tsx` — um
 * por idioma, com o texto no idioma. No inglês a URL continua `/opengraph-image`
 * (o proxy a reescreve), então links já compartilhados seguem valendo.
 *
 * Precisa ser declarado AQUI, e não só pelo arquivo: o Next atribui a imagem
 * do arquivo aos metadados do segmento, mas uma página que declara o próprio
 * `openGraph` substitui o objeto inteiro — e leva a imagem junto. Foi o que
 * aconteceu em 25/07/2026: só a home saía com imagem.
 */
export function ogImage(locale: Locale) {
  return {
    url: localePath(locale, "/opengraph-image"),
    width: 1200,
    height: 630,
    alt: fill(getMessages(locale).pages.meta.ogAlt, { name: SITE_NAME }),
  };
}

/** `{ "en": "/roadmap", "pt-BR": "/pt-br/roadmap", "x-default": "/roadmap" }` */
function languageAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[l.htmlLang] = localePath(l.code, path);
  out["x-default"] = localePath(DEFAULT_LOCALE, path);
  return out;
}

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
 * um dizendo uma coisa e o outro dizendo outra é sinal contraditório. E que
 * cada página aponte para as suas irmãs nos outros idiomas (hreflang) — o
 * vínculo precisa ser de mão dupla, e como todas as páginas passam por aqui,
 * é.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale;
  /** caminho no site SEM idioma, começando com "/" — vira canonical e og:url */
  path: string;
  /** título da página; omitir na home (usa o título padrão do site) */
  title?: string;
  /** descrição da página; omitir usa a do site */
  description?: string;
}): Metadata {
  const full = titleFor(locale, title);
  const desc = description ?? siteDescription(locale);
  const url = localePath(locale, path);
  const info = localeInfo(locale);
  const image = ogImage(locale);
  return {
    ...(title ? { title } : {}),
    description: desc,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      title: full,
      description: desc,
      siteName: SITE_NAME,
      type: "website",
      url,
      locale: info.ogLocale,
      alternateLocale: LOCALES.filter((l) => l.code !== locale).map((l) => l.ogLocale),
      images: [image],
    },
    twitter: { card: "summary_large_image", title: full, description: desc, images: [image] },
  };
}
