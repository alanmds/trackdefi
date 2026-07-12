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

/** todas as redes Uniswap ativas (ordem = ordem no registry) */
export const UNISWAP_V3_CHAINS: UniV3ChainConfig[] = [
  UNISWAP_V3_BASE,
  UNISWAP_V3_ETHEREUM,
  UNISWAP_V3_ARBITRUM,
  UNISWAP_V3_OPTIMISM,
];

// compatibilidade com código/testes existentes (Base)
export const UNI_FACTORY = UNISWAP_V3_BASE.factory;
export const UNI_NFPM = UNISWAP_V3_BASE.nfpm;

/** teto de NFTs enumerados por carteira (robôs têm milhares; avisa se cortar) */
export const MAX_NFTS = 1000;
