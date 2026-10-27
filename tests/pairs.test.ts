/**
 * Descoberta de pares: a montagem da tabela (core/discovery/pairs.ts) e o
 * filtro da tela (app/ui/PairFinder.tsx). Linhas sintéticas no formato do
 * yields.llama.fi — tokens e números redondos, nada de carteira.
 */

import { describe, expect, it } from "vitest";
import { buildAdapters } from "../core/adapters/registry";
import { buildPairs, DISCOVERY_PROJECTS, mcapKey, pickByTvl, poolQueryOf, type PairDTO } from "../core/discovery/pairs";
import type { LlamaRowFull } from "../core/yields/defillama";
import { filterPairs } from "../app/ui/PairFinder";

const WETH_BASE = "0x4200000000000000000000000000000000000006";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const XYZ_BASE = "0x1111111111111111111111111111111111111111";
const UUID = "b99bcdf5-1350-4269-981e-0e9b5cccb007";

const row = (over: Partial<LlamaRowFull>): LlamaRowFull => ({
  chain: "Base",
  project: "uniswap-v3",
  pool: UUID,
  symbol: "WETH-USDC",
  tvlUsd: 1_000_000.4,
  apy: 12.3456,
  apyBase: 12.3456,
  apyReward: null,
  apyMean30d: null,
  poolMeta: "0.05%",
  underlyingTokens: [WETH_BASE, USDC_BASE],
  volumeUsd1d: 500_000.7,
  volumeUsd7d: null,
  ...over,
});

const covered = new Set(["uniswap-v3@8453", "aerodrome@8453"]);
const caps = new Map([
  ["coingecko:ethereum", 280e9],
  [`base:${USDC_BASE}`.toLowerCase(), 70e9],
  [`base:${XYZ_BASE}`.toLowerCase(), 5e6],
]);

describe("buildPairs", () => {
  it("monta a linha: market cap do token MENOR, números arredondados", () => {
    const [p] = buildPairs([row({})], covered, caps);
    expect(p).toMatchObject({ chainId: 8453, protocol: "uniswap-v3", symbol: "WETH-USDC", apr: 12.35, tvlUsd: 1_000_000, volume1d: 500_001 });
    expect(p.mcapMin).toBe(70e9);
  });

  it("WETH conta como ETH, não como o contrato embrulhado", () => {
    expect(mcapKey(8453, WETH_BASE)).toBe("coingecko:ethereum");
    expect(mcapKey(1, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")).toBe("coingecko:ethereum");
    expect(mcapKey(56, "0x0000000000000000000000000000000000000000")).toBe("coingecko:binancecoin");
    expect(mcapKey(8453, XYZ_BASE)).toBe(`base:${XYZ_BASE}`);
  });

  it("sem o market cap de um dos tokens, fica sem (nunca usa só o outro)", () => {
    const [p] = buildPairs([row({ underlyingTokens: [WETH_BASE, "0x2222222222222222222222222222222222222222"] })], covered, caps);
    expect(p.mcapMin).toBeNull();
  });

  it("só entram os pares que o site lê, com dois tokens e id válido", () => {
    const linhas = [
      row({ project: "uniswap-v2" }), // o site não lê v2 da Uniswap
      row({ chain: "Ethereum" }), // rede fora do `covered` deste teste
      row({ underlyingTokens: [WETH_BASE] }),
      row({ pool: "javascript:alert(1)" }),
      row({ project: "aerodrome-slipstream", poolMeta: "CL100 - 0.05%" }),
    ];
    expect(buildPairs(linhas, covered, caps).map((p) => p.protocol)).toEqual(["aerodrome"]);
  });

  it("APR acima do teto de sanidade vira '—', a linha continua", () => {
    const [p] = buildPairs([row({ apy: 28_350 })], covered, caps);
    expect(p.apr).toBeNull();
  });

  it("todo projeto mapeado aponta para um protocolo que o site lê", () => {
    const lidos = new Set(buildAdapters().map((a) => a.protocol));
    for (const proto of Object.values(DISCOVERY_PROJECTS)) expect(lidos.has(proto), proto).toBe(true);
  });
});

describe("botão Simular: forma do pool e endereço", () => {
  const t = [WETH_BASE, USDC_BASE];

  it("fee tier vira milionésimos; CL vira tick spacing", () => {
    expect(poolQueryOf("uniswap-v3", "0.05%", t)).toEqual([{ token0: WETH_BASE, token1: USDC_BASE, fee: 500, tickSpacing: null }]);
    expect(poolQueryOf("pancakeswap-amm-v3", "0.01%", t)[0].fee).toBe(100);
    expect(poolQueryOf("sushiswap-v3", "1%", t)[0].fee).toBe(10_000);
    expect(poolQueryOf("aerodrome-slipstream", "CL100 - 0.0217%", t)).toEqual([
      { token0: WETH_BASE, token1: USDC_BASE, fee: null, tickSpacing: 100 },
    ]);
  });

  it("clássico: Velodrome diz stable/volatile; Aerodrome não diz, e vão as duas candidatas", () => {
    expect(poolQueryOf("velodrome-v2", "stable - 0.05%", t).map((q) => q.stable)).toEqual([true]);
    expect(poolQueryOf("velodrome-v2", "volatile - 1%", t).map((q) => q.stable)).toEqual([false]);
    expect(poolQueryOf("aerodrome-v1", null, t).map((q) => q.stable)).toEqual([true, false]);
  });

  it("o que o simulador ainda não atende fica sem consulta", () => {
    expect(poolQueryOf("uniswap-v4", "0.05%", t)).toEqual([]);
    expect(poolQueryOf("orca-dex", null, t)).toEqual([]);
    expect(poolQueryOf("uniswap-v3", "0.05%", [WETH_BASE])).toEqual([]);
  });

  it("empate stable × volatile: fica o único cujo TVL bate com o da DefiLlama", () => {
    expect(pickByTvl(1_000_000, [{ addr: "a", tvl: 1_100_000 }, { addr: "b", tvl: 20_000 }])).toBe("a");
    // os dois batem, ou nenhum, ou sem TVL lido → sem botão
    expect(pickByTvl(1_000_000, [{ addr: "a", tvl: 900_000 }, { addr: "b", tvl: 1_200_000 }])).toBeNull();
    expect(pickByTvl(1_000_000, [{ addr: "a", tvl: 10 }, { addr: "b", tvl: 20 }])).toBeNull();
    expect(pickByTvl(1_000_000, [{ addr: "a", tvl: null }, { addr: "b", tvl: null }])).toBeNull();
  });

  it("o endereço achado vai na linha; sem ele, null", () => {
    const addr = "0xd0b53D9277642d899DF5C87A3966A349A798F224";
    const [com] = buildPairs([row({})], covered, caps, new Map([[UUID, addr]]));
    const [sem] = buildPairs([row({})], covered, caps);
    expect(com.pool).toBe(addr);
    expect(sem.pool).toBeNull();
  });
});

describe("filterPairs", () => {
  const base: PairDTO = {
    id: UUID,
    chainId: 8453,
    protocol: "uniswap-v3",
    symbol: "WETH-USDC",
    meta: null,
    tvlUsd: 1e6,
    apr: 10,
    aprBase: 10,
    aprReward: null,
    volume1d: 1e5,
    volume7d: null,
    mcapMin: 1e9,
    pool: null,
  };
  const pares: PairDTO[] = [
    base,
    { ...base, id: "2", symbol: "XYZ-WETH", apr: 80, mcapMin: 5e6, volume1d: null },
    { ...base, id: "3", symbol: "CBBTC-USDC", apr: null, chainId: 1 },
  ];
  const f = { q: "", chainId: null, protocol: null, minApr: 0, minVolume: 0, minMcap: 0, minTvl: 0, sort: "apr" as const };

  it("ordena pelo escolhido, com '—' no fim", () => {
    expect(filterPairs(pares, f).map((p) => p.id)).toEqual(["2", UUID, "3"]);
  });

  it("filtro de mínimo exclui quem não tem o número", () => {
    expect(filterPairs(pares, { ...f, minVolume: 1 }).map((p) => p.id)).toEqual([UUID, "3"]);
    expect(filterPairs(pares, { ...f, minMcap: 1e8 }).map((p) => p.id)).toEqual([UUID, "3"]);
  });

  it("busca por token: todos os termos, em qualquer lado do par", () => {
    expect(filterPairs(pares, { ...f, q: "weth" }).map((p) => p.id)).toEqual(["2", UUID]);
    expect(filterPairs(pares, { ...f, q: "usdc btc" }).map((p) => p.id)).toEqual(["3"]);
  });

  it("rede e corretora", () => {
    expect(filterPairs(pares, { ...f, chainId: 1 }).map((p) => p.id)).toEqual(["3"]);
    expect(filterPairs(pares, { ...f, protocol: "aerodrome" })).toEqual([]);
  });
});
