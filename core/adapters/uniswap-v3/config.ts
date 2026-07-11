/**
 * Uniswap V3 na Base (chainId 8453).
 * Endereços CONFIRMADOS em 11/07/2026 na documentação oficial
 * (developers.uniswap.org → contracts/v3/reference/deployments/base).
 */

import type { Address } from "viem";

export const UNI_FACTORY: Address = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
export const UNI_NFPM: Address = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";

/** teto de NFTs enumerados por carteira (robôs têm milhares; avisa se cortar) */
export const MAX_NFTS = 1000;
