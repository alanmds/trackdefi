/**
 * Fábrica dos clientes de leitura (viem), um por rede. Fonte única de RPC
 * para a CLI e para a API. RPC pago entra por env sem tocar o código
 * (ex.: BASE_RPC_URLS / OPTIMISM_RPC_URLS = "https://...,https://...").
 * A chave fica só no servidor, nunca no navegador.
 */

import { createPublicClient, fallback, http } from "viem";
import { chainInfo } from "./chains";
import type { ChainReader } from "./types";

export function rpcUrls(chainId: number): string[] {
  const info = chainInfo(chainId);
  const env = process.env[info.rpcEnv]
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return env && env.length > 0 ? env : info.defaultRpcs;
}

export function createReader(chainId: number): ChainReader {
  const client = createPublicClient({
    chain: chainInfo(chainId).chain,
    transport: fallback(rpcUrls(chainId).map((url) => http(url, { timeout: 30_000 }))),
  });
  return client as unknown as ChainReader;
}

/** compatibilidade com scripts existentes */
export function createBaseReader(): ChainReader {
  return createReader(8453);
}
