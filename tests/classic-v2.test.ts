/**
 * Pools clássicos (v2) — config por rede, registry e o adapter com leitor e
 * Token API falsos (sem internet). Endereços de factory: Uniswap =
 * developers.uniswap.org; Sushi e Pancake = repositório oficial sushi-labs/sushi
 * (src/evm/config/features), lidos em 27/10/2026 e conferidos on-chain no
 * `poc/probe-v2-classicos.ts`.
 *
 * Carteiras, tokens e números aqui são inventados — nada de posição real
 * (repo público).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { CLASSIC_V2_PROTOCOLS, UNISWAP_V2_CHAINS, factoriesOn } from "../core/adapters/classic-v2/config";
import { ClassicV2Adapter } from "../core/adapters/classic-v2/index";
import { buildAdapters } from "../core/adapters/registry";
import type { AdapterNotice, ChainReader } from "../core/types";

describe("clássicos v2 — config por rede", () => {
  it("Uniswap v2 em 7 redes, Sushi v2 em 5 e Pancake v2 em 3", () => {
    const n = (p: string) => CLASSIC_V2_PROTOCOLS.find((x) => x.protocol === p)!.chains.map((c) => c.chainId).sort((a, b) => a - b);
    expect(n("uniswap-v2")).toEqual([1, 10, 56, 130, 4663, 8453, 42161]);
    expect(n("sushiswap-v2")).toEqual([1, 10, 56, 8453, 42161]);
    expect(n("pancakeswap-v2")).toEqual([1, 56, 8453]);
  });

  it("endereços da doc: Uniswap v2 na Ethereum e na Unichain", () => {
    const f = (id: number) => UNISWAP_V2_CHAINS.find((c) => c.chainId === id)!.factory.toLowerCase();
    expect(f(1)).toBe("0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f");
    expect(f(130)).toBe("0x1f98400000000000000000000000000000000002");
  });

  it("nenhuma rede repete a mesma factory em dois protocolos (o LP seria atribuído duas vezes)", () => {
    for (const id of [1, 10, 56, 130, 4663, 8453, 42161]) {
      const fs = factoriesOn(id).map((a) => a.toLowerCase());
      expect(new Set(fs).size).toBe(fs.length);
    }
  });

  it("registry: um adapter por protocolo e rede", () => {
    const todos = buildAdapters();
    for (const { protocol, chains } of CLASSIC_V2_PROTOCOLS) {
      const doProto = todos.filter((a) => a.protocol === protocol).map((a) => a.chainId).sort((a, b) => a - b);
      expect(doProto).toEqual(chains.map((c) => c.chainId).sort((a, b) => a - b));
    }
  });
});

const FACTORY = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6" as Address;
const LP_OK = "0x00000000000000000000000000000000000000a1" as Address;
const LP_FALSO = "0x00000000000000000000000000000000000000a2" as Address;
const SPAM = "0x00000000000000000000000000000000000000a3" as Address;
const VAZIO = "0x00000000000000000000000000000000000000a4" as Address;
const T0 = "0x00000000000000000000000000000000000000b0" as Address;
const T1 = "0x00000000000000000000000000000000000000b1" as Address;
const OUTRO = "0x00000000000000000000000000000000000000c0" as Address;

type Call = { address: Address; functionName: string; args?: readonly unknown[] };

/** leitor falso: só o que o adapter consulta */
function fakeReader(): ChainReader {
  const answer = (c: Call): { status: "success"; result: unknown } | { status: "failure"; error: Error } => {
    const ok = (result: unknown) => ({ status: "success" as const, result });
    const fail = { status: "failure" as const, error: new Error("revert") };
    const a = c.address.toLowerCase();
    switch (c.functionName) {
      case "factory":
        return a === LP_OK.toLowerCase() || a === LP_FALSO.toLowerCase() ? ok(FACTORY) : fail;
      case "token0":
        return ok(T0);
      case "token1":
        return ok(T1);
      case "totalSupply":
        return ok(1_000_000n);
      case "getReserves":
        return ok([2_000_000_000n, 5n * 10n ** 18n, 0] as const);
      case "getPair":
        // a factory só reconhece o LP verdadeiro; o falso aponta para outro endereço
        return ok(a === FACTORY.toLowerCase() && c.args ? LP_OK : OUTRO);
      case "symbol":
        return ok(a === T0.toLowerCase() ? "USDC" : "WETH");
      case "decimals":
        return ok(a === T0.toLowerCase() ? 6 : 18);
      default:
        return fail;
    }
  };
  return {
    readContract: async () => {
      throw new Error("não usado");
    },
    multicall: async ({ contracts }: { contracts: readonly Call[] }) => contracts.map(answer),
  } as unknown as ChainReader;
}

function mockTokenApi(pages: Array<Array<{ contractAddress: string; tokenBalance: string }>>, truncated = false) {
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const page = pages[Math.min(i, pages.length - 1)];
      const last = i >= pages.length - 1 && !truncated;
      i++;
      return new Response(JSON.stringify({ result: { tokenBalances: page, ...(last ? {} : { pageKey: "k" }) } }), { status: 200 });
    }),
  );
}

describe("clássicos v2 — adapter", () => {
  const OLD = process.env.BASE_RPC_URLS;
  beforeEach(() => {
    process.env.BASE_RPC_URLS = "https://base-mainnet.g.alchemy.com/v2/chave-de-teste";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (OLD === undefined) delete process.env.BASE_RPC_URLS;
    else process.env.BASE_RPC_URLS = OLD;
  });

  const make = (warns: Array<[string, AdapterNotice | null | undefined]> = [], reportsCap = false) =>
    new ClassicV2Adapter(fakeReader(), {
      config: { chainId: 8453, factory: FACTORY },
      protocol: "uniswap-v2",
      reportsCap,
      onWarn: (msg, notice) => warns.push([msg, notice]),
    });

  it("mede o LP verdadeiro por saldo ÷ totalSupply × reservas", async () => {
    mockTokenApi([
      [
        { contractAddress: LP_OK, tokenBalance: "0x" + (100_000n).toString(16) }, // 10% do supply
        { contractAddress: VAZIO, tokenBalance: "0x0000" },
      ],
    ]);
    const [p, ...resto] = await make().getPositions("0x00000000000000000000000000000000000000d1");
    expect(resto).toEqual([]);
    expect(p.protocol).toBe("uniswap-v2");
    expect(p.kind).toBe("v2-volatile");
    expect(p.poolAddress).toBe(LP_OK);
    expect(p.poolSymbol).toBe("USDC/WETH");
    expect(p.amount0Raw).toBe(200_000_000n); // 10% de 2.000 USDC
    expect(p.amount1Raw).toBe(5n * 10n ** 17n); // 10% de 5 WETH
    expect(p.range).toBeNull();
    expect(p.rewards).toEqual([]);
    expect(p.positionId).toBeNull();
  });

  it("rejeita contrato que copia o factory() mas não está na lista de pares da factory", async () => {
    mockTokenApi([[{ contractAddress: LP_FALSO, tokenBalance: "0x1000" }, { contractAddress: SPAM, tokenBalance: "0x10" }]]);
    expect(await make().getPositions("0x00000000000000000000000000000000000000d2")).toEqual([]);
  });

  it("sem Alchemy na rede: devolve vazio e só registra em log interno", async () => {
    delete process.env.BASE_RPC_URLS;
    const warns: Array<[string, AdapterNotice | null | undefined]> = [];
    expect(await make(warns).getPositions("0x00000000000000000000000000000000000000d3")).toEqual([]);
    expect(warns).toHaveLength(1);
    expect(warns[0][1]).toBeNull();
  });

  it("carteira com tokens demais: só quem tem reportsCap avisa, com o total verificado", async () => {
    mockTokenApi([[{ contractAddress: OUTRO, tokenBalance: "0x5" }]], true);
    const warns: Array<[string, AdapterNotice | null | undefined]> = [];
    await make(warns, true).getPositions("0x00000000000000000000000000000000000000d4");
    const aviso = warns.find(([, n]) => n && n.kind === "tokensCapped");
    expect(aviso?.[1]).toEqual({ kind: "tokensCapped", checked: 20 });

    const calados: Array<[string, AdapterNotice | null | undefined]> = [];
    await make(calados, false).getPositions("0x00000000000000000000000000000000000000d4");
    expect(calados.filter(([, n]) => n?.kind === "tokensCapped")).toEqual([]);
  });

  it("uma única ida à Token API por rede e carteira, mesmo com vários protocolos", async () => {
    mockTokenApi([[{ contractAddress: LP_OK, tokenBalance: "0x100" }]]);
    const conta = "0x00000000000000000000000000000000000000d5";
    await Promise.all([make().getPositions(conta), make().getPositions(conta)]);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});
