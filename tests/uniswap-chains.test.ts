/**
 * Receita B multi-rede: o adapter Uniswap parametrizado por UniV3ChainConfig.
 * A coerência on-chain (NFPM.factory() == factory) é validada ao vivo pelo
 * poc/probe-uniswap-chains.ts; aqui ficam as garantias estruturais.
 */

import { describe, expect, it } from "vitest";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import {
  UNISWAP_V3_ARBITRUM,
  UNISWAP_V3_BASE,
  UNISWAP_V3_CHAINS,
  UNISWAP_V3_ETHEREUM,
} from "../core/adapters/uniswap-v3/config";
import { CHAINS } from "../core/chains";
import type { ChainReader } from "../core/types";

const deadReader: ChainReader = {
  readContract: async () => {
    throw new Error("não usado");
  },
  multicall: async () => [],
};

describe("UniV3ChainConfig (Receita B multi-rede)", () => {
  it("config default = Base; configs trocam a rede sem tocar na lógica", () => {
    expect(new UniswapV3Adapter(deadReader).chainId).toBe(8453);
    expect(new UniswapV3Adapter(deadReader, { config: UNISWAP_V3_ETHEREUM }).chainId).toBe(1);
    expect(new UniswapV3Adapter(deadReader, { config: UNISWAP_V3_ARBITRUM }).chainId).toBe(42161);
  });

  it("todas as redes Uniswap têm ChainInfo (slug de preço, explorer, RPCs)", () => {
    for (const c of UNISWAP_V3_CHAINS) {
      expect(CHAINS[c.chainId], `chainId ${c.chainId} sem ChainInfo`).toBeDefined();
      expect(CHAINS[c.chainId].defaultRpcs.length).toBeGreaterThan(0);
    }
  });

  it("chainIds únicos e Base com endereços próprios (diferente das canônicas)", () => {
    const ids = UNISWAP_V3_CHAINS.map((c) => c.chainId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(UNISWAP_V3_BASE.factory).not.toBe(UNISWAP_V3_ETHEREUM.factory);
    expect(UNISWAP_V3_ETHEREUM.factory).toBe(UNISWAP_V3_ARBITRUM.factory); // canônicas
  });
});
