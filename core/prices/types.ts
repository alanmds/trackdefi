/**
 * Contrato de uma fonte de preços — mesma ideia do `ProtocolAdapter`:
 * o motor não sabe de quem vem o preço.
 *
 * Existe porque a DefiLlama era importada DIRETO no `service.ts`, e trocar de
 * provedor exigiria cirurgia. Com esta interface, provedor novo = arquivo
 * novo (`core/prices/<nome>.ts`) que implementa isto, e uma linha no
 * `service.ts`. Ver Receita H no PLAYBOOK.
 *
 * Regra que todo provedor herda: **token sem preço confiável simplesmente não
 * entra no Map**. Nunca estimar, nunca devolver 0 — quem exibe mostra "—".
 */

import type { Address } from "viem";

export interface PriceProvider {
  /** nome curto p/ log e rótulo de origem (ex.: "DefiLlama") */
  readonly name: string;
  /**
   * Preços em US$ dos tokens de UMA rede.
   * @param chainSlug identificador da rede no provedor (`ChainInfo.priceSlug`)
   * @returns Map com chave = endereço em MINÚSCULAS. Ausente = sem preço.
   */
  fetchUsdPrices(
    chainSlug: string,
    addresses: readonly Address[],
    onWarn?: (msg: string) => void,
  ): Promise<Map<string, number>>;
}
