/**
 * Casos canônicos EXATOS da matemática Q96 (deriváveis à mão):
 * com sqrtLower = Q96 (preço 1) e sqrtUpper = 2·Q96 (preço 4):
 *  - no meio (sqrtCur = 1,5·Q96): amount0 = L/6, amount1 = L/2
 *  - abaixo: amount0 = L/2, amount1 = 0
 *  - acima:  amount0 = 0,   amount1 = L
 */

import { describe, expect, it } from "vitest";
import { amountsForLiquidity, Q96 } from "../core/math/liquidity";

const L = 10n ** 18n;
const LOWER = Q96;
const UPPER = 2n * Q96;

describe("amountsForLiquidity (Q96, BigInt)", () => {
  it("dentro da faixa: mistura exata L/6 e L/2", () => {
    const { amount0, amount1 } = amountsForLiquidity(L, (3n * Q96) / 2n, LOWER, UPPER);
    expect(amount0).toBe(L / 6n);
    expect(amount1).toBe(L / 2n);
  });

  it("preço abaixo da faixa: 100% token0 (L/2), zero token1", () => {
    const { amount0, amount1 } = amountsForLiquidity(L, Q96 / 2n, LOWER, UPPER);
    expect(amount0).toBe(L / 2n);
    expect(amount1).toBe(0n);
  });

  it("preço acima da faixa: 100% token1 (L), zero token0", () => {
    const { amount0, amount1 } = amountsForLiquidity(L, 3n * Q96, LOWER, UPPER);
    expect(amount0).toBe(0n);
    expect(amount1).toBe(L);
  });

  it("bordas: no limite inferior é 100% token0; no superior, 100% token1", () => {
    expect(amountsForLiquidity(L, LOWER, LOWER, UPPER).amount1).toBe(0n);
    expect(amountsForLiquidity(L, UPPER, LOWER, UPPER).amount0).toBe(0n);
  });

  it("liquidez zero → zero tokens", () => {
    const { amount0, amount1 } = amountsForLiquidity(0n, (3n * Q96) / 2n, LOWER, UPPER);
    expect(amount0).toBe(0n);
    expect(amount1).toBe(0n);
  });

  it("rejeita entradas inválidas", () => {
    expect(() => amountsForLiquidity(-1n, Q96, LOWER, UPPER)).toThrow();
    expect(() => amountsForLiquidity(L, Q96, 0n, UPPER)).toThrow();
  });

  it("faixa invertida é normalizada (mesmo resultado)", () => {
    const a = amountsForLiquidity(L, (3n * Q96) / 2n, LOWER, UPPER);
    const b = amountsForLiquidity(L, (3n * Q96) / 2n, UPPER, LOWER);
    expect(b).toEqual(a);
  });
});
