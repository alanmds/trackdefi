/**
 * Conteúdo do `/robots.txt` (servido por `app/robots.txt/route.ts`).
 *
 * Deixou de ser o `app/robots.ts` do Next em 15/11/2026 porque o formato do
 * Next não aceita diretivas novas, e o robots.txt passou a declarar a
 * `Content-Signal` (contentsignals.org): como o conteúdo pode ser usado por
 * buscadores e IAs. Decisão do Alan em 15/11/2026: tudo liberado — o site quer
 * que as IAs o conheçam e o descrevam direito (ver `app/llms.ts`).
 *
 * O resto não mudou: indexa a landing e as páginas institucionais; bloqueia a
 * varredura das páginas de carteira (infinitas, dinâmicas e caras de gerar) e
 * da API — menos o servidor MCP, que existe justamente para agentes.
 */

import { LOCALES, localePath } from "./i18n/config";
import { MCP_PATH } from "./agents";
import { SITE_URL, TOOLS_INDEXED } from "./site";

/** search = buscadores · ai-input = respostas de IA que citam · ai-train = treino de modelos */
export const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";

export function robotsTxt(): string {
  const pages = [
    "/",
    "/how-it-works",
    "/roadmap",
    "/glossary",
    ...(TOOLS_INDEXED ? ["/tools"] : []),
    "/about",
    "/contact",
    "/terms",
  ];
  const allow = LOCALES.flatMap((l) => pages.map((p) => localePath(l.code, p)));
  const disallow = [...LOCALES.map((l) => localePath(l.code, "/w/")), "/api/"];

  return [
    "# Content signals (https://contentsignals.org): search engines may index these pages,",
    "# AI answers may use and cite them, and AI models may be trained on them.",
    "User-Agent: *",
    `Content-Signal: ${CONTENT_SIGNAL}`,
    ...allow.map((p) => `Allow: ${p}`),
    `Allow: ${MCP_PATH}`,
    ...disallow.map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}
