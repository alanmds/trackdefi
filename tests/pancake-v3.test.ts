/**
 * Adapter PancakeSwap v3 com reader-stub: soma os NFTs da carteira aos que
 * estão em stake no MasterChef, simula o `collect()` no contrato certo e
 * preenche o CAKE a receber e os insumos de emissão das posições em stake.
 * Números redondos, inventados — nada de posição real (repo público).
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { PancakeV3Adapter } from "../core/adapters/pancake-v3/index";
import { PANCAKE_V3_BSC } from "../core/adapters/pancake-v3/config";
import { getSqrtRatioAtTick } from "../core/math/tickmath";
import type { ChainReader } from "../core/types";

const OWNER = "0x00000000000000000000000000000000000000aa" as Address;
const USDT = "0x55d398326f99059fF775485246999027B3197955" as Address;
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as Address;
const POOL = "0x00000000000000000000000000000000000000b1" as Address;
const LM = "0x00000000000000000000000000000000000000b2" as Address;
const { nfpm: NFPM, masterChef: MC } = PANCAKE_V3_BSC;

const TICK_LOWER = -1000;
const TICK_UPPER = 1000;
const TICK_CUR = 0;
const LIQ = 1_000_000n;
const BOOST = 1_500_000n; // boost do veCAKE: 1,5×
const LM_LIQ = 30_000_000n;
const CAKE_PER_SEC_RAW = 10n ** 16n * 10n ** 12n; // 0,01 CAKE/s × precisão 1e12
const NOW = 1_800_000_000;

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function rawPosition() {
  return [0n, "0x0000000000000000000000000000000000000000", USDT, WBNB, 2500, TICK_LOWER, TICK_UPPER, LIQ, 0n, 0n, 0n, 0n];
}

function makeReader(endTime: number, coletas: Array<{ address: string; tokenId: bigint }>): ChainReader {
  return {
    async readContract({ address, functionName }) {
      if (functionName === "balanceOf") return eq(address, NFPM) || eq(address, MC) ? 1n : 0n;
      throw new Error(`inesperado: ${functionName}`);
    },
    async multicall({ contracts }) {
      return contracts.map((c) => {
        const ok = (result: unknown) => ({ status: "success" as const, result });
        switch (c.functionName) {
          case "tokenOfOwnerByIndex":
            return ok(eq(c.address, MC) ? 222n : 111n); // #111 na carteira, #222 em stake
          case "positions":
            return ok(rawPosition());
          case "getPool":
            return ok(POOL);
          case "slot0":
            return ok([getSqrtRatioAtTick(TICK_CUR), TICK_CUR, 0, 0, 0, 209718400, true]);
          case "liquidity":
            return ok(50_000_000n);
          case "symbol":
            return ok(eq(c.address, USDT) ? "USDT" : "WBNB");
          case "decimals":
            return ok(18);
          case "userPositionInfos":
            return ok([LIQ, BOOST, TICK_LOWER, TICK_UPPER, 0n, 0n, OWNER, 7n, 1_500_000_000_000n]);
          case "pendingCake":
            return ok(5n * 10n ** 18n);
          case "getLatestPeriodInfo":
            return ok([CAKE_PER_SEC_RAW, BigInt(endTime)]);
          case "lmPool":
            return ok(LM);
          case "lmLiquidity":
            return ok(LM_LIQ);
          default:
            return { status: "failure" as const, error: new Error(`inesperado: ${c.functionName}`) };
        }
      });
    },
    async simulateContract({ address, args }) {
      const { tokenId } = args![0] as { tokenId: bigint };
      coletas.push({ address, tokenId });
      return { result: [10n, 20n] };
    },
  };
}

describe("PancakeV3Adapter", () => {
  it("soma carteira + MasterChef e marca só a do MasterChef como em stake", async () => {
    const ad = new PancakeV3Adapter(makeReader(NOW + 3600, []), { onWarn: () => {}, nowSec: () => NOW });
    const ps = await ad.getPositions(OWNER);
    expect(ps.map((p) => [p.positionId, p.staked])).toEqual([
      ["111", false],
      ["222", true],
    ]);
    expect(ps.every((p) => p.protocol === "pancakeswap-v3" && p.chainId === 56)).toBe(true);
    expect(ps[0].poolSymbol).toBe("USDT/WBNB 0.25%");
  });

  it("simula o collect() da posição em stake NO MasterChef, e a da carteira no NFPM", async () => {
    const coletas: Array<{ address: string; tokenId: bigint }> = [];
    await new PancakeV3Adapter(makeReader(NOW + 3600, coletas), { nowSec: () => NOW }).getPositions(OWNER);
    const de = (id: bigint) => coletas.find((c) => c.tokenId === id)!.address;
    expect(eq(de(111n), NFPM)).toBe(true);
    expect(eq(de(222n), MC)).toBe(true);
  });

  it("posição em stake: CAKE a receber e insumos de emissão (÷ 1e12)", async () => {
    const ps = await new PancakeV3Adapter(makeReader(NOW + 3600, []), { nowSec: () => NOW }).getPositions(OWNER);
    const st = ps.find((p) => p.staked)!;
    expect(st.rewards).toContainEqual({ token: PANCAKE_V3_BSC.cake, raw: 5n * 10n ** 18n, kind: "emission" });
    expect(st.earningInputs).toMatchObject({
      stakedLiquidity: BOOST,
      poolStakedLiquidity: LM_LIQ,
      emissionRatePerSec: 10n ** 16n,
      emissionToken: PANCAKE_V3_BSC.cake,
    });
    // a da carteira não ganha CAKE nem insumo de emissão
    const livre = ps.find((p) => !p.staked)!;
    expect(livre.rewards.some((r) => r.kind === "emission")).toBe(false);
    expect(livre.earningInputs?.emissionRatePerSec).toBeNull();
  });

  it("período de emissão vencido = 0 CAKE/s agora (não o último valor)", async () => {
    const ps = await new PancakeV3Adapter(makeReader(NOW - 1, []), { nowSec: () => NOW }).getPositions(OWNER);
    expect(ps.find((p) => p.staked)!.earningInputs?.emissionRatePerSec).toBe(0n);
  });
});
