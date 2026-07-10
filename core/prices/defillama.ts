/**
 * Preços em US$ via DefiLlama (coins.llama.fi — grátis, sem chave).
 * Retorna Map com chave = endereço do token em minúsculas. Token sem preço
 * simplesmente não entra no mapa — quem exibe mostra "—", nunca estima.
 */

import type { Address } from "viem";
import { chunks } from "../util";

const BASE_URL = "https://coins.llama.fi/prices/current";
const CHUNK = 80; // tokens por requisição (limite prático de URL)

export async function fetchUsdPrices(
  chainSlug: string,
  addresses: readonly Address[],
  onWarn: (msg: string) => void = () => {},
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  for (const group of chunks(unique, CHUNK)) {
    const keys = group.map((a) => `${chainSlug}:${a}`).join(",");
    try {
      const res = await fetch(`${BASE_URL}/${keys}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { coins?: Record<string, { price?: number }> };
      for (const [key, coin] of Object.entries(body.coins ?? {})) {
        const addr = key.split(":")[1]?.toLowerCase();
        if (addr && coin.price !== undefined && Number.isFinite(coin.price)) {
          out.set(addr, coin.price);
        }
      }
    } catch (e) {
      onWarn(`preços indisponíveis para um lote de ${group.length} tokens: ${(e as Error).message}`);
    }
  }
  return out;
}
