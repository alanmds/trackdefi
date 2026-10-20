/**
 * Faixa de logos da home (15/10/2026): toda rede de NETWORKS e toda família
 * de protocolo precisam de um arquivo em public/logos/ — rede nova sem logo
 * quebraria a imagem da home calada. Os logos são os ícones públicos da
 * DefiLlama reduzidos a 64x64 (fonte: icons.llamao.fi).
 */

import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { logoSlug, NETWORKS, PROTOCOL_FAMILIES, protocolsOn } from "../app/site";

describe("logos da home", () => {
  it.each(NETWORKS.map((n) => n.label))("rede %s tem logo", (label) => {
    expect(existsSync(`public/logos/networks/${logoSlug(label)}.webp`)).toBe(true);
  });

  it.each([...PROTOCOL_FAMILIES])("família %s tem logo", (family) => {
    expect(existsSync(`public/logos/protocols/${logoSlug(family)}.webp`)).toBe(true);
  });

  it("toda rede tem ao menos uma corretora no cartão", () => {
    for (const n of NETWORKS) expect(protocolsOn(n.name).length, n.name).toBeGreaterThan(0);
  });

  it("um logo por família, com as versões juntas no nome", () => {
    expect(protocolsOn("BNB Chain")).toEqual([
      { family: "Uniswap", name: "Uniswap v3 & v4" },
      { family: "PancakeSwap", name: "PancakeSwap v3" },
      { family: "SushiSwap", name: "SushiSwap v3" },
    ]);
    expect(protocolsOn("Solana")).toEqual([{ family: "Orca", name: "Orca" }]);
  });

  it("slug do arquivo: minúsculas e hífen", () => {
    expect(logoSlug("Metal L2")).toBe("metal-l2");
    expect(logoSlug("BNB Chain")).toBe("bnb-chain");
  });
});
