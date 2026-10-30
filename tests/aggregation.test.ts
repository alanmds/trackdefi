/**
 * Agregação multi-protocolo do serviço: falha de UM protocolo vira warning e
 * resposta parcial; só falha tudo se TODOS falharem.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { getWalletPositions, HEAVY_WALLET_POSITIONS } from "../core/service";
import type { LpPosition, ProtocolAdapter } from "../core/types";
import type { PriceProvider } from "../core/prices/types";

/* Sem internet: preço e APR de mentira. Até 27/09/2026 estes testes buscavam
   a DefiLlama de verdade e, com a rede lenta, estouravam os 5 s do vitest —
   falhavam sem nada estar quebrado. */
const precosFalsos: PriceProvider = { name: "teste", fetchUsdPrices: async () => new Map() };
const semApr = async () => null;

const ADDR = "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac" as Address; // carteira demo, de terceiro

function fakePosition(protocol: string): LpPosition {
  const t = (s: string, a: Address) => ({ address: a, symbol: s, decimals: 18 });
  return {
    protocol,
    chainId: 8453,
    poolAddress: "0x2Ec397DafBC0E693026a981f4bca988CDD93406B",
    poolSymbol: `${protocol}-pool`,
    kind: "v2-volatile",
    positionId: null,
    staked: false,
    managedByAlm: null,
    token0: t("AAA", "0x4200000000000000000000000000000000000006"),
    token1: t("BBB", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    amount0Raw: 10n ** 18n,
    amount1Raw: 2n * 10n ** 18n,
    rewards: [],
    range: null,
  };
}

function okAdapter(protocol: string): ProtocolAdapter {
  return { protocol, chainId: 8453, getPositions: async () => [fakePosition(protocol)] };
}

function brokenAdapter(protocol: string): ProtocolAdapter {
  return {
    protocol,
    chainId: 8453,
    getPositions: async () => {
      throw new Error("RPC morreu");
    },
  };
}

describe("getWalletPositions (agregação)", () => {
  it("agrega posições de vários protocolos", async () => {
    const dto = await getWalletPositions(ADDR, [okAdapter("aerodrome"), okAdapter("uniswap-v3")], precosFalsos, semApr, null);
    expect(dto.totalPositions).toBe(2);
    expect(dto.protocols).toEqual(["aerodrome", "uniswap-v3"]);
    expect(dto.chains).toEqual(["base"]); // adapters fake são todos chainId 8453
    expect(new Set(dto.positions.map((p) => p.protocol))).toEqual(new Set(["aerodrome", "uniswap-v3"]));
  });

  it("um protocolo caído → resposta parcial + warning (não derruba tudo)", async () => {
    const dto = await getWalletPositions(ADDR, [okAdapter("aerodrome"), brokenAdapter("uniswap-v3")], precosFalsos, semApr, null);
    expect(dto.totalPositions).toBe(1);
    expect(dto.positions[0].protocol).toBe("aerodrome");
    expect(dto.warnings.some((w) => w.includes("uniswap-v3") && w.includes("RPC morreu"))).toBe(true);
    // e o visitante fica sabendo QUAL caiu, em forma de dado (texto na tela)
    expect(dto.notices).toContainEqual({ kind: "source", protocol: "uniswap-v3", chainId: 8453 });
  });

  it("todos os protocolos caídos → erro (vira 502 na API)", async () => {
    await expect(
      getWalletPositions(ADDR, [brokenAdapter("aerodrome"), brokenAdapter("uniswap-v3")], precosFalsos, semApr, null),
    ).rejects.toThrow(/todos os protocolos/);
  });
});

/* Cadeia de preço (27/09/2026): fonte principal → DexScreener → WETH = ETH →
   preço pelo próprio pool. Tudo com fontes falsas, sem internet. */
describe("cadeia de preço", () => {
  const WETH_OP = "0x4200000000000000000000000000000000000006" as Address;
  const MTL = "0x1000000000000000000000000000000000000abc" as Address;
  const naMetal: ProtocolAdapter = {
    protocol: "velodrome",
    chainId: 1750, // Metal L2: sem DefiLlama e sem DexScreener
    getPositions: async () => [
      {
        ...fakePosition("velodrome"),
        chainId: 1750,
        poolSymbol: "vAMMV2-WETH/MTL",
        token0: { address: WETH_OP, symbol: "WETH", decimals: 18 },
        token1: { address: MTL, symbol: "MTL", decimals: 18 },
        amount0Raw: 10n ** 18n, // 1 WETH
        amount1Raw: 4000n * 10n ** 18n, // 4.000 MTL → 1 MTL = 1/4000 WETH
      },
    ],
  };
  // a principal só conhece o WETH da Ethereum (é de onde sai o preço do ETH)
  const soEthereum: PriceProvider = {
    name: "teste",
    fetchUsdPrices: async (slug) =>
      slug === "ethereum" ? new Map([["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 3000]]) : new Map(),
  };

  it("rede sem fonte de preço: WETH vale o ETH, e o outro token sai do próprio pool", async () => {
    const chamadas: string[] = [];
    const dexEspiao: PriceProvider = { name: "espiao", fetchUsdPrices: async (slug) => (chamadas.push(slug), new Map()) };
    const d = await getWalletPositions(ADDR, [naMetal], soEthereum, semApr, dexEspiao);
    const p = d.positions[0];
    expect(p.token0.priceUsd).toBe(3000); // WETH = ETH
    expect(p.token0.priceSource).toBeUndefined(); // não é "do pool": é o ETH
    expect(p.token1.priceUsd).toBeCloseTo(3000 / 4000, 12); // MTL pelo pool
    expect(p.token1.priceSource).toBe("pool");
    expect(chamadas).toEqual([]); // a Metal não está na DexScreener: nem pergunta
  });

  it("DexScreener só é chamada para o que a principal não cobriu, e só onde ela indexa", async () => {
    const pedidos: string[][] = [];
    const dex: PriceProvider = {
      name: "dex",
      fetchUsdPrices: async (slug, addrs) => {
        pedidos.push([slug, ...addrs.map((a) => a.toLowerCase())]);
        return new Map([["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 1]]);
      },
    };
    const principal: PriceProvider = {
      name: "principal",
      fetchUsdPrices: async (slug) => (slug === "base" ? new Map([[WETH_OP, 3000]]) : new Map()),
    };
    const d = await getWalletPositions(ADDR, [okAdapter("aerodrome")], principal, semApr, dex);
    expect(pedidos).toEqual([["base", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"]]); // só o que faltou
    expect(d.positions[0].token1.priceUsd).toBe(1);
    expect(d.positions[0].token1.priceSource).toBeUndefined();
  });
});

describe("prazo da varredura (carteira-robô)", () => {
  const curto = { adaptersMs: 60, pricesMs: 200, extrasMs: 300 };

  it("adapter que passa do prazo fica de fora com aviso `slow`; os outros entram", async () => {
    const lento: ProtocolAdapter = {
      protocol: "uniswap-v4",
      chainId: 4663,
      getPositions: () => new Promise<LpPosition[]>((r) => setTimeout(() => r([fakePosition("uniswap-v4")]), 5_000)),
    };
    const t = Date.now();
    const d = await getWalletPositions(ADDR, [okAdapter("aerodrome"), lento], precosFalsos, semApr, null, curto);
    expect(Date.now() - t).toBeLessThan(2_000); // não esperou os 5 s do adapter
    expect(d.positions.map((p) => p.protocol)).toEqual(["aerodrome"]);
    expect(d.notices).toContainEqual({ kind: "slow", protocol: "uniswap-v4", chainId: 4663 });
  });

  it("preço que passa do prazo: devolve o que já tem e avisa `slowPrices`", async () => {
    const lentos: PriceProvider = {
      name: "lento",
      fetchUsdPrices: () => new Promise((r) => setTimeout(() => r(new Map()), 5_000)),
    };
    const t = Date.now();
    const d = await getWalletPositions(ADDR, [okAdapter("aerodrome")], lentos, semApr, null, curto);
    expect(Date.now() - t).toBeLessThan(2_000);
    expect(d.positions).toHaveLength(1);
    expect(d.positions[0].valueUsd).toBeNull(); // sem preço = "—", nunca inventado
    expect(d.notices).toContainEqual({ kind: "slowPrices" });
  });

  it("carteira normal não ganha aviso de prazo", async () => {
    const d = await getWalletPositions(ADDR, [okAdapter("aerodrome")], precosFalsos, semApr, null);
    expect(d.notices.some((n) => n.kind === "slow" || n.kind === "slowPrices" || n.kind === "heavy")).toBe(false);
  });

  it("acima de ${HEAVY_WALLET_POSITIONS} posições: aviso `heavy` e sem 2ª fonte de preço", async () => {
    const muitos: ProtocolAdapter = {
      protocol: "uniswap-v2",
      chainId: 8453,
      getPositions: async () => Array.from({ length: HEAVY_WALLET_POSITIONS + 1 }, () => fakePosition("uniswap-v2")),
    };
    let chamouDex = false;
    const dex: PriceProvider = { name: "dex", fetchUsdPrices: async () => { chamouDex = true; return new Map(); } };
    const d = await getWalletPositions(ADDR, [muitos], precosFalsos, semApr, dex);
    expect(d.notices).toContainEqual({ kind: "heavy", positions: HEAVY_WALLET_POSITIONS + 1 });
    expect(chamouDex).toBe(false);
    expect(d.totalPositions).toBe(HEAVY_WALLET_POSITIONS + 1);
  });
});
