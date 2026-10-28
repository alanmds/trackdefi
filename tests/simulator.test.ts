/**
 * Simulador de APR: a conta (core/simulator/math.ts), o casamento do
 * histórico, a leitura do endereço colado e a prova de origem do pool.
 * Pools reais congelados em 26/10/2026 (`poc/capture-pool-fixture.ts` — dados
 * públicos de pool, nenhuma carteira).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { buildAdapters } from "../core/adapters/registry";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import { UniswapV4Adapter } from "../core/adapters/uniswap-v4/index";
import { poolIdOf } from "../core/adapters/uniswap-v4/abi";
import { UNISWAP_V4_BSC } from "../core/adapters/uniswap-v4/config";
import { getSqrtRatioAtTick } from "../core/math/tickmath";
import { tickToPrice0In1 } from "../core/math/ticks";
import { extractPoolAddress, pairHistory } from "../core/simulator/lookup";
import { alignRange, SIMULATOR_PROTOCOLS, simulate, usableTicks, usdPer, type SimPoolDTO } from "../core/simulator/math";
import type { ChainReader } from "../core/types";

const load = (f: string) => (JSON.parse(readFileSync(`tests/fixtures/${f}`, "utf8")) as { pools: SimPoolDTO[] }).pools[0];
const UNI = load("pool-uniswap-v3-base.json"); // WETH/USDC 0.05%, Base
const CAKE = load("pool-pancake-v3-bsc.json"); // USDT/WBNB 0.01%, BNB Chain, com farm de CAKE

const cur = (p: SimPoolDTO) => tickToPrice0In1(p.tick, p.token0.decimals, p.token1.decimals);
const around = (p: SimPoolDTO, pct: number, extra: Partial<Parameters<typeof simulate>[1]> = {}) =>
  simulate(p, {
    depositUsd: 1000,
    priceLower: cur(p) * (1 - pct / 100),
    priceUpper: cur(p) * (1 + pct / 100),
    staked: true,
    ...extra,
  })!;

describe("alignRange", () => {
  it("a borda de baixo desce e a de cima sobe para o múltiplo do espaçamento", () => {
    const { tickLower, tickUpper } = alignRange(2000, 2500, 10, 18, 6);
    expect(Math.abs(tickLower % 10)).toBe(0);
    expect(Math.abs(tickUpper % 10)).toBe(0);
    expect(tickToPrice0In1(tickLower, 18, 6)).toBeLessThanOrEqual(2000);
    expect(tickToPrice0In1(tickUpper, 18, 6)).toBeGreaterThanOrEqual(2500);
  });

  it("faixa de largura zero vira um espaçamento; ordem trocada é aceita", () => {
    const a = alignRange(2300, 2300, 60, 18, 6);
    expect(a.tickUpper - a.tickLower).toBeGreaterThanOrEqual(60);
    expect(alignRange(2500, 2000, 10, 18, 6)).toEqual(alignRange(2000, 2500, 10, 18, 6));
  });

  it("0 e infinito dão a faixa inteira permitida", () => {
    expect(alignRange(0, Infinity, 200, 18, 6)).toEqual({ tickLower: usableTicks(200).min, tickUpper: usableTicks(200).max });
  });
});

describe("simulate (pool real congelado)", () => {
  it("o depósito vira tokens que valem o depósito", () => {
    const r = around(UNI, 5);
    const valor = r.amount0 * UNI.price0Usd! + r.amount1 * UNI.price1Usd!;
    expect(valor).toBeGreaterThan(999);
    expect(valor).toBeLessThanOrEqual(1000.01);
    // nas bordas, um token só
    expect(r.atLower.amount1).toBe(0);
    expect(r.atUpper.amount0).toBe(0);
  });

  it("faixa mais estreita rende mais e concentra mais", () => {
    const largo = around(UNI, 25);
    const estreito = around(UNI, 2);
    expect(estreito.fees[0].pct!).toBeGreaterThan(largo.fees[0].pct!);
    expect(estreito.concentration!).toBeGreaterThan(largo.concentration!);
  });

  it("faixa inteira tem concentração 1", () => {
    const r = simulate(UNI, { depositUsd: 1000, priceLower: 0, priceUpper: Infinity, staked: false })!;
    expect(r.fullRange).toBe(true);
    expect(r.concentration!).toBeCloseTo(1, 3);
  });

  it("depósito maior dilui: o APR nunca sobe com o valor", () => {
    const pouco = around(UNI, 5);
    const muito = around(UNI, 5, { depositUsd: 5_000_000 });
    expect(muito.fees[0].pct!).toBeLessThan(pouco.fees[0].pct!);
    expect(muito.shareOfActive).toBeGreaterThan(pouco.shareOfActive);
  });

  it("faixa que não contém o preço: 0% agora, e nada de 'se os 7 dias se repetissem'", () => {
    const c = cur(UNI);
    const r = simulate(UNI, { depositUsd: 1000, priceLower: c * 1.2, priceUpper: c * 1.4, staked: false })!;
    expect(r.inRangeNow).toBe(false);
    expect(r.fees.every((f) => f.pct === 0)).toBe(true);
    expect(r.inRangePct).toBeNull();
    expect(r.repeatPct).toBeNull();
    expect(r.amount1).toBe(0); // acima do preço: só token0
  });

  it("tempo na faixa é uma fração, e 'se repetisse' = em faixa × fração", () => {
    const r = around(UNI, 5);
    expect(r.timeInRange!).toBeGreaterThanOrEqual(0);
    expect(r.timeInRange!).toBeLessThanOrEqual(1);
    expect(r.repeatPct!).toBeCloseTo(r.inRangePct! * r.timeInRange!, 8);
  });

  it("emissão que exige stake: 0 fora do stake, positiva em stake", () => {
    expect(CAKE.emission?.requiresStake).toBe(true);
    expect(around(CAKE, 1, { staked: false }).emissionPct).toBe(0);
    expect(around(CAKE, 1, { staked: true }).emissionPct!).toBeGreaterThan(0);
  });

  it("sem preço de um dos tokens não simula (nunca inventa)", () => {
    expect(simulate({ ...UNI, price1Usd: null }, { depositUsd: 1000, priceLower: 1, priceUpper: 1e9, staked: false })).toBeNull();
  });

  it("sem janelas medidas: taxas ficam de fora, não viram 0", () => {
    const r = around({ ...UNI, feeWindows: [] }, 5);
    expect(r.fees).toEqual([]);
    expect(r.inRangePct).toBeNull();
  });

  it("dólares por período", () => {
    expect(usdPer(36.5, 1000, 1)).toBeCloseTo(1, 10);
  });
});

describe("simulate — pool clássico (v2), congelado do vAMM-USDC/AERO", () => {
  const V2 = load("pool-aerodrome-v2-base.json");
  const sim = (extra: Partial<Parameters<typeof simulate>[1]> = {}) =>
    simulate(V2, { depositUsd: 1000, priceLower: 0, priceUpper: Infinity, staked: false, ...extra })!;

  it("é clássico: sem faixa, sempre rendendo, e o depósito vale o depósito", () => {
    const r = sim();
    expect(V2.classic).toBeDefined();
    expect(r.classic).toBe(true);
    expect(r.timeInRange).toBe(1);
    expect(r.repeatPct).toBe(r.inRangePct);
    const valor = r.amount0 * V2.price0Usd! + r.amount1 * V2.price1Usd!;
    expect(valor).toBeGreaterThan(999);
    expect(valor).toBeLessThanOrEqual(1000.01);
  });

  it("taxas = Δindex × LP ÷ 1e18, com diluição — e a faixa pedida é ignorada", () => {
    const r = sim();
    expect(r.fees[0].pct!).toBeGreaterThan(0);
    // faixa nenhuma muda nada num clássico
    expect(sim({ priceLower: 1, priceUpper: 2 }).fees[0].pct).toBe(r.fees[0].pct);
    // depósito enorme dilui
    expect(sim({ depositUsd: 5_000_000 }).fees[0].pct!).toBeLessThan(r.fees[0].pct!);
  });

  it("em stake com gauge pagando, as taxas vão aos votantes", () => {
    const pagando: SimPoolDTO = {
      ...V2,
      emission: { ...V2.emission!, ratePerSec: "1000000000000000000", endedAt: undefined, priceUsd: 1 },
    };
    const r = simulate(pagando, { depositUsd: 1000, priceLower: 0, priceUpper: Infinity, staked: true })!;
    expect(r.feesToVoters).toBe(true);
    expect(r.fees.every((f) => f.pct === 0)).toBe(true);
    expect(r.emissionPct!).toBeGreaterThan(0);
    // gauge parado (o caso real desde o Aero): stake não tira taxa de ninguém
    expect(sim({ staked: true }).feesToVoters).toBe(false);
  });
});

describe("lookup", () => {
  it("tira o endereço de link de DEX, explorer ou texto puro", () => {
    const a = "0xd0b53D9277642d899DF5C87A3966A349A798F224";
    expect(extractPoolAddress(`https://dexscreener.com/base/${a.toLowerCase()}`)).toBe(a.toLowerCase());
    expect(extractPoolAddress(`https://basescan.org/address/${a}#code`)).toBe(a);
    expect(extractPoolAddress(`  ${a} `)).toBe(a);
    expect(extractPoolAddress("0x1234")).toBeNull();
    // id de pool da Uniswap v4 (64 hex) vem antes — e um link do app traz só ele
    const id = `0x${"ab".repeat(32)}`;
    expect(extractPoolAddress(`https://app.uniswap.org/explore/pools/bnb/${id}`)).toBe(id);
    // 65 hex não é nem um nem outro
    expect(extractPoolAddress(`0x${"a".repeat(65)}`)).toBeNull();
  });

  it("histórico do par casa pela hora e descarta hora sem par", () => {
    const h0 = [
      { t: 3600, price: 2000 },
      { t: 7210, price: 2100 },
      { t: 10800, price: 2200 },
    ];
    const h1 = [
      { t: 3590, price: 1 },
      { t: 7200, price: 0.5 },
    ];
    expect(pairHistory(h0, h1)).toEqual([
      { t: 3600, price: 2000 },
      { t: 7210, price: 4200 },
    ]);
    expect(pairHistory(h0, undefined)).toBeNull();
  });

  it("a lista de protocolos da tela é a dos adapters que descrevem pool", () => {
    const comDescricao = new Set(buildAdapters().filter((a) => a.describePool).map((a) => a.protocol));
    expect(new Set(SIMULATOR_PROTOCOLS)).toEqual(comDescricao);
  });
});

describe("describePool — prova de origem pela factory", () => {
  const WETH = "0x4200000000000000000000000000000000000006" as Address;
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
  const POOL = "0xd0b53D9277642d899DF5C87A3966A349A798F224" as Address;
  const TICK = -198800;

  function reader(factoryAnswer: Address): ChainReader {
    return {
      async readContract({ functionName }) {
        if (functionName === "getPool") return factoryAnswer;
        throw new Error(`inesperado: ${functionName}`);
      },
      async multicall({ contracts }) {
        return contracts.map((c) => {
          const ok = (result: unknown) => ({ status: "success" as const, result });
          switch (c.functionName) {
            case "token0":
              return ok(WETH);
            case "token1":
              return ok(USDC);
            case "fee":
              return ok(500);
            case "tickSpacing":
              return ok(10);
            case "liquidity":
              return ok(10n ** 18n);
            case "slot0":
              return ok([getSqrtRatioAtTick(TICK), TICK, 0, 0, 0, 0, true]);
            case "symbol":
              return ok(c.address === WETH ? "WETH" : "USDC");
            case "decimals":
              return ok(c.address === WETH ? 18 : 6);
            case "balanceOf":
              return ok(123n);
            default:
              return { status: "failure" as const, error: new Error(c.functionName) };
          }
        });
      },
    };
  }

  it("a factory devolve o mesmo endereço → foto do pool", async () => {
    const s = await new UniswapV3Adapter(reader(POOL)).describePool(POOL);
    expect(s).not.toBeNull();
    expect(s!.poolSymbol).toBe("WETH/USDC 0.05%");
    expect(s!.tick).toBe(TICK);
    expect(s!.emission).toBeNull();
    expect(s!.reserves).toEqual({ amount0Raw: 123n, amount1Raw: 123n });
  });

  it("a factory devolve OUTRO endereço → não é deste protocolo", async () => {
    const outro = "0x0000000000000000000000000000000000000001" as Address;
    expect(await new UniswapV3Adapter(reader(outro)).describePool(POOL)).toBeNull();
  });
});

describe("describePool — Uniswap v4 pelo id do pool", () => {
  const USDT = "0x55d398326f99059fF775485246999027B3197955" as Address;
  const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as Address;
  const NO_HOOK = "0x0000000000000000000000000000000000000000" as Address;
  const KEY = { currency0: USDT, currency1: USDC, fee: 6, tickSpacing: 1, hooks: NO_HOOK };
  const ID = poolIdOf(KEY);

  function reader(key: typeof KEY, sqrt = getSqrtRatioAtTick(-12)): ChainReader {
    return {
      async readContract() {
        throw new Error("inesperado");
      },
      async multicall({ contracts }) {
        return contracts.map((c) => {
          const ok = (result: unknown) => ({ status: "success" as const, result });
          switch (c.functionName) {
            case "getSlot0":
              return ok([sqrt, -12, 0, 6]);
            case "getLiquidity":
              return ok(10n ** 27n);
            case "poolKeys":
              return ok([key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]);
            case "symbol":
              return ok(c.address === USDT ? "USDT" : "USDC");
            case "decimals":
              return ok(18);
            default:
              return { status: "failure" as const, error: new Error(c.functionName) };
          }
        });
      },
    };
  }
  const adapter = (r: ChainReader) => new UniswapV4Adapter(r, { config: UNISWAP_V4_BSC });

  it("id válido → foto do pool, com o id no lugar do endereço e sem saldo por pool", async () => {
    const s = await adapter(reader(KEY)).describePool(ID);
    expect(s).not.toBeNull();
    expect(s!.poolAddress).toBe(ID);
    expect(s!.poolSymbol).toBe("USDT/USDC 0.0006%");
    expect(s!.reserves).toBeNull();
    expect(s!.v4).toEqual({ stateView: UNISWAP_V4_BSC.stateView, hooks: NO_HOOK, dynamicFee: false });
  });

  it("endereço comum (40 hex), pool não inicializado ou PoolKey de outro pool → null", async () => {
    expect(await adapter(reader(KEY)).describePool(USDT)).toBeNull();
    expect(await adapter(reader(KEY, 0n)).describePool(ID)).toBeNull();
    expect(await adapter(reader({ ...KEY, fee: 500 })).describePool(ID)).toBeNull();
  });
});
