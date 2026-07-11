/**
 * Vetores de teste EXATOS:
 * - 4 pares tick↔sqrt_ratio de posições reais (fixture 0x05963CdC, em que o
 *   Sugar da Aerodrome entregou os dois valores — verdade on-chain);
 * - extremos canônicos MIN/MAX_SQRT_RATIO do contrato TickMath (exercitam
 *   TODOS os 20 coeficientes mágicos);
 * - tick 0 → exatamente 2^96.
 */

import { describe, expect, it } from "vitest";
import { getSqrtRatioAtTick, MAX_TICK, MIN_TICK } from "../core/math/tickmath";

describe("getSqrtRatioAtTick (port exato do TickMath)", () => {
  it("bate com os sqrt ratios reais do fixture (posição WETH/USDC #1774608)", () => {
    expect(getSqrtRatioAtTick(-203189)).toBe(3068365595550320841079178n);
    expect(getSqrtRatioAtTick(-200313)).toBe(3542872543332906218966988n);
  });

  it("bate com os sqrt ratios reais do fixture (posição USDC/cbBTC #1774557)", () => {
    expect(getSqrtRatioAtTick(-66850)).toBe(2801062856536558260772180222n);
    expect(getSqrtRatioAtTick(-63805)).toBe(3261676492785699539064262614n);
  });

  it("tick 0 → exatamente 2^96", () => {
    expect(getSqrtRatioAtTick(0)).toBe(1n << 96n);
  });

  it("extremos canônicos do contrato (MIN/MAX_SQRT_RATIO)", () => {
    expect(getSqrtRatioAtTick(MIN_TICK)).toBe(4295128739n);
    expect(getSqrtRatioAtTick(MAX_TICK)).toBe(1461446703485210103287273052203988822378723970342n);
  });

  it("simetria aproximada: ratio(t) * ratio(-t) ≈ 2^192", () => {
    const t = 12345;
    const prod = getSqrtRatioAtTick(t) * getSqrtRatioAtTick(-t);
    const target = 1n << 192n;
    const diff = prod > target ? prod - target : target - prod;
    expect(diff * 1_000_000n < target).toBe(true); // erro < 0,0001%
  });

  it("rejeita ticks fora dos limites", () => {
    expect(() => getSqrtRatioAtTick(MAX_TICK + 1)).toThrow();
    expect(() => getSqrtRatioAtTick(MIN_TICK - 1)).toThrow();
    expect(() => getSqrtRatioAtTick(1.5)).toThrow();
  });
});
