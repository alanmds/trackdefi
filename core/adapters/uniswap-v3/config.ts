/**
 * Uniswap V3 por rede. Endereços CONFIRMADOS na documentação oficial
 * (developers.uniswap.org → contracts/v3/reference/deployments):
 * Base em 11/07/2026; Ethereum, Arbitrum e Optimism em 13/07/2026.
 * A própria doc avisa: NÃO assumir endereços iguais entre redes — Base
 * de fato difere; ETH/ARB/OP usam os canônicos.
 */

import type { Address } from "viem";

export interface UniV3ChainConfig {
  chainId: number;
  factory: Address;
  nfpm: Address;
}

const CANONICAL_FACTORY: Address = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const CANONICAL_NFPM: Address = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

export const UNISWAP_V3_BASE: UniV3ChainConfig = {
  chainId: 8453,
  factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
  nfpm: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
};

export const UNISWAP_V3_ETHEREUM: UniV3ChainConfig = {
  chainId: 1,
  factory: CANONICAL_FACTORY,
  nfpm: CANONICAL_NFPM,
};

export const UNISWAP_V3_ARBITRUM: UniV3ChainConfig = {
  chainId: 42161,
  factory: CANONICAL_FACTORY,
  nfpm: CANONICAL_NFPM,
};

export const UNISWAP_V3_OPTIMISM: UniV3ChainConfig = {
  chainId: 10,
  factory: CANONICAL_FACTORY,
  nfpm: CANONICAL_NFPM,
};

/**
 * Robinhood Chain (Arbitrum Orbit L2, chainId 4663) — endereços CONFIRMADOS
 * na doc oficial em 27/07/2026 (developers.uniswap.org → v3 → Robinhood Chain
 * Deployments) e conferidos on-chain no `poc/probe-robinhood.ts`
 * (`NFPM.factory()` bate com a factory abaixo). NÃO usa os canônicos.
 */
export const UNISWAP_V3_ROBINHOOD: UniV3ChainConfig = {
  chainId: 4663,
  factory: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
  nfpm: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
};

/**
 * Unichain (130) e BNB Chain (56) — endereços CONFIRMADOS na doc oficial em
 * 04/10/2026 (developers.uniswap.org → v3 → deployments) e conferidos on-chain
 * no `poc/probe-uniswap-v3-unichain-bnb.ts` (`NFPM.factory()` bate). Nenhuma
 * das duas usa os canônicos.
 */
export const UNISWAP_V3_UNICHAIN: UniV3ChainConfig = {
  chainId: 130,
  factory: "0x1f98400000000000000000000000000000000003",
  nfpm: "0x943e6e07a7e8e791dafc44083e54041d743c46e9",
};

export const UNISWAP_V3_BSC: UniV3ChainConfig = {
  chainId: 56,
  factory: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
  nfpm: "0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613",
};

/** todas as redes Uniswap ativas (ordem = ordem no registry) */
export const UNISWAP_V3_CHAINS: UniV3ChainConfig[] = [
  UNISWAP_V3_BASE,
  UNISWAP_V3_ETHEREUM,
  UNISWAP_V3_ARBITRUM,
  UNISWAP_V3_OPTIMISM,
  UNISWAP_V3_ROBINHOOD,
  UNISWAP_V3_UNICHAIN,
  UNISWAP_V3_BSC,
];

// compatibilidade com código/testes existentes (Base)
export const UNI_FACTORY = UNISWAP_V3_BASE.factory;
export const UNI_NFPM = UNISWAP_V3_BASE.nfpm;

/** teto de NFTs enumerados por carteira (robôs têm milhares; avisa se cortar) */
export const MAX_NFTS = 1000;
