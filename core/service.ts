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
import { defillamaPrices } from "./prices/defillama";
import type { PriceProvider } from "./prices/types";
import { getYieldsIndex, type YieldsIndex } from "./yields/defillama";
import { computeEarning } from "./yields/positionApr";
import { computeOnchainFeeApr, readFeeGrowthWindow, DEFAULT_WINDOW_HOURS, type FeeGrowthWindow } from "./yields/onchain";
import { createReader } from "./chain";
import { mapLimit } from "./util";
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

/** APR "rendendo agora" da POSIÇÃO (Receita C2) — 0 fora do range; null = "—" */
export interface EarningDTO {
  /** taxas + emissões que ESTA posição rende agora; 0 fora do range */
  nowPct: number;
  /** componente de taxas de swap; null = sem dado confiável */
  feePct: number | null;
  /** componente de emissões do gauge (staked); null = não se aplica */
  emissionPct: number | null;
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
  /** APR "rendendo agora" da posição (Receita C2); null = "—" ou não se aplica */
  earning: EarningDTO | null;
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
  /** janelas de feeGrowth por `chainId:pool` — fee APR medido no contrato
   *  (Receita G). Ausente = cai no apyBase da DefiLlama. */
  feeWindows?: Map<string, FeeGrowthWindow>;
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
    feeWindows,
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

    // APR do POOL (DefiLlama) — casa uma vez; reusado no "rendendo agora"
    const m = yields
      ? yields.match({
          chainId: p.chainId,
          protocol: p.protocol,
          kind: p.kind,
          poolSymbol: p.poolSymbol,
          token0: p.token0.address,
          token1: p.token1.address,
        })
      : null;
    const apr: AprDTO | null = m
      ? { current: m.current, base: m.base, reward: m.reward, mean30d: m.mean30d, source: m.source }
      : null;

    // APR "rendendo agora" da POSIÇÃO (Receita C2) — só concentradas
    let earning: EarningDTO | null = null;
    if (p.range) {
      const ei = p.earningInputs;
      const emToken = ei?.emissionToken ?? null;
      // taxas medidas NO CONTRATO quando houver janela (Receita G)
      const win = feeWindows?.get(`${p.chainId}:${p.poolAddress.toLowerCase()}`);
      const onchainFeeAprPct = win
        ? computeOnchainFeeApr({
            delta0: win.delta0,
            delta1: win.delta1,
            posLiquidity: ei?.liquidity ?? null,
            windowSec: win.windowSec,
            decimals0: p.token0.decimals,
            decimals1: p.token1.decimals,
            price0Usd: p0,
            price1Usd: p1,
            positionValueUsd: valueUsd,
          })
        : null;
      earning = computeEarning({
        inRange: p.range.inRange,
        onchainFeeAprPct,
        valueUsd,
        poolFeeAprPct: m?.base ?? null,
        poolTvlUsd: m?.tvlUsd ?? null,
        posLiquidity: ei?.liquidity ?? null,
        activeLiquidity: ei?.activeLiquidity ?? null,
        staked: p.staked,
        rewardRatePerSec: ei?.emissionRatePerSec ?? null,
        posStakedLiquidity: ei?.stakedLiquidity ?? null,
        poolStakedLiquidity: ei?.poolStakedLiquidity ?? null,
        emissionPriceUsd: emToken ? priceOf(prices, p.chainId, emToken.address) : null,
        emissionDecimals: emToken?.decimals ?? 18,
      });
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
      apr,
      earning,
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
  /** fonte de preços; trocar de provedor não toca em mais nada (Receita H) */
  priceProvider: PriceProvider = defillamaPrices,
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
    // token de emissão do gauge: pode não estar nos rewards (0 pendente) e é
    // necessário para o APR de emissões "rendendo agora"
    if (p.earningInputs?.emissionToken) set.add(p.earningInputs.emissionToken.address);
    byChain.set(p.chainId, set);
  }
  const prices = new Map<string, number>();
  await Promise.all(
    [...byChain.entries()].map(async ([chainId, addrs]) => {
      const slug = chainInfo(chainId).priceSlug;
      const chainPrices = await priceProvider.fetchUsdPrices(slug, [...addrs] as Address[], (m) => warnings.push(m));
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
    feeWindows: await readFeeWindows(normalized, (m) => warnings.push(m)),
  });
}

/** teto de pools consultados por varredura — carteira-lixeira não pode
 *  transformar isto em centenas de chamadas de arquivo */
export const MAX_FEE_APR_POOLS = 40;

/**
 * Lê as janelas de feeGrowth dos pools concentrados (Receita G).
 *
 * NADA aqui pode derrubar a varredura: sem RPC com arquivo, o resultado é um
 * mapa vazio e o APR volta a sair da DefiLlama. Por isso tudo está dentro de
 * try/catch e o teto acima existe.
 */
/**
 * Protocolos cujo `poolAddress` NÃO é um pool no estilo v3 e portanto não
 * respondem às leituras do fee APR on-chain. Medir ali não é "dado faltando",
 * é pergunta sem sentido — some do cálculo sem virar aviso.
 */
const SEM_FEE_APR_ONCHAIN = new Set(["uniswap-v4"]);

async function readFeeWindows(
  positions: LpPosition[],
  onWarn: (msg: string) => void,
): Promise<Map<string, FeeGrowthWindow>> {
  const out = new Map<string, FeeGrowthWindow>();
  const porRede = new Map<number, Set<string>>();
  for (const p of positions) {
    if (p.kind !== "concentrated" || !p.range?.inRange) continue; // fora do range rende 0, não precisa medir
    /* O Uniswap v4 não tem contrato de pool: o `poolAddress` dele é o
       singleton PoolManager, que não expõe `feeGrowthGlobal0X128`. Tentar
       medir ali sempre reverte e gerava um aviso alarmante na tela ("some
       data may be incomplete") por um caso perfeitamente normal. */
    if (SEM_FEE_APR_ONCHAIN.has(p.protocol)) continue;
    const set = porRede.get(p.chainId) ?? new Set<string>();
    set.add(p.poolAddress.toLowerCase());
    porRede.set(p.chainId, set);
  }
  if (porRede.size === 0) return out;

  let orcamento = MAX_FEE_APR_POOLS;
  await Promise.all(
    [...porRede.entries()].map(async ([chainId, pools]) => {
      const info = chainInfo(chainId);
      try {
        const reader = createReader(chainId);
        const bloco = await reader.getBlockNumber?.();
        if (bloco === undefined) return;
        const alvos = [...pools].slice(0, Math.max(0, orcamento));
        orcamento -= alvos.length;
        await mapLimit(alvos, 6, async (pool) => {
          const win = await readFeeGrowthWindow(reader, pool as Address, bloco, info.secPerBlock, DEFAULT_WINDOW_HOURS, onWarn);
          if (win) out.set(`${chainId}:${pool}`, win);
        });
      } catch (e) {
        onWarn(`fee APR on-chain indisponível em ${info.label}: ${(e as Error).message.split("\n")[0].slice(0, 60)}`);
      }
    }),
  );
  return out;
}
