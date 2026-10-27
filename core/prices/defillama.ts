/**
 * Preços em US$ via DefiLlama (coins.llama.fi — grátis, sem chave).
 * Retorna Map com chave = endereço do token em minúsculas. Token sem preço
 * simplesmente não entra no mapa — quem exibe mostra "—", nunca estima.
 */

import type { Address } from "viem";
import { chunks } from "../util";
import type { PriceProvider } from "./types";

const BASE_URL = "https://coins.llama.fi/prices/current";
const CHUNK = 80; // tokens por requisição (limite prático de URL)

export async function fetchUsdPrices(
  chainSlug: string,
  addresses: readonly Address[],
  onWarn: (msg: string) => void = () => {},
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  /* único por caixa baixa, mas PEDIDO na caixa original: o mint da Solana
     (base58) diferencia maiúscula de minúscula — em caixa baixa a fonte não
     acha o token. A chave do Map devolvido continua em minúsculas. */
  const unique = [...new Map(addresses.map((a) => [a.toLowerCase(), a] as const)).values()];
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

/** A DefiLlama como `PriceProvider` — é o provedor padrão do projeto. */
export const defillamaPrices: PriceProvider = {
  name: "DefiLlama",
  fetchUsdPrices: (chainSlug, addresses, onWarn) => fetchUsdPrices(chainSlug, addresses, onWarn),
};

/**
 * Histórico de preço em US$ (coins.llama.fi/chart), um ponto por hora — é
 * de onde o simulador tira o "tempo na faixa" dos últimos dias. Mesma regra
 * do preço atual: token sem histórico simplesmente não entra no mapa.
 */
export async function fetchUsdPriceHistory(
  chainSlug: string,
  addresses: readonly Address[],
  hours: number,
  onWarn: (msg: string) => void = () => {},
): Promise<Map<string, { t: number; price: number }[]>> {
  const out = new Map<string, { t: number; price: number }[]>();
  if (addresses.length === 0) return out;
  const start = Math.floor(Date.now() / 1000) - hours * 3600;
  const keys = addresses.map((a) => `${chainSlug}:${a}`).join(",");
  try {
    const res = await fetch(`https://coins.llama.fi/chart/${keys}?start=${start}&span=${hours + 1}&period=1h`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { coins?: Record<string, { prices?: { timestamp: number; price: number }[] }> };
    for (const [key, coin] of Object.entries(body.coins ?? {})) {
      const addr = key.split(":")[1]?.toLowerCase();
      const pts = (coin.prices ?? []).filter((p) => Number.isFinite(p.price) && p.price > 0);
      if (addr && pts.length > 0) out.set(addr, pts.map((p) => ({ t: p.timestamp, price: p.price })));
    }
  } catch (e) {
    onWarn(`histórico de preço indisponível: ${(e as Error).message}`);
  }
  return out;
}

/** Limite do POST de market cap: 100 tokens passam, 500 voltam HTTP 400
 *  (medido em 26/10/2026, `poc/probe-descoberta.ts`). */
const MCAP_CHUNK = 100;

/**
 * Market cap em US$ (coins.llama.fi/mcaps). Chaves no formato da DefiLlama,
 * `<rede>:<endereço>`; o Map devolvido usa a chave em minúsculas. Token sem
 * market cap não entra — nunca vira 0.
 */
export async function fetchMarketCaps(
  keys: readonly string[],
  onWarn: (msg: string) => void = () => {},
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const lotes = chunks([...new Set(keys)], MCAP_CHUNK);
  // poucos de cada vez: são dezenas de lotes, e a API é grátis
  for (const grupo of chunks(lotes, 4)) {
    await Promise.all(
      grupo.map(async (lote) => {
        try {
          const res = await fetch("https://coins.llama.fi/mcaps", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ coins: lote }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as Record<string, { mcap?: number }>;
          for (const [k, v] of Object.entries(body)) {
            if (typeof v?.mcap === "number" && Number.isFinite(v.mcap) && v.mcap > 0) out.set(k.toLowerCase(), v.mcap);
          }
        } catch (e) {
          onWarn(`market cap indisponível para um lote de ${lote.length} tokens: ${(e as Error).message}`);
        }
      }),
    );
  }
  return out;
}
