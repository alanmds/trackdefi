/**
 * Preços em US$ via DexScreener (api.dexscreener.com — grátis, sem chave).
 * SEGUNDA fonte, desde 27/09/2026: só é consultada para os tokens que a
 * DefiLlama não cobre, e só nas redes que a DexScreener indexa
 * (`ChainInfo.dexSlug`). Pedido do Alan: "mostre o melhor preço que
 * conseguir". PoC: poc/probe-precos-alternativos.ts (WETH dela bate com o ETH
 * da DefiLlama a 0,2%).
 *
 * O preço é o do par MAIS LÍQUIDO do token — é o preço de mercado de verdade.
 * Sem piso de liquidez: regra do Alan, preço como está no mercado, nunca
 * escondido nem "corrigido".
 */

import type { Address } from "viem";
import { chunks } from "../util";
import type { PriceProvider } from "./types";

const BASE_URL = "https://api.dexscreener.com/tokens/v1";
const CHUNK = 30; // limite de endereços por requisição da API

export interface DexPair {
  baseToken: { address: string };
  quoteToken: { address: string };
  /** preço do BASE em US$ */
  priceUsd?: string;
  /** preço do BASE em unidades do QUOTE */
  priceNative?: string;
  liquidity?: { usd?: number };
}

/**
 * Puro e testável: dos pares devolvidos, o preço em US$ de cada token pedido,
 * pelo par mais líquido que o contém — seja ele o base ou o quote do par.
 */
export function pricesFromPairs(pairs: readonly DexPair[], wanted: readonly string[]): Map<string, number> {
  const best = new Map<string, { liq: number; usd: number }>();
  const alvo = new Set(wanted.map((a) => a.toLowerCase()));
  for (const p of pairs) {
    const baseUsd = Number(p.priceUsd);
    const native = Number(p.priceNative);
    const liq = p.liquidity?.usd ?? 0;
    if (!Number.isFinite(baseUsd) || baseUsd <= 0) continue;
    const base = p.baseToken.address.toLowerCase();
    const quote = p.quoteToken.address.toLowerCase();
    const candidatos: [string, number][] = [];
    if (alvo.has(base)) candidatos.push([base, baseUsd]);
    // quote em US$ = base em US$ ÷ (base em quote)
    if (alvo.has(quote) && Number.isFinite(native) && native > 0) candidatos.push([quote, baseUsd / native]);
    for (const [addr, usd] of candidatos) {
      const atual = best.get(addr);
      if (!atual || liq > atual.liq) best.set(addr, { liq, usd });
    }
  }
  return new Map([...best].map(([a, v]) => [a, v.usd]));
}

export async function fetchUsdPrices(
  dexSlug: string,
  addresses: readonly Address[],
  onWarn: (msg: string) => void = () => {},
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  for (const group of chunks(unique, CHUNK)) {
    try {
      const res = await fetch(`${BASE_URL}/${dexSlug}/${group.join(",")}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as DexPair[];
      for (const [a, usd] of pricesFromPairs(Array.isArray(body) ? body : [], group)) out.set(a, usd);
    } catch (e) {
      onWarn(`DexScreener: preços indisponíveis para um lote de ${group.length} tokens: ${(e as Error).message}`);
    }
  }
  return out;
}

export const dexscreenerPrices: PriceProvider = {
  name: "DexScreener",
  fetchUsdPrices: (dexSlug, addresses, onWarn) => fetchUsdPrices(dexSlug, addresses, onWarn),
};
