/**
 * Receita A: o adapter Sugar parametrizado vira Velodrome/Optimism só com a
 * config — protocolo, chainId e token de emissões (VELO) trocam juntos.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { AerodromeAdapter, toLpPosition, type PoolMeta } from "../core/adapters/aerodrome/index";
import { AERODROME_BASE, VELODROME_OPTIMISM } from "../core/adapters/aerodrome/config";
import type { ChainReader, TokenInfo } from "../core/types";
import { EMISSION, poolMeta, rawBy, tokens } from "./demo-fixture";

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

  it("toLpPosition etiqueta protocolo/rede recebidos (posição real da carteira demo)", () => {
    const raw = rawBy("optimism", (_, p) => p.id === "47980865");
    const tk = tokens("optimism");
    const pos = toLpPosition(raw, poolMeta("optimism", raw.lp), tk, tk.get(EMISSION.optimism)!, "velodrome", 10);
    expect(pos.protocol).toBe("velodrome");
    expect(pos.chainId).toBe(10);
    expect(pos.rewards.find((r) => r.kind === "emission")?.token.symbol).toBe("VELO");
  });

  it("retrocompatibilidade: sem os novos parâmetros, continua aerodrome/Base", () => {
    const j = rawBy("base", (m) => m.symbol === "vAMM-WETH/member");
    const raw = {
      id: j.id,
      lp: j.lp,
      liquidity: j.liquidity,
      staked: 0n,
      amount0: j.amount0,
      amount1: j.amount1,
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
