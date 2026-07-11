/**
 * Adapter Uniswap V3 com reader-stub: enumeração por NFT, amounts pela nossa
 * matemática Q96, taxas via collect() simulado, filtro de posições fechadas.
 * Ticks/valores emprestados do fixture real (WETH/USDC, faixa validada).
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import { amountsForLiquidity } from "../core/math/liquidity";
import { getSqrtRatioAtTick } from "../core/math/tickmath";
import type { ChainReader } from "../core/types";

const OWNER = "0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC" as Address;
const WETH = "0x4200000000000000000000000000000000000006" as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const POOL = "0xd0b53D9277642d899DF5C87A3966A349A798F224" as Address;
const NFPM = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";

const TICK_LOWER = -203189;
const TICK_UPPER = -200313;
const TICK_CUR = -201500;
const LIQ = 8184687151171n;

// positions(tokenId) na ordem do ABI (12 campos)
function rawPosition(liquidity: bigint, owed0: bigint, owed1: bigint) {
  return [0n, "0x0000000000000000000000000000000000000000", WETH, USDC, 500, TICK_LOWER, TICK_UPPER, liquidity, 0n, 0n, owed0, owed1];
}

function makeReader(): ChainReader {
  return {
    async readContract({ functionName }) {
      if (functionName === "balanceOf") return 2n;
      throw new Error(`inesperado: ${functionName}`);
    },
    async multicall({ contracts }) {
      return contracts.map((c) => {
        switch (c.functionName) {
          case "tokenOfOwnerByIndex":
            return { status: "success" as const, result: (c.args![1] as bigint) === 0n ? 111n : 222n };
          case "positions":
            // #111 ativa; #222 fechada mas com taxas a receber
            return {
              status: "success" as const,
              result: (c.args![0] as bigint) === 111n ? rawPosition(LIQ, 0n, 0n) : rawPosition(0n, 5000n, 0n),
            };
          case "getPool":
            return { status: "success" as const, result: POOL };
          case "slot0":
            return {
              status: "success" as const,
              result: [getSqrtRatioAtTick(TICK_CUR), TICK_CUR, 0, 0, 0, 0, true],
            };
          case "symbol":
            return { status: "success" as const, result: c.address === WETH ? "WETH" : "USDC" };
          case "decimals":
            return { status: "success" as const, result: c.address === WETH ? 18 : 6 };
          default:
            return { status: "failure" as const, error: new Error(`inesperado: ${c.functionName}`) };
        }
      });
    },
    async simulateContract({ functionName, args }) {
      if (functionName !== "collect") throw new Error("inesperado");
      const params = (args![0] as { tokenId: bigint });
      // #111: taxas acumuladas 777/888; #222: só o owed 5000/0
      return { result: params.tokenId === 111n ? [777n, 888n] : [5000n, 0n] };
    },
  };
}

describe("UniswapV3Adapter", () => {
  it("mapeia as posições: ativa e fechada-com-taxas, ambas presentes", async () => {
    const adapter = new UniswapV3Adapter(makeReader(), { onWarn: () => {} });
    const positions = await adapter.getPositions(OWNER);

    expect(positions).toHaveLength(2);
    const active = positions.find((p) => p.positionId === "111")!;
    const closed = positions.find((p) => p.positionId === "222")!;

    expect(active.protocol).toBe("uniswap-v3");
    expect(active.kind).toBe("concentrated");
    expect(active.staked).toBe(false);
    expect(active.poolSymbol).toBe("WETH/USDC 0.05%");
    expect(active.poolAddress).toBe(POOL);
    expect(closed.amount0Raw).toBe(0n); // liquidez zerada
  });

  it("amounts vêm da nossa matemática Q96 (mesmos valores do core)", async () => {
    const adapter = new UniswapV3Adapter(makeReader(), { onWarn: () => {} });
    const active = (await adapter.getPositions(OWNER)).find((p) => p.positionId === "111")!;
    const expected = amountsForLiquidity(
      LIQ,
      getSqrtRatioAtTick(TICK_CUR),
      getSqrtRatioAtTick(TICK_LOWER),
      getSqrtRatioAtTick(TICK_UPPER),
    );
    expect(active.amount0Raw).toBe(expected.amount0);
    expect(active.amount1Raw).toBe(expected.amount1);
    expect(active.amount0Raw > 0n && active.amount1Raw > 0n).toBe(true); // na faixa: mistura
  });

  it("faixa: na faixa com o tick corrente do slot0, preços em USDC por WETH", async () => {
    const adapter = new UniswapV3Adapter(makeReader(), { onWarn: () => {} });
    const active = (await adapter.getPositions(OWNER)).find((p) => p.positionId === "111")!;
    expect(active.range!.inRange).toBe(true);
    expect(active.range!.priceLower).toBeCloseTo(1499.87, 1);
    expect(active.range!.priceUpper).toBeCloseTo(1999.64, 1);
  });

  it("taxas pendentes vêm do collect() simulado", async () => {
    const adapter = new UniswapV3Adapter(makeReader(), { onWarn: () => {} });
    const positions = await adapter.getPositions(OWNER);
    const active = positions.find((p) => p.positionId === "111")!;
    expect(active.rewards).toHaveLength(2);
    expect(active.rewards[0]).toMatchObject({ kind: "fee", raw: 777n });
    expect(active.rewards[1]).toMatchObject({ kind: "fee", raw: 888n });
  });

  it("sem simulateContract: degrada para tokensOwed com aviso", async () => {
    const reader = makeReader();
    delete (reader as { simulateContract?: unknown }).simulateContract;
    const warnings: string[] = [];
    const adapter = new UniswapV3Adapter(reader, { onWarn: (m) => warnings.push(m) });
    const closed = (await adapter.getPositions(OWNER)).find((p) => p.positionId === "222")!;
    expect(closed.rewards[0]).toMatchObject({ kind: "fee", raw: 5000n });
    expect(warnings.some((w) => w.includes("simulateContract"))).toBe(true);
  });

  it("carteira sem NFTs → lista vazia sem chamadas extras", async () => {
    const reader = makeReader();
    reader.readContract = async () => 0n;
    const adapter = new UniswapV3Adapter(reader, { onWarn: () => {} });
    expect(await adapter.getPositions(OWNER)).toHaveLength(0);
  });

  it("respeita o teto de NFTs com aviso (carteiras-robô)", async () => {
    const reader = makeReader();
    reader.readContract = async () => 5000n;
    const warnings: string[] = [];
    const seen: number[] = [];
    const original = reader.multicall.bind(reader);
    reader.multicall = async (args) => {
      if (args.contracts[0]?.functionName === "tokenOfOwnerByIndex") seen.push(args.contracts.length);
      return original(args);
    };
    const adapter = new UniswapV3Adapter(reader, { maxNfts: 3, onWarn: (m) => warnings.push(m) });
    await adapter.getPositions(OWNER);
    expect(seen[0]).toBe(3);
    expect(warnings.some((w) => w.includes("5000"))).toBe(true);
  });
});
