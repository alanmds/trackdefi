/**
 * Simulador de APR — a parte que lê (servidor). Recebe o endereço de um pool
 * e devolve tudo que a conta de `math.ts` precisa, já serializável.
 *
 * O endereço sozinho não diz a rede nem o protocolo: todo adapter que sabe
 * descrever pool (`ProtocolAdapter.describePool`) é perguntado, e cada um só
 * responde se a PRÓPRIA factory devolver aquele endereço. O mesmo endereço
 * pode existir em mais de uma rede (as redes-folha da Velodrome usam
 * factories idênticas), por isso a resposta é uma lista.
 */

import type { Address } from "viem";
import { buildAdapters } from "../adapters/registry";
import { createReader } from "../chain";
import { chainInfo } from "../chains";
import { fetchUsdPriceHistory, fetchUsdPrices } from "../prices/defillama";
import { dexscreenerPrices } from "../prices/dexscreener";
import { tickToPrice0In1 } from "../math/ticks";
import type { PoolSnapshot, ProtocolAdapter } from "../types";
import { readClassicFeeWindows, readPoolFeeGrowthWindows } from "../yields/onchain";
import type { SimPoolDTO } from "./math";

/** dias de histórico para o "tempo na faixa" */
export const HISTORY_HOURS = 7 * 24;
/**
 * Menos pontos que isto = sem "tempo na faixa". A DefiLlama às vezes devolve
 * o histórico picotado (10 pontos num pedido, 167 no seguinte, mesmo par —
 * visto em 26/10/2026 no WHYPE/USD₮0 da HyperEVM), e uma fração tirada de
 * 10 horas soltas não descreve a semana.
 */
export const MIN_HISTORY_POINTS = 72;

const OP_WETH = "0x4200000000000000000000000000000000000006";
const MAINNET_WETH: Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

/** Tira o endereço de um texto colado — endereço puro ou link de explorer/DEX. */
export function extractPoolAddress(text: string): Address | null {
  const m = text.trim().match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/);
  return m ? (m[0] as Address) : null;
}

export async function lookupPool(
  pool: Address,
  adaptersOverride?: ProtocolAdapter[],
  onWarn: (msg: string) => void = () => {},
): Promise<SimPoolDTO[]> {
  const adapters = (adaptersOverride ?? buildAdapters()).filter(
    (a) => (a.addressKind ?? "evm") === "evm" && typeof a.describePool === "function",
  );
  const settled = await Promise.allSettled(adapters.map((a) => a.describePool!(pool)));
  const found: PoolSnapshot[] = [];
  for (const r of settled) if (r.status === "fulfilled" && r.value) found.push(r.value);
  return Promise.all(found.map((s) => enrich(s, onWarn)));
}

async function enrich(s: PoolSnapshot, onWarn: (msg: string) => void): Promise<SimPoolDTO> {
  const info = chainInfo(s.chainId);
  const addrs = [s.token0.address, s.token1.address, ...(s.emission ? [s.emission.token.address] : [])];

  const reader = createReader(s.chainId);
  const [prices, windows, history] = await Promise.all([
    usdPrices(s.chainId, addrs, onWarn),
    (async () => {
      try {
        const bloco = await reader.getBlockNumber?.();
        if (bloco === undefined) return [];
        return s.classic
          ? await readClassicFeeWindows(reader, s.poolAddress, bloco, info.secPerBlock)
          : await readPoolFeeGrowthWindows(reader, s.protocol, s.poolAddress, bloco, info.secPerBlock);
      } catch (e) {
        onWarn(`janelas de taxa ilegíveis: ${(e as Error).message.split("\n")[0].slice(0, 60)}`);
        return [];
      }
    })(),
    // clássico não tem faixa: está sempre "dentro", e o histórico não diz nada
    s.classic ? Promise.resolve(null) : pairHistoryWithRetry(info.priceSlug, s.token0.address, s.token1.address, onWarn),
  ]);

  let p0 = prices.get(s.token0.address.toLowerCase()) ?? null;
  let p1 = prices.get(s.token1.address.toLowerCase()) ?? null;
  /* último recurso, como na carteira: um preço conhecido + o preço do próprio
     pool. Só nos concentrados — no clássico stable a razão das reservas não é
     o preço (a curva não é x·y), então ali não se deduz. */
  const poolPrice = s.classic ? 0 : tickToPrice0In1(s.tick, s.token0.decimals, s.token1.decimals);
  if (p0 === null && p1 !== null && poolPrice > 0) p0 = p1 * poolPrice;
  if (p1 === null && p0 !== null && poolPrice > 0) p1 = p0 / poolPrice;

  const tvlUsd =
    s.reserves && p0 !== null && p1 !== null
      ? (Number(s.reserves.amount0Raw) / 10 ** s.token0.decimals) * p0 +
        (Number(s.reserves.amount1Raw) / 10 ** s.token1.decimals) * p1
      : null;

  return {
    protocol: s.protocol,
    chainId: s.chainId,
    poolAddress: s.poolAddress,
    poolSymbol: s.poolSymbol,
    token0: s.token0,
    token1: s.token1,
    feePips: s.feePips,
    tickSpacing: s.tickSpacing,
    tick: s.tick,
    sqrtPriceX96: s.sqrtPriceX96.toString(),
    activeLiquidity: s.activeLiquidity.toString(),
    price0Usd: p0,
    price1Usd: p1,
    tvlUsd,
    feeWindows: windows.map((w) => ({ delta0: w.delta0.toString(), delta1: w.delta1.toString(), windowSec: w.windowSec })),
    emission: s.emission
      ? {
          token: s.emission.token,
          ratePerSec: s.emission.ratePerSec.toString(),
          sharedLiquidity: s.emission.sharedLiquidity.toString(),
          requiresStake: s.emission.requiresStake,
          ...(s.emission.endedAt !== undefined ? { endedAt: s.emission.endedAt } : {}),
          priceUsd: prices.get(s.emission.token.address.toLowerCase()) ?? null,
        }
      : null,
    history,
    reserves: s.reserves ? { amount0: s.reserves.amount0Raw.toString(), amount1: s.reserves.amount1Raw.toString() } : null,
    ...(s.classic ? { classic: { stable: s.classic.stable, totalSupply: s.classic.totalSupply.toString() } } : {}),
    readAt: Math.floor(Date.now() / 1000),
  };
}

/** Histórico do par; picotado → pede uma vez de novo; ainda picotado → null. */
async function pairHistoryWithRetry(
  slug: string,
  t0: Address,
  t1: Address,
  onWarn: (msg: string) => void,
): Promise<{ t: number; price: number }[] | null> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const h = await fetchUsdPriceHistory(slug, [t0, t1], HISTORY_HOURS, onWarn);
    const par = pairHistory(h.get(t0.toLowerCase()), h.get(t1.toLowerCase()));
    if (par && par.length >= MIN_HISTORY_POINTS) return par;
  }
  return null;
}

/**
 * Preço do par (token1 por token0) a partir dos dois históricos em US$,
 * casando os pontos pela HORA. Hora em que só um dos dois tem ponto fica de
 * fora — nunca se inventa o outro lado.
 */
export function pairHistory(
  h0: { t: number; price: number }[] | undefined,
  h1: { t: number; price: number }[] | undefined,
): { t: number; price: number }[] | null {
  if (!h0 || !h1) return null;
  const hora = (t: number) => Math.round(t / 3600);
  const de1 = new Map(h1.map((p) => [hora(p.t), p.price] as const));
  const out: { t: number; price: number }[] = [];
  for (const p of h0) {
    const q = de1.get(hora(p.t));
    if (q !== undefined && q > 0) out.push({ t: p.t, price: p.price / q });
  }
  return out.length > 0 ? out : null;
}

/** Mesma cadeia de preço da carteira: DefiLlama → DexScreener → WETH = ETH. */
async function usdPrices(chainId: number, addrs: Address[], onWarn: (msg: string) => void): Promise<Map<string, number>> {
  const info = chainInfo(chainId);
  const prices = await fetchUsdPrices(info.priceSlug, addrs, onWarn);
  const faltam = addrs.filter((a) => !prices.has(a.toLowerCase()));
  if (info.dexSlug && faltam.length > 0) {
    const dex = await dexscreenerPrices.fetchUsdPrices(info.dexSlug, faltam, onWarn);
    for (const [a, p] of dex) prices.set(a, p);
  }
  if (info.opStackWeth && addrs.some((a) => a.toLowerCase() === OP_WETH) && !prices.has(OP_WETH)) {
    const eth = (await fetchUsdPrices("ethereum", [MAINNET_WETH], onWarn)).get(MAINNET_WETH.toLowerCase());
    if (eth !== undefined) prices.set(OP_WETH, eth);
  }
  return prices;
}
