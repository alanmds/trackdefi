/**
 * Simulador de APR — a conta (PURA: roda no navegador a cada mexida na faixa,
 * sem ir ao servidor). Os dados do pool chegam prontos de `lookup.ts`.
 *
 * Pergunta que responde: "se eu puser US$ X neste pool, nesta faixa, quanto
 * rende?" — com os mesmos números on-chain que o card da carteira usa:
 *
 * - TAXAS, enquanto o preço estiver na faixa: Δ feeGrowthGlobal do pool na
 *   janela (24 h e 15 min) × L da posição simulada ÷ 2^128. O acumulador
 *   global é taxa por unidade de liquidez ATIVA, então isso é exatamente o
 *   que uma faixa que contivesse o preço a janela toda teria ganho.
 *   Diluição: a posição nova entra na divisão — × L_ativa ÷ (L_ativa + L_sua).
 * - EMISSÕES: ritmo do gauge × L_sua ÷ (L_dividida + L_sua) × preço do token.
 *   Só conta em stake quando o protocolo exige stake.
 * - TEMPO NA FAIXA: fração das horas dos últimos 7 dias em que o preço do par
 *   (pela DefiLlama, de hora em hora) ficou dentro da faixa. Fora dela a
 *   posição rende 0% — o número "se os últimos 7 dias se repetissem" junta
 *   as duas coisas, e a tela mostra as três lado a lado, sem esconder nenhuma.
 *
 * Tudo é ESTIMATIVA do ritmo de agora; o volume, a liquidez e o preço mudam.
 */

import { amountsForLiquidity } from "../math/liquidity";
import { getSqrtRatioAtTick, MAX_TICK, MIN_TICK } from "../math/tickmath";
import { isInRange, tickToPrice0In1 } from "../math/ticks";
import { ABSURD_APR_PCT, computeOnchainFeeApr } from "../yields/onchain";

const YEAR_SEC = 365 * 24 * 3600;

/** O que o navegador recebe do `/api/pool` — bigints viajam como string. */
export interface SimPoolDTO {
  protocol: string;
  chainId: number;
  poolAddress: string;
  poolSymbol: string;
  token0: { address: string; symbol: string; decimals: number };
  token1: { address: string; symbol: string; decimals: number };
  feePips: number | null;
  tickSpacing: number;
  tick: number;
  sqrtPriceX96: string;
  activeLiquidity: string;
  price0Usd: number | null;
  price1Usd: number | null;
  /** saldo do contrato × preço; null sem preço ou sem saldo */
  tvlUsd: number | null;
  /** da mais longa para a mais curta; vazio = RPC sem arquivo */
  feeWindows: { delta0: string; delta1: string; windowSec: number }[];
  emission: {
    token: { address: string; symbol: string; decimals: number };
    ratePerSec: string;
    sharedLiquidity: string;
    requiresStake: boolean;
    endedAt?: number;
    priceUsd: number | null;
  } | null;
  /** preço do par (token1 por 1 token0), de hora em hora; null = sem histórico */
  history: { t: number; price: number }[] | null;
  /** unix (s) da leitura */
  readAt: number;
}

export interface SimInput {
  depositUsd: number;
  /** faixa em token1 por 1 token0 (a orientação de exibição fica na tela) */
  priceLower: number;
  priceUpper: number;
  /** a posição simulada fica em stake? (só pesa onde o protocolo exige) */
  staked: boolean;
}

export interface FeeWindowResult {
  windowSec: number;
  /** % a.a. enquanto em faixa; null = sem preço */
  pct: number | null;
}

export interface SimResult {
  /** faixa de fato, depois de alinhar aos ticks permitidos pelo pool */
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  priceCurrent: number;
  inRangeNow: boolean;
  fullRange: boolean;
  /** quanto de cada token o depósito vira (unidades humanas) */
  amount0: number;
  amount1: number;
  /** nas bordas: tudo vira um token só */
  atLower: { amount0: number; amount1: number };
  atUpper: { amount0: number; amount1: number };
  /** quantas vezes a liquidez de faixa cheia rende por dólar */
  concentration: number | null;
  /** a sua liquidez ÷ a ativa do pool, depois de entrar */
  shareOfActive: number;
  fees: FeeWindowResult[];
  /** emissões em % a.a. enquanto em faixa; null = não se aplica ou sem preço */
  emissionPct: number | null;
  emissionEnded: boolean;
  emissionNeedsStake: boolean;
  /** fração (0–1) das horas dos últimos 7 dias dentro da faixa; null = sem histórico */
  timeInRange: number | null;
  historyLow: number | null;
  historyHigh: number | null;
  /** taxas (janela mais longa) + emissões, enquanto em faixa */
  inRangePct: number | null;
  /** inRangePct × timeInRange — "se os últimos 7 dias se repetissem" */
  repeatPct: number | null;
}

/** Preço (token1 por token0) → tick, sem alinhar. */
export function priceToTick(price: number, decimals0: number, decimals1: number): number {
  return Math.log(price / 10 ** (decimals0 - decimals1)) / Math.log(1.0001);
}

/** Maior e menor tick que o pool aceita para este espaçamento. */
export function usableTicks(tickSpacing: number): { min: number; max: number } {
  return {
    min: Math.ceil(MIN_TICK / tickSpacing) * tickSpacing,
    max: Math.floor(MAX_TICK / tickSpacing) * tickSpacing,
  };
}

/**
 * Faixa pedida → ticks permitidos. A borda de baixo desce e a de cima sobe
 * para o múltiplo do espaçamento (a faixa nunca fica MENOR do que o pedido),
 * e a faixa tem pelo menos um espaçamento de largura.
 */
export function alignRange(
  priceLower: number,
  priceUpper: number,
  tickSpacing: number,
  decimals0: number,
  decimals1: number,
): { tickLower: number; tickUpper: number } {
  const { min, max } = usableTicks(tickSpacing);
  const [lo, hi] = priceLower <= priceUpper ? [priceLower, priceUpper] : [priceUpper, priceLower];
  const rawLo = lo > 0 ? priceToTick(lo, decimals0, decimals1) : -Infinity;
  const rawHi = Number.isFinite(hi) && hi > 0 ? priceToTick(hi, decimals0, decimals1) : Infinity;
  let tickLower = Number.isFinite(rawLo) ? Math.floor(rawLo / tickSpacing) * tickSpacing : min;
  let tickUpper = Number.isFinite(rawHi) ? Math.ceil(rawHi / tickSpacing) * tickSpacing : max;
  tickLower = Math.max(min, Math.min(tickLower, max - tickSpacing));
  tickUpper = Math.min(max, Math.max(tickUpper, tickLower + tickSpacing));
  return { tickLower, tickUpper };
}

function human(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

/** L de referência: grande o bastante para a divisão inteira não perder precisão. */
const L_REF = 10n ** 24n;

/** Simula. null = sem preço dos dois tokens (não dá para converter dólar em L). */
export function simulate(pool: SimPoolDTO, input: SimInput): SimResult | null {
  const { price0Usd: p0, price1Usd: p1 } = pool;
  if (p0 === null || p1 === null || !(input.depositUsd > 0)) return null;
  const d0 = pool.token0.decimals;
  const d1 = pool.token1.decimals;

  const { tickLower, tickUpper } = alignRange(input.priceLower, input.priceUpper, pool.tickSpacing, d0, d1);
  const { min, max } = usableTicks(pool.tickSpacing);
  const sqrtCur = BigInt(pool.sqrtPriceX96);
  const sqrtLo = getSqrtRatioAtTick(tickLower);
  const sqrtHi = getSqrtRatioAtTick(tickUpper);

  // valor de L_REF nesta faixa ao preço de agora → L do depósito
  const ref = amountsForLiquidity(L_REF, sqrtCur, sqrtLo, sqrtHi);
  const refUsd = human(ref.amount0, d0) * p0 + human(ref.amount1, d1) * p1;
  if (!(refUsd > 0)) return null;
  const scale = input.depositUsd / refUsd;
  // escala em float só para achar L; as quantidades voltam pela conta BigInt
  const lFloat = Math.floor(Number(L_REF) * scale);
  if (!Number.isFinite(lFloat) || lFloat <= 0) return null;
  const L = BigInt(lFloat);
  const now = amountsForLiquidity(L, sqrtCur, sqrtLo, sqrtHi);
  const lo = amountsForLiquidity(L, sqrtLo, sqrtLo, sqrtHi);
  const hi = amountsForLiquidity(L, sqrtHi, sqrtLo, sqrtHi);

  const inRangeNow = isInRange(pool.tick, tickLower, tickUpper);
  const active = BigInt(pool.activeLiquidity);
  // depois de entrar, a liquidez ativa é a do pool MAIS a sua
  const shareOfActive = inRangeNow ? Number(L) / Number(active + L) : 0;
  const dilution = active + L > 0n ? Number(active) / Number(active + L) : 0;

  /* Concentração: quantas vezes a mesma quantia em faixa cheia teria de L.
     É o "por que a faixa estreita rende mais" em um número. */
  const full = amountsForLiquidity(L_REF, sqrtCur, getSqrtRatioAtTick(min), getSqrtRatioAtTick(max));
  const fullUsd = human(full.amount0, d0) * p0 + human(full.amount1, d1) * p1;
  const concentration = fullUsd > 0 ? fullUsd / refUsd : null;

  const fees: FeeWindowResult[] = pool.feeWindows.map((w) => {
    if (!inRangeNow) return { windowSec: w.windowSec, pct: 0 };
    const r = computeOnchainFeeApr({
      delta0: BigInt(w.delta0),
      delta1: BigInt(w.delta1),
      posLiquidity: L,
      windowSec: w.windowSec,
      decimals0: d0,
      decimals1: d1,
      price0Usd: p0,
      price1Usd: p1,
      positionValueUsd: input.depositUsd,
    });
    return { windowSec: w.windowSec, pct: r ? r.pct * dilution : null };
  });

  // emissões
  const e = pool.emission;
  const emissionNeedsStake = e?.requiresStake ?? false;
  const emissionEnded = e !== null && (e.endedAt !== undefined || BigInt(e.ratePerSec) === 0n);
  let emissionPct: number | null = null;
  if (e) {
    if (!inRangeNow || emissionEnded || (e.requiresStake && !input.staked)) emissionPct = 0;
    else if (e.priceUsd !== null) {
      const shared = BigInt(e.sharedLiquidity) + L;
      const perSec = human(BigInt(e.ratePerSec), e.token.decimals) * (Number(L) / Number(shared));
      const pct = ((perSec * YEAR_SEC * e.priceUsd) / input.depositUsd) * 100;
      emissionPct = Number.isFinite(pct) && pct >= 0 && pct <= ABSURD_APR_PCT ? pct : null;
    }
  }

  // tempo na faixa, pelo histórico
  const priceLower = tickToPrice0In1(tickLower, d0, d1);
  const priceUpper = tickToPrice0In1(tickUpper, d0, d1);
  let timeInRange: number | null = null;
  let historyLow: number | null = null;
  let historyHigh: number | null = null;
  if (pool.history && pool.history.length > 0) {
    let dentro = 0;
    for (const h of pool.history) if (h.price >= priceLower && h.price < priceUpper) dentro++;
    timeInRange = dentro / pool.history.length;
    historyLow = Math.min(...pool.history.map((h) => h.price));
    historyHigh = Math.max(...pool.history.map((h) => h.price));
  }

  const feeMain = fees[0]?.pct ?? null;
  const inRangePct =
    feeMain === null && (emissionPct === null || emissionPct === 0) ? null : (feeMain ?? 0) + (emissionPct ?? 0);
  // o que rende "enquanto em faixa" só existe se a faixa contém o preço agora
  const inRangeBase = inRangeNow ? inRangePct : null;
  const repeatPct = inRangeBase !== null && timeInRange !== null ? inRangeBase * timeInRange : null;

  return {
    tickLower,
    tickUpper,
    priceLower,
    priceUpper,
    priceCurrent: tickToPrice0In1(pool.tick, d0, d1),
    inRangeNow,
    fullRange: tickLower === min && tickUpper === max,
    amount0: human(now.amount0, d0),
    amount1: human(now.amount1, d1),
    atLower: { amount0: human(lo.amount0, d0), amount1: human(lo.amount1, d1) },
    atUpper: { amount0: human(hi.amount0, d0), amount1: human(hi.amount1, d1) },
    concentration,
    shareOfActive,
    fees,
    emissionPct,
    emissionEnded,
    emissionNeedsStake,
    timeInRange,
    historyLow,
    historyHigh,
    inRangePct: inRangeBase,
    repeatPct,
  };
}

/** US$ por período a partir de um APR simples (sem juros compostos). */
export function usdPer(pct: number, depositUsd: number, days: number): number {
  return (depositUsd * pct) / 100 / 365 * days;
}

/**
 * Protocolos que o simulador atende — os adapters com `describePool`. A tela
 * cita esta lista; um teste prova que ela bate com o registry.
 */
export const SIMULATOR_PROTOCOLS = ["uniswap-v3", "pancakeswap-v3", "sushiswap-v3", "aerodrome", "velodrome", "ramses-v3"];
