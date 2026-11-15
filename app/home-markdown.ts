/**
 * A home em Markdown, para agentes de IA — SÓ NO SERVIDOR.
 *
 * Servida em `/index.md` e no próprio `/` quando o agente pede
 * `Accept: text/markdown` (ver `proxy.ts`). Markdown custa uma fração dos
 * tokens do HTML, e o agente lê o mesmo conteúdo: a ficha de fatos do
 * `llms.txt` (o que o site é, cobertura, o que não faz, páginas) mais o FAQ
 * da home — o mesmo que a página mostra.
 *
 * Só em inglês, como o `llms.txt`.
 */

import { DEFAULT_LOCALE } from "./i18n/config";
import { stripTags } from "./i18n/rich";
import { homeFaq } from "./home-faq";
import { llmsTxt } from "./llms";

export function homeMarkdown(): string {
  const faq = homeFaq(DEFAULT_LOCALE)
    .map((f) => `### ${stripTags(f.q)}\n\n${stripTags(f.a)}`)
    .join("\n\n");
  return `${llmsTxt().trimEnd()}\n\n## Frequently asked questions\n\n${faq}\n`;
}
