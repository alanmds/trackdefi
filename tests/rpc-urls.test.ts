/**
 * Ordem dos RPCs: pago (env) primeiro, público como reserva atrás dele.
 * Ver `rpcUrls` em core/chain.ts — a reserva segura a varredura quando a conta
 * grátis da Alchemy recusa por excesso de pedidos por segundo.
 */

import { afterEach, describe, expect, it } from "vitest";
import { rpcUrls } from "../core/chain";
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
