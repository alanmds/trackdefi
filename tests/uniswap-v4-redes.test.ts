/**
 * Redes da Uniswap v4 (passo 8): a config tem de estar inteira e coerente.
 * Os endereços vêm da doc oficial e foram conferidos on-chain em
 * `poc/probe-v4-redes.ts`; aqui só se barra erro de digitação e rede sem
 * registro, não se prova endereço.
 */
import { describe, expect, it } from "vitest";
import { UNISWAP_V4_CHAINS } from "../core/adapters/uniswap-v4/config";
import { CHAINS } from "../core/chains";

describe("Uniswap v4 — config das redes", () => {
  it("toda rede tem chainId conhecido e endereços de 20 bytes", () => {
    for (const c of UNISWAP_V4_CHAINS) {
      expect(CHAINS[c.chainId], `rede ${c.chainId} fora de CHAINS`).toBeDefined();
      for (const a of [c.positionManager, c.stateView, c.poolManager]) expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it("não repete rede", () => {
    const ids = UNISWAP_V4_CHAINS.map((c) => c.chainId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("as redes sem varredura de histórico enumeram pelo índice", () => {
    // só a Robinhood aceita a chain inteira num getLogs; nas demais o RPC recusa
    for (const c of UNISWAP_V4_CHAINS.filter((x) => x.chainId !== 4663)) expect(c.enumeration).toBe("index");
  });

  it("PositionManager é único por rede (endereços não são mais iguais entre redes)", () => {
    const pms = UNISWAP_V4_CHAINS.map((c) => c.positionManager.toLowerCase());
    // Ink e Soneium compartilham o deploy por design; as demais são distintas
    expect(new Set(pms).size).toBeGreaterThanOrEqual(UNISWAP_V4_CHAINS.length - 1);
  });
});
