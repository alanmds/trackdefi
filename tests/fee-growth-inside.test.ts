/**
 * Receita G v2 — feeGrowth INSIDE (parte pura).
 *
 * Os números da posição real vêm do PoC `poc/probe-fee-inside-check.ts`
 * rodado em 15/09/2026 contra a posição USDG/HIMS (RWA) na Robinhood Chain,
 * para o teste falar a mesma língua da medição.
 *
 * O que estes testes travam, em ordem de importância:
 *  1. faixa estreita que o preço abandonou NÃO pode receber as taxas do pool
 *     inteiro (era o bug: 971% em produção, teto de sanidade em 1.000%);
 *  2. onde a premissa antiga valia, o número novo é IDÊNTICO ao antigo —
 *     a calibração da Base de 02/08/2026 não pode ter mudado;
 *  3. janela maior que a vida da posição é recusada.
 */

import { describe, expect, it } from "vitest";
import {
  computeOnchainFeeApr,
  feeGrowthInside,
  poolLayout,
  windowFitsPosition,
  wrapSub,
  type TickSnapshot,
} from "../core/yields/onchain";

const MOD256 = 2n ** 256n;

/** snapshot base: preço DENTRO da faixa 100..200 */
function snap(over: Partial<TickSnapshot> = {}): TickSnapshot {
  return {
    tick: 150,
    global0: 1_000_000n,
    global1: 2_000_000n,
    outLower0: 100_000n,
    outLower1: 200_000n,
    outUpper0: 10_000n,
    outUpper1: 20_000n,
    ...over,
  };
}

describe("wrapSub (aritmética do Solidity)", () => {
  it("subtrai normalmente quando não há wrap", () => {
    expect(wrapSub(10n, 3n)).toBe(7n);
  });

  it("dá a volta em vez de ficar negativo — é assim que o pool acumula", () => {
    expect(wrapSub(3n, 10n)).toBe(MOD256 - 7n);
  });

  it("a DIFERENÇA continua certa mesmo com o acumulador estourando o uint256", () => {
    // acumulador estava perto do teto e deu a volta: 5 unidades depois dele
    const antes = MOD256 - 3n;
    const agora = 2n; // = antes + 5, com wrap
    expect(wrapSub(agora, antes)).toBe(5n);
  });
});

describe("feeGrowthInside", () => {
  it("preço DENTRO da faixa: global − outside(lower) − outside(upper)", () => {
    const [i0, i1] = feeGrowthInside(snap(), 100, 200);
    expect(i0).toBe(1_000_000n - 100_000n - 10_000n);
    expect(i1).toBe(2_000_000n - 200_000n - 20_000n);
  });

  it("preço ABAIXO da faixa: o lado de baixo inverte", () => {
    const [i0] = feeGrowthInside(snap({ tick: 50 }), 100, 200);
    // below = global − outLower = 900.000; above = outUpper = 10.000
    expect(i0).toBe(1_000_000n - 900_000n - 10_000n);
  });

  it("preço ACIMA da faixa: o lado de cima inverte", () => {
    const [i0] = feeGrowthInside(snap({ tick: 250 }), 100, 200);
    // below = outLower = 100.000; above = global − outUpper = 990.000
    expect(i0).toBe(wrapSub(wrapSub(1_000_000n, 100_000n), 990_000n));
  });

  it("nunca devolve negativo — usa a mesma volta do uint256 do contrato", () => {
    const [i0] = feeGrowthInside(snap({ outLower0: 999_000n, outUpper0: 999_000n }), 100, 200);
    expect(i0).toBeGreaterThan(0n);
  });
});

describe("a propriedade que protege o que já funcionava", () => {
  const antes = snap();

  it("sem cruzar tick nenhum na janela, Δinside == Δglobal (número IDÊNTICO ao método v1)", () => {
    // só o global cresceu; os feeGrowthOutside só mudam quando o tick é cruzado
    const agora = snap({ global0: antes.global0 + 50_000n, global1: antes.global1 + 70_000n });
    const [a0, a1] = feeGrowthInside(antes, 100, 200);
    const [b0, b1] = feeGrowthInside(agora, 100, 200);
    expect(wrapSub(b0, a0)).toBe(50_000n); // == Δglobal0
    expect(wrapSub(b1, a1)).toBe(70_000n); // == Δglobal1
  });

  it("com o preço saindo da faixa, Δinside é MENOR que Δglobal (o bug corrigido)", () => {
    /* o pool rendeu 50.000, mas 40.000 disso foi gerado depois que o preço
       cruzou o tick de baixo — o outside do tick registra essa parte */
    const agora = snap({ global0: antes.global0 + 50_000n, outLower0: antes.outLower0 + 40_000n });
    const [a0] = feeGrowthInside(antes, 100, 200);
    const [b0] = feeGrowthInside(agora, 100, 200);
    expect(wrapSub(b0, a0)).toBe(10_000n);
    expect(wrapSub(b0, a0)).toBeLessThan(50_000n);
  });
});

describe("windowFitsPosition (janela x idade da posição)", () => {
  const agora = 1_000_000n;
  const passado = 400_000n; // janela rendeu 600.000

  it("posição mais velha que a janela: aceita", () => {
    // último toque rendeu 900.000 desde então — cobre os 600.000 da janela
    expect(windowFitsPosition(agora, passado, 100_000n)).toBe(true);
  });

  it("posição NASCIDA dentro da janela: recusa (era o 2º bug da posição RWA)", () => {
    // último toque rendeu só 200.000 — a posição não existia no início da janela
    expect(windowFitsPosition(agora, passado, 800_000n)).toBe(false);
  });

  it("exatamente na borda (tocada no instante do início da janela): aceita", () => {
    expect(windowFitsPosition(agora, passado, passado)).toBe(true);
  });

  it("protocolo que não expõe o dado (Aerodrome/Sugar): não dá para negar → aceita", () => {
    expect(windowFitsPosition(agora, passado, null)).toBe(true);
  });

  it("é à prova de wrap: compara DIFERENÇAS, nunca os acumuladores crus", () => {
    // tudo deslocado para perto do teto do uint256; as diferenças são as mesmas
    const d = MOD256 - 500_000n;
    const w = (v: bigint) => (v + d) % MOD256;
    expect(windowFitsPosition(w(agora), w(passado), w(100_000n))).toBe(true);
    expect(windowFitsPosition(w(agora), w(passado), w(800_000n))).toBe(false);
  });
});

describe("layout do pool por protocolo (provado on-chain em 15/09/2026)", () => {
  it("Aerodrome e Velodrome NÃO usam o layout da Uniswap", () => {
    const uni = poolLayout("uniswap-v3");
    const aero = poolLayout("aerodrome");
    expect(uni?.fg0).toBe(2);
    expect(aero?.fg0).toBe(3); // stakedLiquidityNet entra antes
    expect(poolLayout("velodrome")?.fg0).toBe(3);
  });

  it("protocolo sem pool no estilo v3 (Uniswap v4) não tem layout — some do cálculo", () => {
    expect(poolLayout("uniswap-v4")).toBeNull();
    expect(poolLayout("protocolo-que-nao-existe")).toBeNull();
  });
});

describe("posição RWA real: USDG/HIMS na Robinhood (15/09/2026)", () => {
  const L = 816442828566610n;
  const comum = {
    posLiquidity: L,
    decimals0: 6, // USDG
    decimals1: 18, // HIMS
    price0Usd: 1.0,
    price1Usd: 28.21,
    positionValueUsd: 193.04,
  };

  it("janela de 15 min que CABE na vida da posição → 44,45% a.a.", () => {
    const apr = computeOnchainFeeApr({
      ...comum,
      delta0: 1006721577639139375016612817n,
      delta1: 499202839259517482955586845935819462n,
      windowSec: 900,
    });
    expect(apr).not.toBeNull();
    expect(apr as number).toBeCloseTo(44.45, 1);
  });

  it("o número inflado do método antigo (971%) fica abaixo do teto e passaria — por isso o bug era invisível", () => {
    // 971% não é barrado por nada: só a conta certa resolve
    const apr = computeOnchainFeeApr({
      ...comum,
      delta0: 1006721577639139375016612817n * 22n,
      delta1: 499202839259517482955586845935819462n * 22n,
      windowSec: 900,
    });
    expect(apr).not.toBeNull();
    expect(apr as number).toBeGreaterThan(900);
    expect(apr as number).toBeLessThan(1000);
  });
});
