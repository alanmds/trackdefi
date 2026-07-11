/**
 * Testa a montagem do DTO (buildResponse) com posições reais do fixture
 * 0x05963CdC e preços FIXOS — determinístico e offline.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { buildResponse } from "../core/service";
import { toLpPosition, type PoolMeta } from "../core/adapters/aerodrome/index";
import type { SugarPosition } from "../core/adapters/aerodrome/abi";
import type { LpPosition, TokenInfo } from "../core/types";
import fixture from "../poc/fixture-0x05963CdC.json";

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
const CBBTC: TokenInfo = { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC", decimals: 8 };
const CBXEN: TokenInfo = { address: "0x1000000000000000000000000000000000000001", symbol: "cbXEN", decimals: 18 };
const AEROTK: TokenInfo = { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", symbol: "AERO", decimals: 18 };

function tmap(...ts: TokenInfo[]) {
  return new Map(ts.map((t) => [t.address, t] as const));
}

// reproduz as 4 posições do fixture com metadados conhecidos
function normalizedFixture(): LpPosition[] {
  const p1: PoolMeta = { kind: "v2-volatile", spacing: null, tick: null, symbol: "vAMM-USDC/cbXEN", token0: USDC.address, token1: CBXEN.address };
  const p2: PoolMeta = { kind: "v2-volatile", spacing: null, tick: null, symbol: "vAMM-AERO/cbXEN", token0: AEROTK.address, token1: CBXEN.address };
  const p3: PoolMeta = { kind: "concentrated", spacing: 1, tick: -201500, symbol: null, token0: WETH.address, token1: USDC.address };
  const p4: PoolMeta = { kind: "concentrated", spacing: 1, tick: -65000, symbol: null, token0: USDC.address, token1: CBBTC.address };
  return [
    toLpPosition(revive(fixture.positions[0]), p1, tmap(USDC, CBXEN), AEROTK),
    toLpPosition(revive(fixture.positions[1]), p2, tmap(AEROTK, CBXEN), AEROTK),
    toLpPosition(revive(fixture.positions[2]), p3, tmap(WETH, USDC), AEROTK),
    toLpPosition(revive(fixture.positions[3]), p4, tmap(USDC, CBBTC), AEROTK),
  ];
}

const PRICES = new Map<string, number>([
  [WETH.address.toLowerCase(), 1800],
  [USDC.address.toLowerCase(), 1],
  [AEROTK.address.toLowerCase(), 0.5],
  [CBBTC.address.toLowerCase(), 64000],
  // cbXEN de propósito ausente
]);

describe("buildResponse", () => {
  const dto = buildResponse({
    address: fixture.account,
    normalized: normalizedFixture(),
    prices: PRICES,
    scanMs: 1234,
    warnings: [],
  });
  const bySymbol = (s: string) => dto.positions.find((p) => p.poolSymbol === s)!;

  it("metadados básicos e 4 posições", () => {
    expect(dto.chain).toBe("base");
    expect(dto.protocols).toEqual(["aerodrome"]);
    expect(dto.scanMs).toBe(1234);
    expect(dto.positions).toHaveLength(4);
    expect(dto.totalPositions).toBe(4);
  });

  it("ordena por valor: maiores primeiro, sem preço por último", () => {
    expect(dto.positions[0].poolSymbol).toBe("CL1-USDC/cbBTC"); // ~US$ 158
    expect(dto.positions[1].poolSymbol).toBe("CL1-WETH/USDC"); // ~US$ 48
    expect(dto.positions[2].valueUsd).toBeNull();
    expect(dto.positions[3].valueUsd).toBeNull();
  });

  it("tokens sem preço (cbXEN) → valor null e contados em positionsWithoutPrice", () => {
    expect(bySymbol("vAMM-USDC/cbXEN").valueUsd).toBeNull();
    expect(bySymbol("vAMM-AERO/cbXEN").valueUsd).toBeNull();
    expect(dto.totals.positionsWithoutPrice).toBe(2);
  });

  it("posição WETH/USDC precificada bate com o cálculo esperado", () => {
    const p = bySymbol("CL1-WETH/USDC");
    // 0.010096204202506029 WETH * 1800 + 29.885708 USDC
    expect(p.valueUsd).toBeCloseTo(0.010096204202506029 * 1800 + 29.885708, 4);
    expect(p.token0.priceUsd).toBe(1800);
    expect(p.range).not.toBeNull();
    expect(p.range!.inRange).toBe(true);
    expect(p.range!.quoteLabel).toBe("USDC/WETH");
  });

  it("cbBTC concentrada: faixa invertida para USDC/cbBTC legível", () => {
    const p = bySymbol("CL1-USDC/cbBTC");
    expect(p.range!.inverted).toBe(true);
    expect(p.range!.quoteLabel).toBe("USDC/cbBTC");
    expect(p.range!.lower).toBeGreaterThan(50_000);
    expect(p.range!.upper).toBeLessThan(90_000);
  });

  it("totals.valueUsd = soma apenas das posições precificadas", () => {
    const expected = (bySymbol("CL1-WETH/USDC").valueUsd ?? 0) + (bySymbol("CL1-USDC/cbBTC").valueUsd ?? 0);
    expect(dto.totals.valueUsd).toBeCloseTo(expected, 6);
    expect(dto.totals.valueUsd).toBeGreaterThan(190);
    expect(dto.totals.valueUsd).toBeLessThan(230);
  });

  it("recompensas com emissão AERO precificada", () => {
    const p = bySymbol("CL1-WETH/USDC");
    const emission = p.rewards.find((r) => r.kind === "emission");
    expect(emission?.symbol).toBe("AERO");
    expect(emission?.valueUsd).toBeCloseTo((emission?.amount ?? 0) * 0.5, 6);
    expect(p.rewardsUsd).not.toBeNull();
  });

  it("DTO é 100% serializável — sem bigint vazando", () => {
    const round = JSON.parse(JSON.stringify(dto));
    expect(typeof round.positions[0].token0.amountRaw).toBe("string");
    expect(round.positions[1].positionId).toBe("1774608");
  });

  it("corte para carteiras-lixeira: top N por valor, totais sobre todas", () => {
    const cut = buildResponse({
      address: fixture.account,
      normalized: normalizedFixture(),
      prices: PRICES,
      scanMs: 1,
      warnings: [],
      maxPositions: 2,
    });
    expect(cut.totalPositions).toBe(4);
    expect(cut.positions).toHaveLength(2);
    expect(cut.positions[0].poolSymbol).toBe("CL1-USDC/cbBTC");
    expect(cut.totals.valueUsd).toBeCloseTo(dto.totals.valueUsd, 6); // totais NÃO mudam
    expect(cut.totals.positionsWithoutPrice).toBe(2); // conta até as cortadas
  });
});
