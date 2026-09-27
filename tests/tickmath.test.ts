/**
 * Vetores de teste EXATOS:
 * - 4 pares tick↔sqrt_ratio de posições reais da carteira demo (de terceiro —
 *   ver tests/demo-fixture.ts), em que o Sugar entregou os dois valores —
 *   verdade on-chain; um deles bem perto do extremo negativo;
 * - extremos canônicos MIN/MAX_SQRT_RATIO do contrato TickMath (exercitam
 *   TODOS os 20 coeficientes mágicos);
 * - tick 0 → exatamente 2^96.
 */

import { describe, expect, it } from "vitest";
import { getSqrtRatioAtTick, MAX_TICK, MIN_TICK } from "../core/math/tickmath";

describe("getSqrtRatioAtTick (port exato do TickMath)", () => {
  it("bate com os sqrt ratios reais do fixture (posição demo USDC/WETH #47980865, Optimism)", () => {
    expect(getSqrtRatioAtTick(197000)).toBe(1501296094141917074055633258303303n);
    expect(getSqrtRatioAtTick(201200)).toBe(1852096607021549532536340860415785n);
  });

  it("bate com os sqrt ratios reais do fixture (posição demo WETH/AERO #3970481, Base)", () => {
    expect(getSqrtRatioAtTick(-367400)).toBe(834235802021488591083n);
    expect(getSqrtRatioAtTick(92200)).toBe(7959339820541314895926346603111n);
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
