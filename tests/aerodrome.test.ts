/**
 * Testes do adapter Aerodrome usando o fixture REAL congelado na Fase 1
 * (carteira 0x05963CdC, validada pelo Alan contra o site da Aerodrome).
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  AerodromeAdapter,
  dedupeRaw,
  hasSubstance,
  toLpPosition,
  type PoolMeta,
} from "../core/adapters/aerodrome/index";
import type { SugarPosition } from "../core/adapters/aerodrome/abi";
import type { ChainReader, TokenInfo } from "../core/types";
import fixture from "../poc/fixture-0x05963CdC.json";

// fixture JSON guarda bigints como string — reidrata para o tipo do Sugar
function revive(j: (typeof fixture)["positions"][number]): SugarPosition {
  return {
    id: BigInt(j.id),
    lp: j.lp as Address,
    liquidity: BigInt(j.liquidity),
    staked: BigInt(j.staked),
    amount0: BigInt(j.amount0),
    amount1: BigInt(j.amount1),
    staked0: BigInt(j.staked0),
    staked1: BigInt(j.staked1),
    unstaked_earned0: BigInt(j.unstaked_earned0),
    unstaked_earned1: BigInt(j.unstaked_earned1),
    emissions_earned: BigInt(j.emissions_earned),
    tick_lower: j.tick_lower,
    tick_upper: j.tick_upper,
    sqrt_ratio_lower: BigInt(j.sqrt_ratio_lower),
    sqrt_ratio_upper: BigInt(j.sqrt_ratio_upper),
    locker: j.locker as Address,
    unlocks_at: j.unlocks_at,
    alm: j.alm as Address,
  };
}

const WETH: TokenInfo = { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 };
const USDC: TokenInfo = { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 };
const CBXEN: TokenInfo = { address: "0x1000000000000000000000000000000000000001", symbol: "cbXEN", decimals: 18 };
const AEROTK: TokenInfo = { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", symbol: "AERO", decimals: 18 };

function tokenMap(...ts: TokenInfo[]): Map<Address, TokenInfo> {
  return new Map(ts.map((t) => [t.address, t]));
}

describe("toLpPosition — concentrada em stake (WETH/USDC #1774608 do fixture)", () => {
  const raw = revive(fixture.positions[2]);
  const pool: PoolMeta = {
    kind: "concentrated",
    spacing: 1,
    tick: -201500, // dentro de [-203189, -200313)
    symbol: null,
    token0: WETH.address,
    token1: USDC.address,
  };
  const pos = toLpPosition(raw, pool, tokenMap(WETH, USDC), AEROTK);

  it("identifica tipo, NFT e stake", () => {
    expect(pos.kind).toBe("concentrated");
    expect(pos.positionId).toBe("1774608");
    expect(pos.staked).toBe(true);
    expect(pos.managedByAlm).toBeNull();
    expect(pos.poolSymbol).toBe("CL1-WETH/USDC");
  });

  it("principal = depositado + em stake, em unidades cruas", () => {
    expect(pos.amount0Raw).toBe(10096204202506029n);
    expect(pos.amount1Raw).toBe(29885708n);
  });

  it("recompensas: 2 taxas + emissões AERO", () => {
    expect(pos.rewards).toHaveLength(3);
    expect(pos.rewards[0]).toMatchObject({ kind: "fee", raw: 98502432214178n });
    expect(pos.rewards[0].token.symbol).toBe("WETH");
    expect(pos.rewards[1]).toMatchObject({ kind: "fee", raw: 164614n });
    expect(pos.rewards[2]).toMatchObject({ kind: "emission", raw: 1353136881445108160n });
    expect(pos.rewards[2].token.symbol).toBe("AERO");
  });

  it("faixa em USDC por WETH bate com o site da Aerodrome", () => {
    expect(pos.range).not.toBeNull();
    expect(pos.range!.inRange).toBe(true);
    expect(pos.range!.priceLower).toBeCloseTo(1499.87, 1);
    expect(pos.range!.priceUpper).toBeCloseTo(1999.64, 1);
  });
});

describe("toLpPosition — clássica volátil (USDC/cbXEN do fixture)", () => {
  const raw = revive(fixture.positions[0]);
  const pool: PoolMeta = {
    kind: "v2-volatile",
    spacing: null,
    tick: null,
    symbol: "vAMM-USDC/cbXEN",
    token0: USDC.address,
    token1: CBXEN.address,
  };
  const pos = toLpPosition(raw, pool, tokenMap(USDC, CBXEN), AEROTK);

  it("clássica: sem NFT, sem faixa, sem stake", () => {
    expect(pos.kind).toBe("v2-volatile");
    expect(pos.positionId).toBeNull();
    expect(pos.range).toBeNull();
    expect(pos.staked).toBe(false);
    expect(pos.poolSymbol).toBe("vAMM-USDC/cbXEN");
  });

  it("quantidades e taxas pendentes", () => {
    expect(pos.amount0Raw).toBe(253626n);
    expect(pos.amount1Raw).toBe(24271189510760105110149906955n);
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
    const raw = await adapter.fetchRawPositions("0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC");

    expect(raw).toHaveLength(180); // sem a proteção seriam 200 fantasmas truncados
    expect(calls).toContainEqual([100n, 0n]);
    expect(calls).toContainEqual([100n, 100n]);
  });
});
