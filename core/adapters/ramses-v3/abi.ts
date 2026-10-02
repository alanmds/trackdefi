/**
 * ABIs mínimas da Ramses V3 que DIFEREM da Uniswap v3. Fonte:
 * github.com/RamsesExchange/ramses-v3-contracts, provadas no
 * `poc/probe-ramses.ts`.
 */

import { parseAbi } from "viem";

/** 10 campos: sem nonce/operator, e `tickSpacing` no lugar do fee. */
export const ramsesPositionsAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

/** o pool é identificado por tickSpacing (a fee é dinâmica) */
export const ramsesFactoryAbi = parseAbi(["function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address)"]);

/** `slot0()` com feeProtocol uint24 */
export const ramsesSlot0Abi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint24 feeProtocol, bool unlocked)",
]);

export const feeCollectorAbi = parseAbi(["function voter() view returns (address)"]);

export const ramsesVoterAbi = parseAbi(["function gaugeForPool(address pool) view returns (address)"]);

export const gaugeV3Abi = parseAbi([
  "function getRewardTokens() view returns (address[])",
  /** "base rate without boost" (interface); bateu sem boost no PoC */
  "function rewardRate(address token) view returns (uint256)",
  "function earned(address token, address nfpManagerAddress, uint256 tokenId) view returns (uint256)",
]);
