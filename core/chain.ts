/**
 * Fábrica dos clientes de leitura (viem), um por rede. Fonte única de RPC
 * para a CLI e para a API. RPC pago entra por env sem tocar o código
 * (ex.: BASE_RPC_URLS / OPTIMISM_RPC_URLS = "https://...,https://...").
 * A chave fica só no servidor, nunca no navegador.
 */

import { createPublicClient } from "viem";
import { chainInfo, evmChain } from "./chains";
import { planRpcs, poolTransport } from "./rpc-pool";
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
  return [...new Set([...envRpcs(chainId), ...chainInfo(chainId).defaultRpcs])];
}

/** só as URLs dedicadas da env da rede (as que o dono configurou no painel) */
export function envRpcs(chainId: number): string[] {
  return (process.env[chainInfo(chainId).rpcEnv] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** há ao menos um RPC dedicado (pago ou plano grátis com chave) configurado na rede? */
export function hasDedicatedRpc(chainId: number): boolean {
  return envRpcs(chainId).length > 0;
}

/**
 * true quando o RPC PREFERIDO da rede é da Alchemy (env paga). Quem cobra por
 * pedido (CU) e não por tamanho do pedido usa isto para trocar muitos pedidos
 * pequenos por poucos grandes — coisa que RPC público não aguenta.
 */
/** tamanho máximo (bytes de calldata) de um pedido de multicall na Alchemy */
const MULTICALL_BATCH_BYTES = 65_536;

export function primaryIsAlchemy(chainId: number): boolean {
  return /\.alchemy\.com\//.test(rpcUrls(chainId)[0] ?? "");
}

export function createReader(chainId: number): ChainReader {
  // a Solana não passa por aqui: tem cliente próprio em core/solana.ts
  const chain = evmChain(chainId);
  const client = createPublicClient({
    chain,
    // os provedores DIVIDEM a carga e quem cai esfria (core/rpc-pool.ts). Só com RPC público,
    // a ordem da lista manda e o host que falha sai da fila por um tempo — antes ele segurava
    // a varredura inteira até o timeout de 30 s (Lisk, 17/11/2026)
    transport: poolTransport(chain, planRpcs(envRpcs(chainId), chainInfo(chainId).defaultRpcs)),
  });
  if (hasDedicatedRpc(chainId)) {
    /* O `multicall` do viem parte a lista em pedidos de ~1 KB de calldata (≈6 chamadas cada) se
       ninguém disser o contrário, e a Alchemy cobra 26 CU POR PEDIDO. Com pedidos de até 64 KB
       a mesma leitura vira 1 pedido só. Quem já pedia um lote maior (16 KB) também sobe. */
    const multicall = client.multicall.bind(client) as (a: { batchSize?: number }) => unknown;
    (client as unknown as { multicall: typeof multicall }).multicall = (args) =>
      multicall({ ...args, batchSize: Math.max(args.batchSize ?? 0, MULTICALL_BATCH_BYTES) });
  }
  return client as unknown as ChainReader;
}

/** compatibilidade com scripts existentes */
export function createBaseReader(): ChainReader {
  return createReader(8453);
}
