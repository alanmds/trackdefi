/**
 * Receita C2: APR "rendendo agora" da posição. Números derivados dos PoCs
 * reais (poc/probe-emissions.ts e poc/probe-fee-apr.ts, 18-19/07/2026).
 */

import { describe, expect, it } from "vitest";
import { computeEarning, MAX_SANE_EARNING, MIN_POOL_TVL_USD, type EarningInputs } from "../core/yields/positionApr";

// base: posição Uniswap em range, sem stake (só taxas) — USDC/WETH 0.05% Ethereum
const base: EarningInputs = {
  inRange: true,
  valueUsd: 149.91,
  poolFeeAprPct: 12.97, // apyBase da DefiLlama
  poolTvlUsd: 94_105_827,
  posLiquidity: 35_597_051_938_309n,
  activeLiquidity: 6_430_520_150_839_322_559n,
  staked: false,
  rewardRatePerSec: null,
  posStakedLiquidity: null,
  poolStakedLiquidity: null,
  emissionPriceUsd: null,
  emissionDecimals: 18,
};

describe("computeEarning — fora do range", () => {
  it("fora do range → 0% (não é '—')", () => {
    const e = computeEarning({ ...base, inRange: false })!;
    expect(e.nowPct).toBe(0);
    expect(e.feePct).toBe(0);
    expect(e.emissionPct).toBe(0);
  });
});

describe("computeEarning — taxas (Uniswap real do PoC)", () => {
  it("USDC/WETH 0.05% Ethereum → ~45% (concentração ×3.5 sobre apyBase 12.97%)", () => {
    const e = computeEarning(base)!;
    expect(e.feePct).toBeCloseTo(45.08, 0); // PoC: 45.08%
    expect(e.emissionPct).toBeNull();
    expect(e.nowPct).toBeCloseTo(e.feePct!, 5);
  });

  it("multiplicador de concentração = (L_pos/L_ativa) × (TVL/valor)", () => {
    const share = Number(base.posLiquidity) / Number(base.activeLiquidity);
    const mult = share * (base.poolTvlUsd! / base.valueUsd!);
    const e = computeEarning(base)!;
    expect(e.feePct).toBeCloseTo(base.poolFeeAprPct! * mult, 4);
    expect(mult).toBeGreaterThan(3); // ~3.5 no PoC
  });
});

describe("computeEarning — emissões (Aerodrome staked real do PoC)", () => {
  const staked: EarningInputs = {
    inRange: true,
    valueUsd: 158.0,
    poolFeeAprPct: null, // pool CL1: match() da DefiLlama rejeita (apyReward absurdo)
    poolTvlUsd: null,
    posLiquidity: null,
    activeLiquidity: null,
    staked: true,
    rewardRatePerSec: 23_917_758_245_082_985n,
    posStakedLiquidity: 43_010_803n,
    poolStakedLiquidity: 957_469_780_522n,
    emissionPriceUsd: 0.41543967,
    emissionDecimals: 18,
  };

  it("CL1-USDC/cbBTC em stake → ~8.9% de emissões (PoC single-shot)", () => {
    const e = computeEarning(staked)!;
    expect(e.emissionPct).toBeCloseTo(8.91, 1);
    expect(e.feePct).toBeNull();
    expect(e.nowPct).toBeCloseTo(e.emissionPct!, 5);
  });

  it("posição não em stake e sem taxas → '—'", () => {
    expect(computeEarning({ ...staked, staked: false })).toBeNull();
  });

  it("staked + taxas: soma os dois componentes", () => {
    const e = computeEarning({
      ...staked,
      poolFeeAprPct: 20,
      poolTvlUsd: 5_000_000,
      posLiquidity: 43_010_803n,
      activeLiquidity: 957_469_780_522n,
    })!;
    expect(e.feePct).not.toBeNull();
    expect(e.emissionPct).not.toBeNull();
    expect(e.nowPct).toBeCloseTo(e.feePct! + e.emissionPct!, 5);
  });
});

describe("computeEarning — guardas de honestidade", () => {
  it("TVL do pool abaixo do piso → feePct null", () => {
    expect(computeEarning({ ...base, poolTvlUsd: MIN_POOL_TVL_USD - 1 })).toBeNull();
  });

  it("em range mas sem NENHUM dado confiável → '—' (null)", () => {
    expect(computeEarning({ ...base, poolFeeAprPct: null, poolTvlUsd: null })).toBeNull();
  });

  it("valor zero/negativo → não divide por zero (null)", () => {
    expect(computeEarning({ ...base, valueUsd: 0 })).toBeNull();
  });

  it("liquidez ativa zero → null (não divide por zero)", () => {
    expect(computeEarning({ ...base, activeLiquidity: 0n })).toBeNull();
  });

  it("teto de sanidade corta APR absurdo", () => {
    // liquidez ativa minúscula → share gigante → APR estourado → null
    expect(computeEarning({ ...base, activeLiquidity: 1n, valueUsd: 0.01 })).toBeNull();
  });

  it("teto exportado é 1.000%", () => {
    expect(MAX_SANE_EARNING).toBe(1000);
  });
});
