/**
 * Agregação multi-protocolo do serviço: falha de UM protocolo vira warning e
 * resposta parcial; só falha tudo se TODOS falharem.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { getWalletPositions } from "../core/service";
import type { LpPosition, ProtocolAdapter } from "../core/types";

const ADDR = "0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC" as Address;

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
    const dto = await getWalletPositions(ADDR, [okAdapter("aerodrome"), okAdapter("uniswap-v3")]);
    expect(dto.totalPositions).toBe(2);
    expect(dto.protocols).toEqual(["aerodrome", "uniswap-v3"]);
    expect(dto.chains).toEqual(["base"]); // adapters fake são todos chainId 8453
    expect(new Set(dto.positions.map((p) => p.protocol))).toEqual(new Set(["aerodrome", "uniswap-v3"]));
  });

  it("um protocolo caído → resposta parcial + warning (não derruba tudo)", async () => {
    const dto = await getWalletPositions(ADDR, [okAdapter("aerodrome"), brokenAdapter("uniswap-v3")]);
    expect(dto.totalPositions).toBe(1);
    expect(dto.positions[0].protocol).toBe("aerodrome");
    expect(dto.warnings.some((w) => w.includes("uniswap-v3") && w.includes("RPC morreu"))).toBe(true);
  });

  it("todos os protocolos caídos → erro (vira 502 na API)", async () => {
    await expect(
      getWalletPositions(ADDR, [brokenAdapter("aerodrome"), brokenAdapter("uniswap-v3")]),
    ).rejects.toThrow(/todos os protocolos/);
  });
});
