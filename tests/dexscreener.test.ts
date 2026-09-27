/**
 * DexScreener como segunda fonte (27/09/2026): o preço de um token é o do par
 * MAIS LÍQUIDO que o contém — seja ele o base ou o quote do par.
 */
import { describe, expect, it } from "vitest";
import { pricesFromPairs, type DexPair } from "../core/prices/dexscreener";

const T = "0x00000000000000000000000000000000000000aa";
const U = "0x00000000000000000000000000000000000000bb";
const par = (base: string, quote: string, usd: number, native: number, liq: number): DexPair => ({
  baseToken: { address: base },
  quoteToken: { address: quote },
  priceUsd: String(usd),
  priceNative: String(native),
  liquidity: { usd: liq },
});

describe("pricesFromPairs", () => {
  it("token como BASE: o priceUsd do par", () => {
    expect(pricesFromPairs([par(T, U, 2, 4, 1000)], [T]).get(T)).toBe(2);
  });

  it("token como QUOTE: base em US$ ÷ base em quote", () => {
    // 1 base = US$ 2 e 1 base = 4 quote → 1 quote = US$ 0,50
    expect(pricesFromPairs([par(U, T, 2, 4, 1000)], [T]).get(T)).toBe(0.5);
  });

  it("vence o par mais líquido — sem piso: preço de mercado como está", () => {
    const m = pricesFromPairs([par(T, U, 9, 1, 10), par(T, U, 2, 1, 5000), par(T, U, 7, 1, 50)], [T]);
    expect(m.get(T)).toBe(2);
  });

  it("par sem preço válido é ignorado; token não pedido não entra", () => {
    const m = pricesFromPairs([par(T, U, NaN, 1, 9999), par(U, T, 0, 1, 9999)], [T]);
    expect(m.has(T)).toBe(false);
    expect(pricesFromPairs([par(T, U, 2, 4, 1000)], [T]).has(U)).toBe(false);
  });

  it("endereço em qualquer caixa", () => {
    expect(pricesFromPairs([par(T.toUpperCase().replace("0X", "0x"), U, 3, 1, 1)], [T]).get(T)).toBe(3);
  });
});
