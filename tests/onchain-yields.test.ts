/**
 * Fee APR on-chain (Receita G) — parte pura.
 *
 * Os números vêm do PoC `poc/probe-fee-apr-onchain.ts` rodado em 02/08/2026
 * contra a Base com RPC de arquivo, para o teste falar a mesma língua da
 * medição real.
 */

import { describe, expect, it } from "vitest";
import { computeOnchainFeeApr, type OnchainFeeInputs } from "../core/yields/onchain";
import { computeEarning, MAX_SANE_EARNING } from "../core/yields/positionApr";

const Q128 = 2n ** 128n;
const DIA = 24 * 3600;

/** monta um delta que rende exatamente `alvoToken0` unidades cruas para L */
function deltaPara(alvoRaw: bigint, L: bigint): bigint {
  return (alvoRaw * Q128) / L;
}

const base: OnchainFeeInputs = {
  delta0: 0n,
  delta1: 0n,
  posLiquidity: 10n ** 18n,
  windowSec: DIA,
  decimals0: 18,
  decimals1: 6,
  price0Usd: 2_000,
  price1Usd: 1,
  positionValueUsd: 10_000,
};

describe("computeOnchainFeeApr", () => {
  it("anualiza corretamente: US$ 10 por dia sobre US$ 10.000 = 36,5% a.a.", () => {
    // 0,005 WETH a US$ 2.000 = US$ 10 no dia
    const L = base.posLiquidity as bigint;
    const fees0 = 5n * 10n ** 15n; // 0,005 * 1e18
    const apr = computeOnchainFeeApr({ ...base, delta0: deltaPara(fees0, L) });
    expect(apr).not.toBeNull();
    expect(apr as number).toBeCloseTo(36.5, 1);
  });

  it("soma as taxas dos DOIS tokens", () => {
    const L = base.posLiquidity as bigint;
    const so0 = computeOnchainFeeApr({ ...base, delta0: deltaPara(5n * 10n ** 15n, L) }) as number;
    const ambos = computeOnchainFeeApr({
      ...base,
      delta0: deltaPara(5n * 10n ** 15n, L),
      delta1: deltaPara(10n * 10n ** 6n, L), // US$ 10 em USDC (6 casas)
    }) as number;
    expect(ambos).toBeCloseTo(so0 * 2, 1);
  });

  it("janela mais curta com as mesmas taxas dá APR maior (anualização)", () => {
    const L = base.posLiquidity as bigint;
    const d = deltaPara(5n * 10n ** 15n, L);
    const dia = computeOnchainFeeApr({ ...base, delta0: d }) as number;
    const meioDia = computeOnchainFeeApr({ ...base, delta0: d, windowSec: DIA / 2 }) as number;
    expect(meioDia).toBeCloseTo(dia * 2, 1);
  });

  it("sem preço de um dos tokens → null, nunca zero", () => {
    const L = base.posLiquidity as bigint;
    const r = computeOnchainFeeApr({ ...base, delta0: deltaPara(10n ** 15n, L), price1Usd: null });
    expect(r).toBeNull();
  });

  it("sem liquidez, sem valor ou janela inválida → null", () => {
    expect(computeOnchainFeeApr({ ...base, posLiquidity: null })).toBeNull();
    expect(computeOnchainFeeApr({ ...base, posLiquidity: 0n })).toBeNull();
    expect(computeOnchainFeeApr({ ...base, positionValueUsd: null })).toBeNull();
    expect(computeOnchainFeeApr({ ...base, positionValueUsd: 0 })).toBeNull();
    expect(computeOnchainFeeApr({ ...base, windowSec: 0 })).toBeNull();
  });

  it("delta negativo (leitura inconsistente) → null", () => {
    expect(computeOnchainFeeApr({ ...base, delta0: -1n })).toBeNull();
  });

  it("acima do teto de sanidade → null (posição que saiu e voltou ao range)", () => {
    const L = base.posLiquidity as bigint;
    // taxas absurdas: 100 WETH num dia sobre posição de US$ 10 mil
    const r = computeOnchainFeeApr({ ...base, delta0: deltaPara(100n * 10n ** 18n, L) });
    expect(r).toBeNull();
  });

  it("posição sem taxa nenhuma na janela → 0%, que é um número honesto", () => {
    expect(computeOnchainFeeApr(base)).toBe(0);
  });
});

describe("integração com computeEarning", () => {
  const comum = {
    inRange: true,
    valueUsd: 10_000,
    posLiquidity: 10n ** 18n,
    activeLiquidity: 10n ** 20n,
    staked: false,
    rewardRatePerSec: null,
    posStakedLiquidity: null,
    poolStakedLiquidity: null,
    emissionPriceUsd: null,
    emissionDecimals: 18,
  };

  it("on-chain VENCE a DefiLlama quando existe", () => {
    const r = computeEarning({ ...comum, onchainFeeAprPct: 12.5, poolFeeAprPct: 40, poolTvlUsd: 1_000_000 });
    expect(r?.feePct).toBe(12.5);
  });

  it("sem on-chain, cai no caminho da DefiLlama (compatibilidade)", () => {
    const r = computeEarning({ ...comum, onchainFeeAprPct: null, poolFeeAprPct: 10, poolTvlUsd: 1_000_000 });
    expect(r?.feePct).not.toBeNull();
    expect(r?.feePct).toBeGreaterThan(0);
  });

  it("on-chain absurdo é descartado, não propagado", () => {
    const r = computeEarning({
      ...comum,
      onchainFeeAprPct: MAX_SANE_EARNING + 1,
      poolFeeAprPct: null,
      poolTvlUsd: null,
    });
    expect(r).toBeNull();
  });

  it("fora do range continua 0% mesmo com número on-chain", () => {
    const r = computeEarning({ ...comum, inRange: false, onchainFeeAprPct: 99, poolFeeAprPct: null, poolTvlUsd: null });
    expect(r).toEqual({ nowPct: 0, feePct: 0, emissionPct: 0 });
  });
});
