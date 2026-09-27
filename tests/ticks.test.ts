/**
 * Gabaritos: posições reais da carteira demo (de terceiro — ver
 * tests/demo-fixture.ts). A conferência usa a raiz do preço que o PRÓPRIO
 * contrato Sugar devolveu para cada ponta da faixa: verdade on-chain,
 * independente da matemática testada aqui.
 */

import { describe, expect, it } from "vitest";
import { isInRange, orientRange, tickToPrice0In1 } from "../core/math/ticks";

describe("tickToPrice0In1", () => {
  it("tick 0 com decimais iguais = preço 1", () => {
    expect(tickToPrice0In1(0, 18, 18)).toBe(1);
  });

  it("ajusta pelas casas decimais", () => {
    expect(tickToPrice0In1(0, 6, 18)).toBeCloseTo(1e-12, 15);
    expect(tickToPrice0In1(0, 18, 6)).toBeCloseTo(1e12, 0);
  });

  it("é crescente no tick", () => {
    expect(tickToPrice0In1(100, 18, 18)).toBeGreaterThan(tickToPrice0In1(0, 18, 18));
  });

  /** preço do token0 em token1 a partir do sqrt ratio Q64.96 que o Sugar entregou */
  const doSqrt = (sqrtX96: bigint, d0: number, d1: number) => (Number(sqrtX96) / 2 ** 96) ** 2 * 10 ** (d0 - d1);
  const perto = (a: number, b: number) => Math.abs(a / b - 1) < 1e-9;

  it("reproduz a faixa real USDC(6)/WETH(18) da posição demo #47980865 (Optimism)", () => {
    expect(perto(tickToPrice0In1(197000, 6, 18), doSqrt(1501296094141917074055633258303303n, 6, 18))).toBe(true);
    expect(perto(tickToPrice0In1(201200, 6, 18), doSqrt(1852096607021549532536340860415785n, 6, 18))).toBe(true);
  });

  it("reproduz a faixa real WETH(18)/KAITO(18) da posição demo #7665206 (Base)", () => {
    expect(perto(tickToPrice0In1(78700, 18, 18), doSqrt(4052685740144021834925775373626n, 18, 18))).toBe(true);
    expect(perto(tickToPrice0In1(78800, 18, 18), doSqrt(4072998893771118498911129821546n, 18, 18))).toBe(true);
  });
});

describe("isInRange", () => {
  it("limite inferior é inclusivo, superior é exclusivo (convenção Uniswap V3)", () => {
    expect(isInRange(-100, -100, 100)).toBe(true);
    expect(isInRange(100, -100, 100)).toBe(false);
    expect(isInRange(0, -100, 100)).toBe(true);
    expect(isInRange(-101, -100, 100)).toBe(false);
  });
});

describe("orientRange", () => {
  it("mantém a direção quando o preço corrente >= 1 (ex.: KAITO por WETH)", () => {
    const lower = tickToPrice0In1(78700, 18, 18);
    const upper = tickToPrice0In1(78800, 18, 18);
    const o = orientRange(lower, upper, 7520);
    expect(o.inverted).toBe(false);
    expect(o.lower).toBeCloseTo(lower, 9);
    expect(o.upper).toBeCloseTo(upper, 9);
  });

  it("inverte quando o preço corrente é fracionário (ex.: WETH por USDC)", () => {
    const lower = tickToPrice0In1(197000, 6, 18);
    const upper = tickToPrice0In1(201200, 6, 18);
    const o = orientRange(lower, upper, 0.000373);
    expect(o.inverted).toBe(true);
    expect(o.lower).toBeCloseTo(1 / upper, 6);
    expect(o.upper).toBeCloseTo(1 / lower, 6);
    expect(o.lower).toBeGreaterThan(1000); // USDC por WETH: o ETH do dia cabe aqui
    expect(o.upper).toBeLessThan(5000);
    expect(o.lower).toBeLessThan(o.upper); // inversão preserva a ordem
  });

  it("não inverte preço zero ou negativo", () => {
    expect(orientRange(0, 0, 0).inverted).toBe(false);
  });
});
