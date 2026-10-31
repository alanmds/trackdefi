/**
 * Adapter Aero com reader-stub: `positions()` no layout Slipstream, pool achado
 * por tickSpacing, NFT em stake descoberto pelos gauges (sem Sugar), taxa que
 * não vai à conta em stake e emissão pendente paga em xAERO.
 * Números redondos, inventados — nada de posição real (repo público).
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { AeroAdapter } from "../core/adapters/aero/index";
import { AERO_BASE, AERO_CHAINS } from "../core/adapters/aero/config";
import { getSqrtRatioAtTick } from "../core/math/tickmath";
import type { ChainReader } from "../core/types";

const OWNER = "0x00000000000000000000000000000000000000aa" as Address;
const USDC = "0x00000000000000000000000000000000000000c1" as Address;
const WETH = "0x00000000000000000000000000000000000000c2" as Address;
const POOL = "0x00000000000000000000000000000000000000b1" as Address;
const GAUGE = "0x00000000000000000000000000000000000000b3" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const FREE_ID = 7n;
const STAKED_ID = 9n;
const EARNED = 5n * 10n ** 18n;

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const ok = (result: unknown) => ({ status: "success" as const, result });

function makeReader(opts: { stakedIds?: bigint[]; collects?: string[]; getPoolArgs?: unknown[][] } = {}): ChainReader {
  const staked = opts.stakedIds ?? [STAKED_ID];
  return {
    async readContract({ functionName }) {
      if (functionName === "balanceOf") return 1n;
      if (functionName === "allPoolsLength") return 1n;
      throw new Error(`inesperado: ${functionName}`);
    },
    async multicall({ contracts }) {
      return contracts.map((c) => {
        switch (c.functionName) {
          case "tokenOfOwnerByIndex":
            return ok(FREE_ID);
          case "allPools":
            return ok(POOL);
          case "gauge":
            return ok(GAUGE);
          case "stakedValues":
            return ok(staked);
          case "positions": // nonce, operator, token0, token1, tickSpacing, lower, upper, liquidity, fg0, fg1, owed0, owed1
            return ok([0n, ZERO, USDC, WETH, 50, -1000, 1000, 1_000_000n, 0n, 0n, 0n, 0n]);
          case "getPool":
            opts.getPoolArgs?.push([...(c.args ?? [])]);
            return ok(POOL);
          case "slot0":
            return ok([getSqrtRatioAtTick(0), 0, 0, 0, 0, true]);
          case "liquidity":
            return ok(4_000_000n);
          case "stakedLiquidity":
            return ok(2_000_000n);
          case "earned":
            return ok(EARNED);
          case "symbol":
            return ok(eq(c.address, USDC) ? "USDC" : "WETH");
          case "decimals":
            return ok(eq(c.address, USDC) ? 6 : 18);
          default:
            throw new Error(`inesperado: ${c.functionName}`);
        }
      });
    },
    async simulateContract(args) {
      opts.collects?.push(String(args.args && (args.args[0] as { tokenId: bigint }).tokenId));
      return { result: [7n, 8n] } as never;
    },
  };
}

describe("AeroAdapter", () => {
  it("lê NFT livre e NFT em stake, no nome Slipstream", async () => {
    const getPoolArgs: unknown[][] = [];
    const a = new AeroAdapter(makeReader({ getPoolArgs }));
    const pos = await a.getPositions(OWNER);
    expect(pos.map((p) => p.positionId).sort()).toEqual(["7", "9"]);
    expect(pos.every((p) => p.protocol === "aero" && p.chainId === 8453 && p.kind === "concentrated")).toBe(true);
    expect(pos[0].poolSymbol).toBe("CL50-USDC/WETH");
    // o pool é achado por tickSpacing (3º argumento), não por fee tier
    expect(getPoolArgs[0]?.[2]).toBe(50);
    expect(pos.find((p) => p.positionId === "9")!.staked).toBe(true);
    expect(pos.find((p) => p.positionId === "7")!.staked).toBe(false);
  });

  it("em stake: sem taxa a receber (é dos votantes) e emissão em xAERO", async () => {
    const collects: string[] = [];
    const a = new AeroAdapter(makeReader({ collects }));
    const pos = await a.getPositions(OWNER);
    const staked = pos.find((p) => p.staked)!;
    // a simulação de collect() só roda no NFT livre
    expect(collects).toEqual(["7"]);
    expect(staked.rewards.filter((r) => r.kind === "fee")).toEqual([]);
    const em = staked.rewards.filter((r) => r.kind === "emission");
    expect(em).toHaveLength(1);
    expect(em[0].token.symbol).toBe("xAERO");
    expect(em[0].token.address).toBe(AERO_BASE.receiptToken.address);
    expect(em[0].raw).toBe(EARNED);
    expect(staked.earningInputs?.poolStakedLiquidity).toBe(2_000_000n);
    // o NFT livre não tem emissão
    expect(pos.find((p) => !p.staked)!.rewards.some((r) => r.kind === "emission")).toBe(false);
  });

  it("não participa do simulador de APR (taxa dinâmica, sem ritmo de emissão)", () => {
    const a = new AeroAdapter(makeReader());
    expect(typeof a.describePool).not.toBe("function");
  });
});

describe("config da Aero", () => {
  it("cada rede tem factory própria e o xAERO com símbolo e casas", () => {
    expect(new Set(AERO_CHAINS.map((c) => c.chainId)).size).toBe(AERO_CHAINS.length);
    for (const c of AERO_CHAINS) {
      expect(c.receiptToken.symbol).toBe("xAERO");
      expect(c.receiptToken.decimals).toBe(18);
    }
    // o position manager é o mesmo endereço em todas as redes (lista oficial)
    expect(new Set(AERO_CHAINS.map((c) => c.nfpm.toLowerCase())).size).toBe(1);
  });
});
