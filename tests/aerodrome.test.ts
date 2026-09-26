/**
 * Testes do adapter Aerodrome/Velodrome com posições REAIS congeladas da
 * carteira demo (de terceiro) — ver tests/demo-fixture.ts.
 */

import { describe, expect, it } from "vitest";
import {
  AerodromeAdapter,
  dedupeRaw,
  hasSubstance,
  toLpPosition,
} from "../core/adapters/aerodrome/index";
import type { SugarPosition } from "../core/adapters/aerodrome/abi";
import type { ChainReader } from "../core/types";
import { DEMO_ACCOUNT, EMISSION, poolMeta, rawBy, tokens } from "./demo-fixture";

/** preço do token0 em token1 num tick — fórmula própria, independente do código */
const precoNoTick = (tick: number, d0: number, d1: number) => 1.0001 ** tick * 10 ** (d0 - d1);
const perto = (a: number, b: number) => Math.abs(a / b - 1) < 1e-9;

describe("toLpPosition — concentrada em stake e gerida por ALM (CL100-USDC/WETH na Optimism)", () => {
  const raw = rawBy("optimism", (_, p) => p.id === "47980865");
  const tk = tokens("optimism");
  const pos = toLpPosition(raw, poolMeta("optimism", raw.lp), tk, tk.get(EMISSION.optimism)!, "velodrome", 10);

  it("identifica tipo, NFT, stake e ALM", () => {
    expect(pos.kind).toBe("concentrated");
    expect(pos.positionId).toBe("47980865");
    expect(pos.staked).toBe(true);
    expect(pos.managedByAlm).toBe(raw.alm);
    expect(pos.poolSymbol).toBe("CL100-USDC/WETH");
  });

  it("principal = depositado + em stake, em unidades cruas", () => {
    expect(pos.amount0Raw).toBe(raw.amount0 + raw.staked0);
    expect(pos.amount0Raw).toBe(185532n);
    expect(pos.amount1Raw).toBe(7298240095488n);
  });

  it("em stake na Velodrome: só emissões VELO, sem taxa de swap para o LP", () => {
    expect(pos.rewards).toHaveLength(1);
    expect(pos.rewards[0]).toMatchObject({ kind: "emission", raw: 7854665923116316878n });
    expect(pos.rewards[0].token.symbol).toBe("VELO");
  });

  it("faixa bate com a fórmula do tick, e dá um preço de ETH plausível", () => {
    expect(pos.range!.inRange).toBe(true);
    expect(perto(pos.range!.priceLower, precoNoTick(197000, 6, 18))).toBe(true);
    expect(perto(pos.range!.priceUpper, precoNoTick(201200, 6, 18))).toBe(true);
    // WETH por USDC → invertido é USDC por WETH: o ETH do dia tem de caber aqui
    expect(1 / pos.range!.priceUpper).toBeGreaterThan(1000);
    expect(1 / pos.range!.priceLower).toBeLessThan(5000);
  });
});

describe("toLpPosition — concentrada FORA da faixa (CL100-WETH/KAITO na Base)", () => {
  const raw = rawBy("base", (_, p) => p.id === "7665206");
  const tk = tokens("base");
  const pos = toLpPosition(raw, poolMeta("base", raw.lp), tk, tk.get(EMISSION.base)!);

  it("preço acima da faixa → fora dela, e a posição inteira virou o token1", () => {
    expect(pos.range!.inRange).toBe(false);
    expect(pos.range!.priceCurrent).toBeGreaterThan(pos.range!.priceUpper);
    expect(pos.amount0Raw).toBe(0n);
    expect(pos.amount1Raw).toBe(262965063053765n);
  });

  it("taxas acumuladas antes de sair da faixa continuam a receber", () => {
    expect(pos.rewards.map((r) => r.kind)).toEqual(["fee", "fee"]);
    expect(pos.staked).toBe(false);
  });
});

describe("toLpPosition — clássica volátil sem stake (vAMM-WETH/member na Base)", () => {
  const raw = rawBy("base", (m) => m.symbol === "vAMM-WETH/member");
  const tk = tokens("base");
  const pos = toLpPosition(raw, poolMeta("base", raw.lp), tk, tk.get(EMISSION.base)!);

  it("clássica: sem NFT, sem faixa, sem stake", () => {
    expect(pos.kind).toBe("v2-volatile");
    expect(pos.positionId).toBeNull();
    expect(pos.range).toBeNull();
    expect(pos.staked).toBe(false);
    expect(pos.poolSymbol).toBe("vAMM-WETH/member");
  });

  it("quantidades e taxas pendentes", () => {
    expect(pos.amount0Raw).toBe(627083986158654n);
    expect(pos.amount1Raw).toBe(159539355865710247720600n);
    expect(pos.rewards).toHaveLength(2);
    expect(pos.rewards.every((r) => r.kind === "fee")).toBe(true);
  });
});

describe("dedupeRaw / hasSubstance", () => {
  const blank: SugarPosition = {
    id: 0n,
    lp: "0x2Ec397DafBC0E693026a981f4bca988CDD93406B",
    liquidity: 0n,
    staked: 0n,
    amount0: 0n,
    amount1: 0n,
    staked0: 0n,
    staked1: 0n,
    unstaked_earned0: 0n,
    unstaked_earned1: 0n,
    emissions_earned: 0n,
    tick_lower: 0,
    tick_upper: 0,
    sqrt_ratio_lower: 0n,
    sqrt_ratio_upper: 0n,
    locker: "0x0000000000000000000000000000000000000000",
    unlocks_at: 0,
    alm: "0x0000000000000000000000000000000000000000",
  };

  it("mesmo (pool, id) vira uma posição só; ids distintos permanecem", () => {
    const a = { ...blank, id: 1n, liquidity: 5n };
    expect(dedupeRaw([a, { ...a }])).toHaveLength(1);
    expect(dedupeRaw([a, { ...a, id: 2n }])).toHaveLength(2);
  });

  it("posição totalmente zerada é descartada; qualquer valor a preserva", () => {
    expect(hasSubstance(blank)).toBe(false);
    expect(hasSubstance({ ...blank, emissions_earned: 1n })).toBe(true);
    expect(hasSubstance({ ...blank, staked1: 1n })).toBe(true);
  });
});

describe("varredura com proteção contra truncamento (MAX_POSITIONS = 200)", () => {
  it("janela que devolve exatamente 200 posições é re-varrida em metades", async () => {
    const calls: Array<[bigint, bigint]> = [];
    const mk = (id: number): SugarPosition => ({
      id: BigInt(id),
      lp: "0x2Ec397DafBC0E693026a981f4bca988CDD93406B",
      liquidity: 1n,
      staked: 0n,
      amount0: 0n,
      amount1: 0n,
      staked0: 0n,
      staked1: 0n,
      unstaked_earned0: 0n,
      unstaked_earned1: 0n,
      emissions_earned: 0n,
      tick_lower: 0,
      tick_upper: 0,
      sqrt_ratio_lower: 0n,
      sqrt_ratio_upper: 0n,
      locker: "0x0000000000000000000000000000000000000000",
      unlocks_at: 0,
      alm: "0x0000000000000000000000000000000000000000",
    });
    const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => mk(from + i));

    const reader: ChainReader = {
      async readContract({ functionName, args }) {
        const [limit, offset] = args as [bigint, bigint];
        if (functionName === "positionsUnstakedConcentrated") return [];
        calls.push([limit, offset]);
        // verdade do stub: 180 posições reais, todas nos primeiros 100 pools
        if (limit === 200n && offset === 0n) return range(0, 200); // truncado!
        if (limit === 100n && offset === 0n) return range(0, 150);
        if (limit === 100n && offset === 100n) return range(150, 30);
        return [];
      },
      async multicall({ contracts }) {
        // poolCount: 1 factory com 40 pools (+200 de folga = 240 → 2 janelas)
        return contracts.map(() => ({ status: "success" as const, result: 40n }));
      },
    };

    const adapter = new AerodromeAdapter(reader, {
      factories: ["0x420DD381b31aEf6683db6B902084cB0FFECe40Da"],
      onWarn: () => {},
    });
    const raw = await adapter.fetchRawPositions(DEMO_ACCOUNT);

    expect(raw).toHaveLength(180); // sem a proteção seriam 200 fantasmas truncados
    expect(calls).toContainEqual([100n, 0n]);
    expect(calls).toContainEqual([100n, 100n]);
  });
});
