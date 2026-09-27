/**
 * Fábrica dos clientes de leitura (viem), um por rede. Fonte única de RPC
 * para a CLI e para a API. RPC pago entra por env sem tocar o código
 * (ex.: BASE_RPC_URLS / OPTIMISM_RPC_URLS = "https://...,https://...").
 * A chave fica só no servidor, nunca no navegador.
 */

import { createPublicClient, fallback, http } from "viem";
import { chainInfo } from "./chains";
import type { ChainReader } from "./types";

/**
 * RPCs da rede, em ordem de preferência: os da env (pagos) primeiro, e os
 * públicos DEPOIS, como reserva — nunca no lugar deles.
 *
 * A reserva existe desde 27/09/2026: a conta grátis da Alchemy limita pedidos
 * por segundo, e uma varredura grande estourou esse teto (e-mail "Your
 * requests are being rate limited"). O `http` do viem já tenta de novo no 429;
 * se ainda assim falhar, o `fallback` passa a leitura para o RPC público em vez
 * de perdê-la. Leitura de bloco passado (fee APR on-chain) pode falhar no
 * público — aí degrada para estimativa, como já acontecia.
 */
export function rpcUrls(chainId: number): string[] {
  const info = chainInfo(chainId);
  const env = (process.env[info.rpcEnv] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...env, ...info.defaultRpcs])];
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
