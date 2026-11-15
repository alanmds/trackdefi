/**
 * Prazo da medição de taxa ao vivo (15/11/2026).
 *
 * A carteira demo da home dava 504: a varredura terminava em 25 s, mas a
 * medição de taxa (janelas de feeGrowth, que leem o histórico do pool) levava
 * ~90 s com RPC lento, e a rota corta tudo aos 50 s. Agora a medição tem prazo
 * para TERMINAR; a rede que passa dele cai na estimativa do pool, com o aviso
 * `fees` — a resposta sai com as posições.
 *
 * Arquivo próprio porque troca o leitor de RPC por um que nunca responde
 * (`vi.mock` vale para o arquivo inteiro).
 */

import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";

vi.mock("../core/chain", async (importOriginal) => {
  const original = await importOriginal<typeof import("../core/chain")>();
  return {
    ...original,
    // RPC que nunca devolve o bloco atual: a medição de taxa fica pendurada
    createReader: () => ({ getBlockNumber: () => new Promise<bigint>(() => {}) }),
  };
});

import { getWalletPositions } from "../core/service";
import type { LpPosition, ProtocolAdapter } from "../core/types";
import type { PriceProvider } from "../core/prices/types";

const ADDR = "0x1111111111111111111111111111111111111111" as Address;
const semPreco: PriceProvider = { name: "teste", fetchUsdPrices: async () => new Map() };
const semApr = async () => null;

/** posição concentrada DENTRO da faixa num protocolo com layout conhecido: é medida */
function concentrada(): LpPosition {
  const t = (s: string, a: Address) => ({ address: a, symbol: s, decimals: 18 });
  return {
    protocol: "uniswap-v3",
    chainId: 8453,
    poolAddress: "0xd0b53D9277642d899DF5C87A3966A349A798F224",
    poolSymbol: "WETH/USDC",
    kind: "concentrated",
    positionId: "1",
    staked: false,
    managedByAlm: null,
    token0: t("WETH", "0x4200000000000000000000000000000000000006"),
    token1: t("USDC", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    amount0Raw: 10n ** 18n,
    amount1Raw: 10n ** 18n,
    rewards: [],
    range: {
      tickLower: -100,
      tickUpper: 100,
      tickCurrent: 0,
      inRange: true,
      priceLower: 0.99,
      priceUpper: 1.01,
      priceCurrent: 1,
    },
  };
}

const adapter: ProtocolAdapter = { protocol: "uniswap-v3", chainId: 8453, getPositions: async () => [concentrada()] };

describe("medição de taxa com prazo para terminar", () => {
  it("RPC que não responde não segura a resposta: posições saem, com aviso `fees`", async () => {
    const curto = { adaptersMs: 60, pricesMs: 200, extrasMs: 300, feesMs: 400 };
    const t = Date.now();
    const d = await getWalletPositions(ADDR, [adapter], semPreco, semApr, null, curto);
    expect(Date.now() - t).toBeLessThan(2_000); // antes: esperava para sempre
    expect(d.positions).toHaveLength(1);
    expect(d.notices).toContainEqual({ kind: "fees", positions: 1 });
  });
});
