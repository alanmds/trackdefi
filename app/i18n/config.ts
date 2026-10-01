/**
 * Idiomas do site — a lista e as regras de URL, num LUGAR SÓ.
 *
 * Este arquivo é pequeno de propósito: componentes de navegador o importam, e
 * os textos (que pesam) ficam em `messages/<idioma>/`, carregados só pelo
 * servidor (`get.ts`) ou entregues já recortados ao navegador (`provider.tsx`).
 *
 * COMO ADICIONAR UM IDIOMA (ver também CLAUDE.md, "Idiomas"):
 * 1. acrescentar uma linha em `LOCALES` (aqui);
 * 2. criar `messages/<código>/` com `ui.ts`, `pages.ts`, `changelog.ts` — o
 *    TypeScript e `tests/i18n.test.ts` apontam o que falta;
 * 3. registrar em `get.ts`.
 * Nada mais: rotas, sitemap, hreflang e seletor de idioma saem desta lista.
 *
 * O inglês é o idioma PADRÃO e fica SEM prefixo na URL (`/roadmap`), para as
 * URLs já indexadas não mudarem. Os demais ficam sob o código (`/pt-br/roadmap`).
 */

export interface LocaleInfo {
  /** segmento da URL, em minúsculas (`pt-br`) */
  code: string;
  /** valor de `<html lang>` e do hreflang (BCP 47: `pt-BR`) */
  htmlLang: string;
  /** `og:locale` (`pt_BR`) */
  ogLocale: string;
  /** o nome do idioma NELE MESMO — é o que o seletor mostra */
  native: string;
  /** rótulo curto do seletor ("EN", "PT") */
  short: string;
  /** locale do `Intl` para números e moeda */
  intl: string;
  /** texto da direita para a esquerda (árabe, hebraico…) */
  rtl?: boolean;
}

export const LOCALES = [
  { code: "en", htmlLang: "en", ogLocale: "en_US", native: "English", short: "EN", intl: "en-US" },
  { code: "pt-br", htmlLang: "pt-BR", ogLocale: "pt_BR", native: "Português (Brasil)", short: "PT", intl: "pt-BR" },
] as const satisfies readonly LocaleInfo[];

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_CODES: readonly Locale[] = LOCALES.map((l) => l.code);

export function isLocale(x: string | undefined | null): x is Locale {
  return !!x && (LOCALE_CODES as readonly string[]).includes(x);
}

export function localeInfo(locale: Locale): LocaleInfo {
  return LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
}

/**
 * Caminho PÚBLICO de uma página: `localePath("pt-br", "/roadmap")` →
 * `/pt-br/roadmap`; no idioma padrão, `/roadmap`. Todo link interno do site
 * passa por aqui — link escrito à mão leva o visitante de volta ao inglês.
 */
export function localePath(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return p;
  return p === "/" ? `/${locale}` : `/${locale}${p}`;
}

/**
 * O inverso: separa o idioma do restante de um caminho. Aceita também o
 * caminho INTERNO do inglês (`/en/roadmap`), porque `usePathname()` pode
 * devolver a URL já reescrita pelo proxy, e não a do navegador.
 */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (isLocale(first)) return { locale: first, path: `/${rest.join("/")}` };
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/**
 * Pequena gramática de frases montadas por código (listas de redes, "X on Y").
 * Fica aqui, e não no dicionário, porque `app/site.ts` precisa dela e é
 * importado por componentes de navegador.
 */
export interface Grammar {
  /** "A, B and C" */
  and: string;
  /** conector do `humanList(…, "&")` */
  amp: string;
  /** "Aerodrome on Base" */
  on: string;
  /** junção do último item da frase de cobertura: "…, and Uniswap v3 on Base" */
  coverageAnd: string;
}

export const GRAMMAR: Record<Locale, Grammar> = {
  en: { and: "and", amp: "&", on: "on", coverageAnd: ", and" },
  "pt-br": { and: "e", amp: "&", on: "em", coverageAnd: " e" },
};
