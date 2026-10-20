/**
 * SushiSwap v3 nas CINCO redes — o teste que impede trocar o endereço de uma
 * rede pelo de outra.
 *
 * Por que existe: na Sushi, o NFPM da Optimism tem o MESMO endereço da factory
 * da Arbitrum (coincidência de nonce do deployer). Um erro de cópia entre
 * configurações vizinhas não daria erro em runtime — só mostraria zero
 * posições. Os endereços aqui são os do repositório oficial
 * (github.com/sushi-labs/sushi → src/evm/config/features/sushiswap-v3.ts),
 * lidos em 20/10/2026 e conferidos on-chain no `poc/probe-sushiswap-v3.ts`.
 *
 * Números de APR inventados — nada de posição real (repo público).
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  SUSHISWAP_V3_ARBITRUM,
  SUSHISWAP_V3_BASE,
  SUSHISWAP_V3_BSC,
  SUSHISWAP_V3_CHAINS,
  SUSHISWAP_V3_ETHEREUM,
  SUSHISWAP_V3_OPTIMISM,
} from "../core/adapters/sushiswap-v3/config";
import { buildAdapters } from "../core/adapters/registry";
import { YieldsIndex, type LlamaRow } from "../core/yields/defillama";

const DOC = [
  { cfg: SUSHISWAP_V3_ETHEREUM, chainId: 1, factory: "0xbaceb8ec6b9355dfc0269c18bac9d6e2bdc29c4f", nfpm: "0x2214a42d8e2a1d20635c2cb0664422c528b6a432" },
  { cfg: SUSHISWAP_V3_OPTIMISM, chainId: 10, factory: "0x9c6522117e2ed1fe5bdb72bb0ed5e3f2bde7dbe0", nfpm: "0x1af415a1eba07a4986a52b6f2e7de7003d82231e" },
  { cfg: SUSHISWAP_V3_BSC, chainId: 56, factory: "0x126555dd55a39328f69400d6ae4f782bd4c34abb", nfpm: "0xf70c086618dcf2b1a461311275e00d6b722ef914" },
  { cfg: SUSHISWAP_V3_BASE, chainId: 8453, factory: "0xc35dadb65012ec5796536bd9864ed8773abc74c4", nfpm: "0x80c7dd17b01855a6d2347444a0fcc36136a314de" },
  { cfg: SUSHISWAP_V3_ARBITRUM, chainId: 42161, factory: "0x1af415a1eba07a4986a52b6f2e7de7003d82231e", nfpm: "0xf0cbce1942a68beb3d1b73f0dd86c8dcc363ef49" },
];

describe("SushiSwap v3 — config por rede", () => {
  it.each(DOC.map((d) => [d.chainId, d] as const))("rede %i: factory e NFPM do repositório oficial", (_, d) => {
    expect(d.cfg.chainId).toBe(d.chainId);
    expect(d.cfg.factory.toLowerCase()).toBe(d.factory);
    expect(d.cfg.nfpm.toLowerCase()).toBe(d.nfpm);
  });

  it("cinco redes, nenhuma repetida", () => {
    expect(SUSHISWAP_V3_CHAINS.map((c) => c.chainId).sort((a, b) => a - b)).toEqual([1, 10, 56, 8453, 42161]);
  });

  it("nenhum endereço usa os canônicos da Uniswap v3", () => {
    const uni = ["0x1f98431c8ad98523631ae4a59f267346ea31f984", "0xc36442b4a4522e871399cd717abdd847ab11fe88"];
    for (const c of SUSHISWAP_V3_CHAINS) {
      expect(uni).not.toContain(c.factory.toLowerCase());
      expect(uni).not.toContain(c.nfpm.toLowerCase());
    }
  });
});

describe("SushiSwap v3 — registry", () => {
  it("um adapter por rede, com o id de protocolo próprio", () => {
    const sushi = buildAdapters().filter((a) => a.protocol === "sushiswap-v3");
    expect(sushi.map((a) => a.chainId).sort((a, b) => a - b)).toEqual([1, 10, 56, 8453, 42161]);
  });
});

describe("SushiSwap v3 — APR do pool de reserva (DefiLlama)", () => {
  const A = "0x00000000000000000000000000000000000000a1" as Address;
  const B = "0x00000000000000000000000000000000000000b1" as Address;
  const row = (project: string, poolMeta: string, apy: number, tvlUsd: number): LlamaRow => ({
    chain: "Ethereum",
    project,
    tvlUsd,
    apy,
    apyBase: apy,
    apyReward: null,
    apyMean30d: null,
    poolMeta,
    underlyingTokens: [A, B],
  });
  const index = new YieldsIndex([
    row("sushiswap-v3", "0.3%", 12, 1_000_000),
    row("sushiswap-v3", "0.05%", 30, 2_000_000),
    // mesmo par na Uniswap: não pode vazar para a Sushi
    row("uniswap-v3", "0.3%", 99, 50_000_000),
  ]);
  const q = (poolSymbol: string, protocol = "sushiswap-v3") => ({
    chainId: 1,
    protocol,
    kind: "concentrated" as const,
    poolSymbol,
    token0: A,
    token1: B,
  });

  it("casa pelo fee tier, como a Uniswap", () => {
    expect(index.match(q("XXX/YYY 0.3%"))?.current).toBe(12);
    expect(index.match(q("XXX/YYY 0.05%"))?.current).toBe(30);
  });

  it("não pega a linha da Uniswap do mesmo par", () => {
    expect(index.match(q("XXX/YYY 0.3%", "uniswap-v3"))?.current).toBe(99);
    expect(index.match(q("XXX/YYY 1%"))).toBeNull();
  });
});
