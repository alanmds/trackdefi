/**
 * Redes suportadas — fonte única de slug de preço (DefiLlama), explorer,
 * rótulo e RPCs. Adicionar rede = uma entrada aqui (Receita A do playbook).
 */

import { arbitrum, base, mainnet, optimism, robinhood } from "viem/chains";
import type { Chain } from "viem";

export interface ChainInfo {
  chain: Chain;
  label: string;
  /** slug da DefiLlama (coins.llama.fi) */
  priceSlug: string;
  /**
   * nome da rede no dataset yields.llama.fi — NÃO é igual ao label
   * (ex.: Optimism = "OP Mainnet" lá). Conferir no dataset ao adicionar rede.
   */
  yieldsLabel: string;
  explorerUrl: string;
  explorerLabel: string;
  /**
   * segundos por bloco — converte janela de TEMPO em janela de BLOCOS para o
   * fee APR on-chain (`core/yields/onchain.ts`). Valor nominal da rede; varia
   * um pouco na prática, e o cálculo tolera (a janela é longa).
   */
  secPerBlock: number;
  /** env que injeta RPC(s) pagos, separados por vírgula */
  rpcEnv: string;
  defaultRpcs: string[];
}

export const CHAINS: Record<number, ChainInfo> = {
  8453: {
    chain: base,
    label: "Base",
    priceSlug: "base",
    yieldsLabel: "Base",
    explorerUrl: "https://basescan.org",
    explorerLabel: "BaseScan",
    secPerBlock: 2,
    rpcEnv: "BASE_RPC_URLS",
    defaultRpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://base.llamarpc.com"],
  },
  10: {
    chain: optimism,
    label: "Optimism",
    priceSlug: "optimism",
    yieldsLabel: "OP Mainnet",
    explorerUrl: "https://optimistic.etherscan.io",
    explorerLabel: "OP Etherscan",
    secPerBlock: 2,
    rpcEnv: "OPTIMISM_RPC_URLS",
    defaultRpcs: [
      "https://mainnet.optimism.io",
      "https://optimism-rpc.publicnode.com",
      "https://optimism.llamarpc.com",
    ],
  },
  1: {
    chain: mainnet,
    label: "Ethereum",
    priceSlug: "ethereum",
    yieldsLabel: "Ethereum",
    explorerUrl: "https://etherscan.io",
    explorerLabel: "Etherscan",
    secPerBlock: 12,
    rpcEnv: "ETHEREUM_RPC_URLS",
    defaultRpcs: [
      "https://ethereum-rpc.publicnode.com",
      "https://eth.llamarpc.com",
      "https://cloudflare-eth.com",
    ],
  },
  4663: {
    chain: robinhood,
    label: "Robinhood",
    priceSlug: "robinhood",
    // conferido no dataset yields.llama.fi em 27/07/2026
    yieldsLabel: "Robinhood Chain",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    explorerLabel: "Blockscout",
    secPerBlock: 0.1,
    rpcEnv: "ROBINHOOD_RPC_URLS",
    /* publicnode primeiro: é o provedor já usado nas outras redes e o único
       confirmado alcançável no PoC de 27/07. O RPC oficial da Robinhood entra
       como terceiro — ele é rate-limited e não resolve em alguns ambientes. */
    defaultRpcs: [
      "https://robinhood-rpc.publicnode.com",
      "https://robinhood.drpc.org",
      "https://rpc.mainnet.chain.robinhood.com",
    ],
  },
  42161: {
    chain: arbitrum,
    label: "Arbitrum",
    priceSlug: "arbitrum",
    yieldsLabel: "Arbitrum",
    explorerUrl: "https://arbiscan.io",
    explorerLabel: "Arbiscan",
    secPerBlock: 0.25,
    rpcEnv: "ARBITRUM_RPC_URLS",
    defaultRpcs: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum-one-rpc.publicnode.com",
      "https://arbitrum.llamarpc.com",
    ],
  },
};

export function chainInfo(chainId: number): ChainInfo {
  const info = CHAINS[chainId];
  if (!info) throw new Error(`rede não suportada: ${chainId}`);
  return info;
}
