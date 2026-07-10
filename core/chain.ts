/**
 * Fábrica do cliente de leitura da Base (viem). Fonte única de RPC para a CLI
 * e para a API. RPC pago (Alchemy/QuickNode) entra por env sem tocar o código:
 * BASE_RPC_URLS="https://...,https://..." (a chave fica só no servidor).
 */

import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";
import type { ChainReader } from "./types";

const DEFAULT_RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.llamarpc.com",
];

export function baseRpcUrls(): string[] {
  const env = process.env.BASE_RPC_URLS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return env && env.length > 0 ? env : DEFAULT_RPCS;
}

export function createBaseReader(): ChainReader {
  const client = createPublicClient({
    chain: base,
    transport: fallback(baseRpcUrls().map((url) => http(url, { timeout: 30_000 }))),
  });
  return client as unknown as ChainReader;
}
