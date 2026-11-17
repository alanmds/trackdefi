/**
 * Ordem dos RPCs: pago (env) primeiro, público como reserva atrás dele.
 * Ver `rpcUrls` em core/chain.ts — a reserva segura a varredura quando a conta
 * grátis da Alchemy recusa por excesso de pedidos por segundo.
 */

import { afterEach, describe, expect, it } from "vitest";
import { parseAbi } from "viem";
import { createReader, primaryIsAlchemy, rpcUrls } from "../core/chain";
import { CHAINS } from "../core/chains";

const BASE = 8453;
const ENV = CHAINS[BASE].rpcEnv;
const original = process.env[ENV];

afterEach(() => {
  if (original === undefined) delete process.env[ENV];
  else process.env[ENV] = original;
});

describe("rpcUrls", () => {
  it("sem env, usa só os públicos", () => {
    delete process.env[ENV];
    expect(rpcUrls(BASE)).toEqual(CHAINS[BASE].defaultRpcs);
  });

  it("com env, o pago vem primeiro e os públicos ficam de reserva", () => {
    process.env[ENV] = " https://pago.example/v2/x , https://pago2.example ";
    expect(rpcUrls(BASE)).toEqual(["https://pago.example/v2/x", "https://pago2.example", ...CHAINS[BASE].defaultRpcs]);
  });

  it("não repete um público que também esteja na env", () => {
    const publico = CHAINS[BASE].defaultRpcs[0];
    process.env[ENV] = `https://pago.example,${publico}`;
    const urls = rpcUrls(BASE);
    expect(urls[0]).toBe("https://pago.example");
    expect(urls.filter((u) => u === publico)).toHaveLength(1);
  });

  it("env vazia conta como ausente", () => {
    process.env[ENV] = " , ";
    expect(rpcUrls(BASE)).toEqual(CHAINS[BASE].defaultRpcs);
  });
});

describe("primaryIsAlchemy", () => {
  it("só é verdadeiro quando o RPC preferido é da Alchemy", () => {
    delete process.env[ENV];
    expect(primaryIsAlchemy(BASE)).toBe(false);
    process.env[ENV] = "https://base-mainnet.g.alchemy.com/v2/x";
    expect(primaryIsAlchemy(BASE)).toBe(true);
    process.env[ENV] = "https://outro.example/rpc";
    expect(primaryIsAlchemy(BASE)).toBe(false);
  });
});

describe("multicall em lotes grandes (corta CU na Alchemy)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** quantos pedidos DIFERENTES (a retentativa repete o mesmo corpo) uma leitura de 300 chamadas dispara */
  async function distinctRequests(): Promise<number> {
    const bodies = new Set<string>();
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      // o `id` muda a cada tentativa; o conteúdo da chamada não
      const { id: _id, ...rest } = JSON.parse(String(init?.body));
      bodies.add(JSON.stringify(rest));
      return new Response("{}", { status: 500 });
    }) as typeof fetch;
    const reader = createReader(BASE);
    const contracts = Array.from({ length: 300 }, (_, i) => ({
      address: `0x${(i + 1).toString(16).padStart(40, "0")}` as `0x${string}`,
      abi: parseAbi(["function factory() view returns (address)"]),
      functionName: "factory" as const,
    }));
    await reader.multicall({ contracts, allowFailure: true }).catch(() => {});
    return bodies.size;
  }

  it("com Alchemy: um pedido só", async () => {
    process.env[ENV] = "https://base-mainnet.g.alchemy.com/v2/x";
    expect(await distinctRequests()).toBe(1);
  });

  it("sem Alchemy: continua em lotes pequenos (RPC público aguenta pouco)", async () => {
    delete process.env[ENV];
    expect(await distinctRequests()).toBeGreaterThan(1);
  });
});
