/**
 * Adapter Ramses V3 com reader-stub: o formato de 10 campos do `positions()`,
 * o pool achado por tickSpacing, e as recompensas do gauge pagas SEM stake.
 * Usa a config da HyperEVM: é lá que existem os gauges. Números redondos, inventados — nada de posição real (repo público).
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { RamsesV3Adapter } from "../core/adapters/ramses-v3/index";
import { RAMSES_V3_HYPEREVM } from "../core/adapters/ramses-v3/config";
import { getSqrtRatioAtTick } from "../core/math/tickmath";
import type { ChainReader } from "../core/types";

const OWNER = "0x00000000000000000000000000000000000000aa" as Address;
const USDC = "0x00000000000000000000000000000000000000c1" as Address;
const WHYPE = "0x00000000000000000000000000000000000000c2" as Address;
const RAM = "0x00000000000000000000000000000000000000c3" as Address;
const POOL = "0x00000000000000000000000000000000000000b1" as Address;
const VOTER = "0x00000000000000000000000000000000000000b2" as Address;
const GAUGE = "0x00000000000000000000000000000000000000b3" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const LIQ = 1_000_000n;
const POOL_LIQ = 4_000_000n;
const RAM_RATE = 10n ** 18n;

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function makeReader(voter: Address, getPoolArgs: unknown[][] = []): ChainReader {
  return {
    async readContract({ address, functionName }) {
      if (functionName === "balanceOf") return 1n;
      if (functionName === "voter" && eq(address, RAMSES_V3_HYPEREVM.feeCollector)) return voter;
      throw new Error(`inesperado: ${functionName}`);
    },
    async multicall({ contracts }) {
      return contracts.map((c) => {
        const ok = (result: unknown) => ({ status: "success" as const, result });
        switch (c.functionName) {
          case "tokenOfOwnerByIndex":
            return ok(5n);
          case "positions": // token0, token1, tickSpacing, tickLower, tickUpper, liquidity, fgi0, fgi1, owed0, owed1
            return ok([USDC, WHYPE, 50, -1000, 1000, LIQ, 0n, 0n, 0n, 0n]);
          case "getPool":
            getPoolArgs.push([...(c.args ?? [])]);
            return ok(POOL);
          case "slot0":
            return ok([getSqrtRatioAtTick(0), 0, 0, 0, 0, 123456, true]);
          case "liquidity":
            return ok(POOL_LIQ);
          case "symbol":
            return ok(eq(c.address, USDC) ? "USDC" : eq(c.address, WHYPE) ? "WHYPE" : "RAM");
          case "decimals":
            return ok(eq(c.address, USDC) ? 6 : 18);
          case "gaugeForPool":
            return ok(GAUGE);
          case "getRewardTokens":
            return ok([WHYPE, RAM]);
          case "rewardRate":
            return ok(eq(c.args![0] as string, RAM) ? RAM_RATE : 0n);
          case "earned":
            return ok(eq(c.args![0] as string, RAM) ? 7n * 10n ** 18n : 0n);
          default:
            return { status: "failure" as const, error: new Error(`inesperado: ${c.functionName}`) };
        }
      });
    },
    async simulateContract() {
      return { result: [11n, 22n] };
    },
  };
}

describe("RamsesV3Adapter", () => {
  it("lê o positions() de 10 campos e acha o pool pelo tickSpacing", async () => {
    const args: unknown[][] = [];
    const ps = await new RamsesV3Adapter(makeReader(VOTER, args), { config: RAMSES_V3_HYPEREVM }).getPositions(OWNER);
    expect(ps).toHaveLength(1);
    const p = ps[0];
    expect(p.protocol).toBe("ramses-v3");
    expect(p.chainId).toBe(999);
    expect(p.poolSymbol).toBe("CL50-USDC/WHYPE");
    expect(p.range).toMatchObject({ tickLower: -1000, tickUpper: 1000, inRange: true });
    expect(args).toEqual([[USDC, WHYPE, 50]]);
    expect(p.rewards.filter((r) => r.kind === "fee").map((r) => r.raw)).toEqual([11n, 22n]);
  });

  it("gauge paga SEM stake: RAM a receber e insumos de emissão, sem o selo de stake", async () => {
    const p = (await new RamsesV3Adapter(makeReader(VOTER), { config: RAMSES_V3_HYPEREVM }).getPositions(OWNER))[0];
    expect(p.staked).toBe(false);
    expect(p.rewards).toContainEqual({ token: { address: RAM, symbol: "RAM", decimals: 18 }, raw: 7n * 10n ** 18n, kind: "emission" });
    // o token que paga 0 não vira recompensa
    expect(p.rewards.some((r) => r.kind === "emission" && r.token.symbol === "WHYPE")).toBe(false);
    expect(p.earningInputs).toMatchObject({
      emissionsWithoutStake: true,
      stakedLiquidity: LIQ,
      poolStakedLiquidity: POOL_LIQ,
      emissionRatePerSec: RAM_RATE,
      emissionToken: { address: RAM, symbol: "RAM", decimals: 18 },
    });
  });

  it("rede sem Voter (Robinhood): só taxas, sem emissão", async () => {
    const p = (await new RamsesV3Adapter(makeReader(ZERO), { config: RAMSES_V3_HYPEREVM }).getPositions(OWNER))[0];
    expect(p.rewards.some((r) => r.kind === "emission")).toBe(false);
    expect(p.earningInputs?.emissionsWithoutStake).toBeUndefined();
    expect(p.earningInputs?.emissionRatePerSec).toBeNull();
  });
});
