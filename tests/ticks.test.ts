/**
 * Gabaritos: posições reais da carteira 0x05963CdC (fixture da Fase 1),
 * conferidas visualmente pelo Alan contra o site da Aerodrome em 10/07/2026.
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

  it("reproduz a faixa real WETH(18)/USDC(6) da posição #1774608", () => {
    expect(tickToPrice0In1(-203189, 18, 6)).toBeCloseTo(1499.87, 1);
    expect(tickToPrice0In1(-200313, 18, 6)).toBeCloseTo(1999.64, 1);
  });

  it("reproduz a faixa real USDC(6)/cbBTC(8) da posição #1774557", () => {
    expect(tickToPrice0In1(-66850, 6, 8)).toBeCloseTo(1.24993e-5, 9);
    expect(tickToPrice0In1(-63805, 6, 8)).toBeCloseTo(1.69482e-5, 9);
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
  it("mantém a direção quando o preço corrente >= 1 (ex.: USDC por WETH)", () => {
    const o = orientRange(1499.87, 1999.64, 1790);
    expect(o.inverted).toBe(false);
    expect(o.lower).toBeCloseTo(1499.87, 2);
    expect(o.upper).toBeCloseTo(1999.64, 2);
  });

  it("inverte quando o preço corrente é fracionário (ex.: cbBTC por USDC)", () => {
    const lower = tickToPrice0In1(-66850, 6, 8);
    const upper = tickToPrice0In1(-63805, 6, 8);
    const o = orientRange(lower, upper, 1.55e-5);
    expect(o.inverted).toBe(true);
    expect(o.lower).toBeCloseTo(1 / upper, 6);
    expect(o.upper).toBeCloseTo(1 / lower, 6);
    expect(o.lower).toBeGreaterThan(50_000); // ~59 mil USDC por cbBTC
    expect(o.upper).toBeLessThan(90_000); // ~80 mil USDC por cbBTC
    expect(o.lower).toBeLessThan(o.upper); // inversão preserva a ordem
  });

  it("não inverte preço zero ou negativo", () => {
    expect(orientRange(0, 0, 0).inverted).toBe(false);
  });
});
