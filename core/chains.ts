/**
 * Redes suportadas — fonte única de slug de preço (DefiLlama), explorer,
 * rótulo e RPCs. Adicionar rede = uma entrada aqui (Receita A do playbook).
 */

import { base, optimism } from "viem/chains";
import type { Chain } from "viem";

export interface ChainInfo {
  chain: Chain;
  label: string;
  /** slug da DefiLlama (coins.llama.fi) */
  priceSlug: string;
  explorerUrl: string;
  explorerLabel: string;
  /** env que injeta RPC(s) pagos, separados por vírgula */
  rpcEnv: string;
  defaultRpcs: string[];
}

export const CHAINS: Record<number, ChainInfo> = {
  8453: {
    chain: base,
    label: "Base",
    priceSlug: "base",
    explorerUrl: "https://basescan.org",
    explorerLabel: "BaseScan",
    rpcEnv: "BASE_RPC_URLS",
    defaultRpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://base.llamarpc.com"],
  },
  10: {
    chain: optimism,
    label: "Optimism",
    priceSlug: "optimism",
    explorerUrl: "https://optimistic.etherscan.io",
    explorerLabel: "OP Etherscan",
    rpcEnv: "OPTIMISM_RPC_URLS",
    defaultRpcs: [
      "https://mainnet.optimism.io",
      "https://optimism-rpc.publicnode.com",
      "https://optimism.llamarpc.com",
    ],
  },
};

export function chainInfo(chainId: number): ChainInfo {
  const info = CHAINS[chainId];
  if (!info) throw new Error(`rede não suportada: ${chainId}`);
  return info;
}
