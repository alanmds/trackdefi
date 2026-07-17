/**
 * Camada de serviço: compõe adapter + preços e entrega um DTO pronto para a
 * UI e para a API — valores em US$ já calculados no servidor, nada de bigint
 * (tudo serializável em JSON; quantidades cruas vão como string).
 *
 * Regra de preço (igual à validada pelo Alan na CLI): o valor de uma posição
 * só existe se AMBOS os tokens têm preço; senão é null e conta como
 * "posição sem preço" — nunca estimamos.
 */

import { formatUnits, type Address } from "viem";
import type { LpPosition, PositionKind, ProtocolAdapter } from "./types";
import { buildAdapters } from "./adapters/registry";
import { chainInfo } from "./chains";
import { fetchUsdPrices } from "./prices/defillama";
import { getYieldsIndex, type YieldsIndex } from "./yields/defillama";
import { orientRange } from "./math/ticks";

export interface TokenAmountDTO {
  symbol: string;
  address: string;
  decimals: number;
  amountRaw: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
}

export interface RewardDTO {
  symbol: string;
  address: string;
  kind: "fee" | "emission";
  amountRaw: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
}

export interface RangeDTO {
  inRange: boolean;
  /** true = preços exibidos como token0/token1 (direção invertida p/ legibilidade) */
  inverted: boolean;
  lower: number;
  upper: number;
  current: number;
  /** rótulo do par na direção exibida, ex.: "USDC/WETH" */
  quoteLabel: string;
}

/** APR do POOL (propriedade do pool, não ganho pessoal) — fonte externa */
export interface AprDTO {
  current: number;
  base: number | null;
  reward: number | null;
  mean30d: number | null;
  source: string;
}

export interface PositionDTO {
  protocol: string;
  chainId: number;
  poolAddress: string;
  poolSymbol: string;
  kind: PositionKind;
  positionId: string | null;
  staked: boolean;
  managedByAlm: string | null;
  token0: TokenAmountDTO;
  token1: TokenAmountDTO;
  rewards: RewardDTO[];
  valueUsd: number | null;
  rewardsUsd: number | null;
  range: RangeDTO | null;
  /** null = sem dado confiável (UI mostra "—"); nunca chutamos */
  apr: AprDTO | null;
}

export interface PositionsResponseDTO {
  address: string;
  /** redes varridas nesta resposta (cada posição diz a sua via chainId) */
  chains: string[];
  /** protocolos varridos nesta resposta (cada posição diz o seu) */
  protocols: string[];
  fetchedAt: string;
  scanMs: number;
  totals: {
    valueUsd: number;
    rewardsUsd: number;
    positionsWithoutPrice: number;
  };
  /** total real de posições; `positions` traz no máximo as top N por valor */
  totalPositions: number;
  positions: PositionDTO[];
  warnings: string[];
}

/** Carteiras-lixeira acumulam dezenas de milhares de posições de spam
 * (achado da Fase 5: 0x…0001 tem 27.786). Resposta traz só as top N por
 * valor — os TOTAIS continuam calculados sobre todas. */
const MAX_POSITIONS_IN_RESPONSE = 200;

function human(raw: bigint, decimals: number): number {
  return Number(formatUnits(raw, decimals));
}

/** chave de preço multi-rede: o MESMO endereço pode existir em duas chains
 * (ex.: WETH é 0x4200…0006 na Base E na Optimism) → chave = chainId:endereço */
export function priceKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function priceOf(prices: Map<string, number>, chainId: number, address: string): number | null {
  const p = prices.get(priceKey(chainId, address));
  return p === undefined ? null : p;
}

/** Puro: posições normalizadas + preços → DTO. Testável offline. */
export function buildResponse(params: {
  address: string;
  normalized: LpPosition[];
  prices: Map<string, number>;
  scanMs: number;
  warnings: string[];
  maxPositions?: number;
  protocols?: string[];
  chains?: string[];
  yields?: YieldsIndex | null;
}): PositionsResponseDTO {
  const {
    address,
    normalized,
    prices,
    scanMs,
    warnings,
    maxPositions = MAX_POSITIONS_IN_RESPONSE,
    protocols = ["aerodrome"],
    chains = ["base"],
    yields = null,
  } = params;

  const positions: PositionDTO[] = normalized.map((p) => {
    const p0 = priceOf(prices, p.chainId, p.token0.address);
    const p1 = priceOf(prices, p.chainId, p.token1.address);
    const a0 = human(p.amount0Raw, p.token0.decimals);
    const a1 = human(p.amount1Raw, p.token1.decimals);
    const v0 = p0 !== null ? a0 * p0 : null;
    const v1 = p1 !== null ? a1 * p1 : null;
    const valueUsd = v0 !== null && v1 !== null ? v0 + v1 : null;

    const rewards: RewardDTO[] = p.rewards.map((r) => {
      const pr = priceOf(prices, p.chainId, r.token.address);
      const amt = human(r.raw, r.token.decimals);
      return {
        symbol: r.token.symbol,
        address: r.token.address,
        kind: r.kind,
        amountRaw: r.raw.toString(),
        amount: amt,
        priceUsd: pr,
        valueUsd: pr !== null ? amt * pr : null,
      };
    });
    const rewardsComplete = rewards.every((r) => r.valueUsd !== null);
    const rewardsUsd = rewardsComplete ? rewards.reduce((s, r) => s + (r.valueUsd ?? 0), 0) : null;

    let range: RangeDTO | null = null;
    if (p.range) {
      const o = orientRange(p.range.priceLower, p.range.priceUpper, p.range.priceCurrent);
      range = {
        inRange: p.range.inRange,
        inverted: o.inverted,
        lower: o.lower,
        upper: o.upper,
        current: o.current,
        quoteLabel: o.inverted
          ? `${p.token0.symbol}/${p.token1.symbol}`
          : `${p.token1.symbol}/${p.token0.symbol}`,
      };
    }

    return {
      protocol: p.protocol,
      chainId: p.chainId,
      poolAddress: p.poolAddress,
      poolSymbol: p.poolSymbol,
      kind: p.kind,
      positionId: p.positionId,
      staked: p.staked,
      managedByAlm: p.managedByAlm,
      token0: {
        symbol: p.token0.symbol,
        address: p.token0.address,
        decimals: p.token0.decimals,
        amountRaw: p.amount0Raw.toString(),
        amount: a0,
        priceUsd: p0,
        valueUsd: v0,
      },
      token1: {
        symbol: p.token1.symbol,
        address: p.token1.address,
        decimals: p.token1.decimals,
        amountRaw: p.amount1Raw.toString(),
        amount: a1,
        priceUsd: p1,
        valueUsd: v1,
      },
      rewards,
      valueUsd,
      rewardsUsd,
      range,
      apr: yields
        ? (() => {
            const m = yields.match({
              chainId: p.chainId,
              protocol: p.protocol,
              kind: p.kind,
              poolSymbol: p.poolSymbol,
              token0: p.token0.address,
              token1: p.token1.address,
            });
            return m
              ? { current: m.current, base: m.base, reward: m.reward, mean30d: m.mean30d, source: m.source }
              : null;
          })()
        : null,
    };
  });

  // totais sobre TODAS as posições, antes de qualquer corte
  const totals = {
    valueUsd: positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0),
    rewardsUsd: positions.reduce((s, p) => s + (p.rewardsUsd ?? 0), 0),
    positionsWithoutPrice: positions.filter((p) => p.valueUsd === null).length,
  };

  // maiores valores primeiro; sem preço por último
  positions.sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1));

  return {
    address,
    chains,
    protocols,
    fetchedAt: new Date().toISOString(),
    scanMs,
    totals,
    totalPositions: positions.length,
    positions: positions.length > maxPositions ? positions.slice(0, maxPositions) : positions,
    warnings,
  };
}

/**
 * Orquestração: roda TODOS os adapters do registry em paralelo, agrega,
 * busca preços e monta o DTO. Falha de um protocolo vira warning (resposta
 * parcial); só falha tudo se TODOS os protocolos falharem.
 */
export async function getWalletPositions(
  address: Address,
  adaptersOverride?: ProtocolAdapter[],
): Promise<PositionsResponseDTO> {
  const warnings: string[] = [];
  const adapters = adaptersOverride ?? buildAdapters({ onWarn: (m) => warnings.push(m) });

  const t0 = Date.now();
  // APR (DefiLlama) baixa em paralelo com a varredura on-chain; falha vira "—"
  const yieldsPromise = getYieldsIndex((m) => warnings.push(m));
  const settled = await Promise.allSettled(adapters.map((a) => a.getPositions(address)));
  const scanMs = Date.now() - t0;

  const normalized: LpPosition[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") normalized.push(...r.value);
    else
      warnings.push(
        `${adapters[i].protocol}@${chainInfo(adapters[i].chainId).label} indisponível: ${(r.reason as Error)?.message?.split("\n")[0] ?? "erro"}`,
      );
  });
  if (settled.length > 0 && settled.every((r) => r.status === "rejected")) {
    throw new Error(`todos os protocolos falharam: ${warnings.join(" | ")}`);
  }

  // preços por rede (o mesmo endereço pode existir em mais de uma chain)
  const byChain = new Map<number, Set<string>>();
  for (const p of normalized) {
    const set = byChain.get(p.chainId) ?? new Set<string>();
    set.add(p.token0.address);
    set.add(p.token1.address);
    for (const r of p.rewards) set.add(r.token.address);
    byChain.set(p.chainId, set);
  }
  const prices = new Map<string, number>();
  await Promise.all(
    [...byChain.entries()].map(async ([chainId, addrs]) => {
      const slug = chainInfo(chainId).priceSlug;
      const chainPrices = await fetchUsdPrices(slug, [...addrs] as Address[], (m) => warnings.push(m));
      for (const [addr, price] of chainPrices) prices.set(priceKey(chainId, addr), price);
    }),
  );

  return buildResponse({
    address,
    normalized,
    prices,
    scanMs,
    warnings,
    protocols: [...new Set(adapters.map((a) => a.protocol))],
    chains: [...new Set(adapters.map((a) => chainInfo(a.chainId).priceSlug))],
    yields: await yieldsPromise,
  });
}
