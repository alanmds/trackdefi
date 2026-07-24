/**
 * APR "rendendo agora" da POSIÇÃO (Receita C2) — diferente do APR do pool
 * (defillama.ts). Responde a pergunta que apoia decisão de rebalanceamento:
 * quanto ESTA posição rende AGORA?
 *
 * Provado nos PoCs poc/probe-emissions.ts e poc/probe-fee-apr.ts (18-19/07/2026):
 *
 * - FORA do range: 0%. Posição concentrada fora da faixa não gera taxa de swap
 *   e, em stake (gauge CL Aerodrome/Velodrome), também não recebe emissões — o
 *   gauge só paga a liquidez ativa no tick corrente.
 *
 * - TAXAS (qualquer posição em range). Partindo do apyBase do pool (taxa anual
 *   ÷ TVL, que a DefiLlama já reporta) e da coerência medida no PoC
 *   (volume×fee == apyBase×TVL/365, EXATA):
 *     feeAPR = apyBase × (L_posição / L_ativa_pool) × (TVL_pool / valorUSD)
 *   A concentração entra por L_posição/L_ativa (posição estreita rende mais por
 *   dólar). Medido ×1.0 a ×3.5 sobre o apyBase em posições reais.
 *
 * - EMISSÕES (posição CL em stake e em range) — cálculo on-chain, independe da
 *   DefiLlama (cujo apyReward é lixo em pool CL1 de TVL baixo: 6012% medido):
 *     tokensPorSeg ≈ rewardRate_gauge × (L_staked_posição / L_staked_ativa_pool)
 *     emissionAPR = tokensPorSeg × ANO × preço(token) ÷ valorUSD
 *   Medido 8.91% single-shot (contraprova realizada 12.38%; pool CL1 tem
 *   liquidez ativa muito volátil) — honesto como estimativa.
 *
 * - Aerodrome em stake acumula TAXAS **e** emissões (medido no PoC) → soma.
 *
 * Política "número honesto ou —" (mesma do defillama.ts): guarda de TVL mínimo,
 * teto de sanidade; sem dado confiável para NENHUM componente → null.
 */

const YEAR_SEC = 365 * 24 * 3600;

export const MIN_POOL_TVL_USD = 10_000; // TVL abaixo disto → fee APR não confiável
export const MAX_SANE_EARNING = 1_000; // % a.a.; acima é ruído (liquidez/valor ínfimo)

export interface EarningInputs {
  inRange: boolean;
  valueUsd: number | null;

  // --- taxas (do casamento com a DefiLlama + liquidez on-chain) ---
  /** apyBase do pool (% a.a. de taxas), da DefiLlama */
  poolFeeAprPct: number | null;
  /** TVL do pool (US$), da DefiLlama */
  poolTvlUsd: number | null;
  /** liquidez (L) da posição — unidades cruas */
  posLiquidity: bigint | null;
  /** liquidez ativa do pool no tick corrente — pool.liquidity() */
  activeLiquidity: bigint | null;

  // --- emissões (gauge CL em stake) ---
  staked: boolean;
  /** token de emissão por segundo (unidades cruas, ex.: AERO 1e18) — gauge.rewardRate() */
  rewardRatePerSec: bigint | null;
  /** L em stake da posição */
  posStakedLiquidity: bigint | null;
  /** L em stake ativa do pool — pool.stakedLiquidity() */
  poolStakedLiquidity: bigint | null;
  emissionPriceUsd: number | null;
  emissionDecimals: number;
}

export interface EarningNow {
  /** total rendendo agora (taxas + emissões); 0 fora do range */
  nowPct: number;
  /** componente de taxas; null = sem dado confiável (mostra "—") */
  feePct: number | null;
  /** componente de emissões; null = não se aplica ou sem dado */
  emissionPct: number | null;
}

function within(pct: number): boolean {
  return Number.isFinite(pct) && pct >= 0 && pct <= MAX_SANE_EARNING;
}

/** Puro e testável. null quando não dá para afirmar NADA com honestidade. */
export function computeEarning(i: EarningInputs): EarningNow | null {
  // fora do range: rendimento corrente é zero, com certeza (não é "—")
  if (!i.inRange) return { nowPct: 0, feePct: 0, emissionPct: 0 };

  const feePct = computeFee(i);
  const emissionPct = computeEmission(i);

  // em range mas sem dado confiável para nenhum componente → "—"
  if (feePct === null && emissionPct === null) return null;

  const nowPct = (feePct ?? 0) + (emissionPct ?? 0);
  return { nowPct, feePct, emissionPct };
}

function computeFee(i: EarningInputs): number | null {
  if (
    i.poolFeeAprPct === null ||
    i.poolTvlUsd === null ||
    i.posLiquidity === null ||
    i.activeLiquidity === null ||
    i.valueUsd === null ||
    i.activeLiquidity <= 0n ||
    i.valueUsd <= 0 ||
    i.poolTvlUsd < MIN_POOL_TVL_USD
  ) {
    return null;
  }
  const share = Number(i.posLiquidity) / Number(i.activeLiquidity);
  const pct = i.poolFeeAprPct * share * (i.poolTvlUsd / i.valueUsd);
  return within(pct) ? pct : null;
}

function computeEmission(i: EarningInputs): number | null {
  if (
    !i.staked ||
    i.rewardRatePerSec === null ||
    i.posStakedLiquidity === null ||
    i.poolStakedLiquidity === null ||
    i.emissionPriceUsd === null ||
    i.valueUsd === null ||
    i.poolStakedLiquidity <= 0n ||
    i.valueUsd <= 0
  ) {
    return null;
  }
  const share = Number(i.posStakedLiquidity) / Number(i.poolStakedLiquidity);
  const tokensPerSec = (Number(i.rewardRatePerSec) / 10 ** i.emissionDecimals) * share;
  const pct = ((tokensPerSec * YEAR_SEC * i.emissionPriceUsd) / i.valueUsd) * 100;
  return within(pct) ? pct : null;
}
