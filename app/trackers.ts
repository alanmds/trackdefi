/**
 * Páginas por corretora ("Uniswap position tracker"…) — a lista e o que cada
 * uma cobre, num LUGAR SÓ (12/11/2026).
 *
 * Por que existem: a home fala de todas as corretoras ao mesmo tempo e o
 * Google só a mostrava para buscas genéricas ("defi tracker"). Quem procura
 * "aerodrome position tracker" quer uma página que fale daquela corretora.
 *
 * Regras:
 * - POUCAS páginas, cada uma com assunto próprio. Página por rede ou por
 *   versão, com o mesmo texto trocando um nome, é "doorway page" (punição do
 *   Google). Aerodrome, Velodrome e Aero dividem UMA página: é uma história só.
 * - As redes de cada página saem de `COVERAGE` (app/site.ts) — nunca à mão.
 *   `tests/trackers.test.ts` cobra que todo protocolo citado exista lá.
 * - Os textos moram em `pages.trackers` de cada idioma, com a mesma chave
 *   (`key`) daqui.
 */

import { COVERAGE } from "./site";

export interface TrackerPage {
  /** chave dos textos em `pages.trackers.pages` */
  key: "uniswap" | "aerodrome" | "pancakeswap" | "orca";
  /** caminho público, sem idioma — nunca muda depois de publicado (é URL indexada) */
  slug: string;
  /** protocolos de `COVERAGE` que a página cobre, na ordem da tabela */
  protocols: readonly string[];
  /** endereço de exemplo no campo de busca */
  addressKind: "evm" | "solana";
}

export const TRACKER_PAGES: readonly TrackerPage[] = [
  {
    key: "uniswap",
    slug: "uniswap-position-tracker",
    protocols: ["Uniswap v3", "Uniswap v4", "Uniswap v2"],
    addressKind: "evm",
  },
  {
    key: "aerodrome",
    slug: "aerodrome-position-tracker",
    protocols: ["Aerodrome", "Velodrome", "Aero"],
    addressKind: "evm",
  },
  {
    key: "pancakeswap",
    slug: "pancakeswap-position-tracker",
    protocols: ["PancakeSwap v3", "PancakeSwap v2"],
    addressKind: "evm",
  },
  { key: "orca", slug: "orca-position-tracker", protocols: ["Orca"], addressKind: "solana" },
];

export function trackerBySlug(slug: string): TrackerPage | undefined {
  return TRACKER_PAGES.find((t) => t.slug === slug);
}

/** linhas da tabela "onde lemos": protocolo → redes, direto de `COVERAGE` */
export function trackerCoverage(t: TrackerPage): { protocol: string; networks: readonly string[] }[] {
  return t.protocols.map((protocol) => {
    const c = COVERAGE.find((c) => c.protocol === protocol);
    if (!c) throw new Error(`página ${t.key}: protocolo fora de COVERAGE: ${protocol}`);
    return { protocol, networks: c.networks };
  });
}
