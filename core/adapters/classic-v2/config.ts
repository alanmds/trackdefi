/**
 * Pools clássicos (v2: Uniswap v2 e forks com o mesmo `Pair`) por rede.
 *
 * Endereços das factories:
 *  - Uniswap v2: developers.uniswap.org → v2 → deployments (lido em 27/10/2026);
 *  - SushiSwap v2 e PancakeSwap v2: repositório OFICIAL da Sushi,
 *    github.com/sushi-labs/sushi → src/evm/config/features/{sushiswap-v2,
 *    pancakeswap-v2}.ts (lido em 27/10/2026), o mesmo de onde saem as tabelas
 *    da doc deles.
 * Todos conferidos on-chain no `poc/probe-v2-classicos.ts`: a factory responde
 * e o `factory()` de um par dela volta a apontar para ela. Nenhuma rede usa o
 * mesmo endereço em todos os protocolos — não assumir igualdade entre redes.
 *
 * Fora desta lista por ora: QuickSwap v2 (Polygon, rede ainda não ligada),
 * Camelot v2 (Arbitrum — o Pair dele devolve `getReserves` com campos extras,
 * pede PoC próprio), SushiSwap v2 e PancakeSwap v2 na Robinhood/Arbitrum
 * (existem, mas nenhum concorrente os cobre).
 */

import type { Address } from "viem";

export interface ClassicV2ChainConfig {
  chainId: number;
  factory: Address;
}

export const UNISWAP_V2_CHAINS: ClassicV2ChainConfig[] = [
  { chainId: 1, factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" },
  { chainId: 8453, factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6" },
  { chainId: 42161, factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9" },
  { chainId: 10, factory: "0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf" },
  { chainId: 4663, factory: "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f" },
  { chainId: 130, factory: "0x1f98400000000000000000000000000000000002" },
  { chainId: 56, factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6" },
];

export const SUSHISWAP_V2_CHAINS: ClassicV2ChainConfig[] = [
  { chainId: 1, factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac" },
  { chainId: 8453, factory: "0x71524B4f93c58fcbF659783284E38825f0622859" },
  { chainId: 42161, factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4" },
  { chainId: 10, factory: "0xFbc12984689e5f15626Bad03Ad60160Fe98B303C" },
  { chainId: 56, factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4" },
];

export const PANCAKESWAP_V2_CHAINS: ClassicV2ChainConfig[] = [
  { chainId: 56, factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" },
  { chainId: 1, factory: "0x1097053Fd2ea711dad45caCcc45EfF7548fCB362" },
  { chainId: 8453, factory: "0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E" },
];

/** protocolo → redes (ordem = ordem no registry) */
export const CLASSIC_V2_PROTOCOLS: Array<{ protocol: string; chains: ClassicV2ChainConfig[] }> = [
  { protocol: "uniswap-v2", chains: UNISWAP_V2_CHAINS },
  { protocol: "sushiswap-v2", chains: SUSHISWAP_V2_CHAINS },
  { protocol: "pancakeswap-v2", chains: PANCAKESWAP_V2_CHAINS },
];

/** todas as factories conhecidas de uma rede — a varredura reconhece o LP por elas */
export function factoriesOn(chainId: number): Address[] {
  return CLASSIC_V2_PROTOCOLS.flatMap((p) => p.chains.filter((c) => c.chainId === chainId).map((c) => c.factory));
}

/**
 * Páginas da Token API (100 tokens cada) lidas por carteira e por rede. A
 * carteira de gente comum cabe em 1–3 páginas; carteira-robô de airdrop tem
 * milhares (PoC de 27/10/2026: 3.000 tokens em 30 páginas, 7–8 s, e o LP nem
 * sempre estava entre eles). Passou do teto, o site avisa em vez de calar.
 */
export const MAX_TOKEN_PAGES = 20;

/** teto de pares lidos por protocolo e rede (cada um custa várias leituras) */
export const MAX_PAIRS = 300;
