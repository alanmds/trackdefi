/**
 * Perguntas frequentes da home, já preenchidas — SÓ NO SERVIDOR.
 *
 * Usadas em três lugares que não podem divergir: o FAQ visível da home, os
 * dados estruturados `FAQPage` (o Google exige o mesmo conteúdo) e a home em
 * Markdown para agentes (`app/home-markdown.ts`). Os valores que variam
 * (redes, cobertura) saem de `app/site.ts`.
 */

import type { Locale } from "./i18n/config";
import { getMessages } from "./i18n/get";
import { fill } from "./i18n/rich";
import { coverageSentence, humanList, networksOf, networksSentence, SITE_NAME } from "./site";

export function homeFaq(lang: Locale): { q: string; a: string }[] {
  const { pages } = getMessages(lang);
  const vars = {
    name: SITE_NAME,
    networks: networksSentence("and", lang),
    velodromeNetworks: humanList(networksOf("Velodrome"), "and", lang),
    pancakeNetworks: humanList(networksOf("PancakeSwap v3"), "and", lang),
    coverage: coverageSentence(lang),
    noToken: pages.noToken,
  };
  return pages.home.faq.map((f) => ({ q: fill(f.q, vars), a: fill(f.a, vars) }));
}
