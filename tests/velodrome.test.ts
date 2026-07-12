/**
 * Receita A: o adapter Sugar parametrizado vira Velodrome/Optimism só com a
 * config — protocolo, chainId e token de emissões (VELO) trocam juntos.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { AerodromeAdapter, toLpPosition, type PoolMeta } from "../core/adapters/aerodrome/index";
import { AERODROME_BASE, VELODROME_OPTIMISM } from "../core/adapters/aerodrome/config";
import type { ChainReader, TokenInfo } from "../core/types";
import fixture from "../poc/fixture-0x05963CdC.json";

const deadReader: ChainReader = {
  readContract: async () => {
    throw new Error("não usado neste teste");
  },
  multicall: async () => [],
};

describe("SugarChainConfig (Receita A)", () => {
  it("config default = Aerodrome na Base", () => {
    const a = new AerodromeAdapter(deadReader);
    expect(a.protocol).toBe("aerodrome");
    expect(a.chainId).toBe(8453);
  });

  it("config da Velodrome muda protocolo e rede sem tocar na lógica", () => {
    const v = new AerodromeAdapter(deadReader, { config: VELODROME_OPTIMISM });
    expect(v.protocol).toBe("velodrome");
    expect(v.chainId).toBe(10);
  });

  it("as duas configs divergem onde devem (sugar, factories, emissões)", () => {
    expect(VELODROME_OPTIMISM.sugar).not.toBe(AERODROME_BASE.sugar);
    expect(VELODROME_OPTIMISM.emissionsToken).not.toBe(AERODROME_BASE.emissionsToken);
    expect(VELODROME_OPTIMISM.factories.length).toBeGreaterThan(0);
  });

  it("toLpPosition etiqueta protocolo/rede recebidos (posição real do fixture)", () => {
    const j = fixture.positions[2];
    const raw = {
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
    const WETH: TokenInfo = { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 };
    const USDC: TokenInfo = { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 };
    const VELO: TokenInfo = { address: VELODROME_OPTIMISM.emissionsToken, symbol: "VELO", decimals: 18 };
    const pool: PoolMeta = { kind: "concentrated", spacing: 1, tick: -201500, symbol: null, token0: WETH.address, token1: USDC.address };
    const tokens = new Map<Address, TokenInfo>([
      [WETH.address, WETH],
      [USDC.address, USDC],
    ]);

    const pos = toLpPosition(raw, pool, tokens, VELO, "velodrome", 10);
    expect(pos.protocol).toBe("velodrome");
    expect(pos.chainId).toBe(10);
    expect(pos.rewards.find((r) => r.kind === "emission")?.token.symbol).toBe("VELO");
  });

  it("retrocompatibilidade: sem os novos parâmetros, continua aerodrome/Base", () => {
    const j = fixture.positions[0];
    const raw = {
      id: BigInt(j.id),
      lp: j.lp as Address,
      liquidity: BigInt(j.liquidity),
      staked: 0n,
      amount0: BigInt(j.amount0),
      amount1: BigInt(j.amount1),
      staked0: 0n,
      staked1: 0n,
      unstaked_earned0: 0n,
      unstaked_earned1: 0n,
      emissions_earned: 0n,
      tick_lower: 0,
      tick_upper: 0,
      sqrt_ratio_lower: 0n,
      sqrt_ratio_upper: 0n,
      locker: "0x0000000000000000000000000000000000000000" as Address,
      unlocks_at: 0,
      alm: "0x0000000000000000000000000000000000000000" as Address,
    };
    const T0: TokenInfo = { address: "0x1000000000000000000000000000000000000001", symbol: "A", decimals: 18 };
    const T1: TokenInfo = { address: "0x1000000000000000000000000000000000000002", symbol: "B", decimals: 18 };
    const pool: PoolMeta = { kind: "v2-volatile", spacing: null, tick: null, symbol: "vAMM-A/B", token0: T0.address, token1: T1.address };
    const pos = toLpPosition(raw, pool, new Map([[T0.address, T0], [T1.address, T1]]), T0);
    expect(pos.protocol).toBe("aerodrome");
    expect(pos.chainId).toBe(8453);
  });
});
