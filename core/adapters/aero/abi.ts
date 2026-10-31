/**
 * ABIs mínimas da Aero (Slipstream v2). Provadas em `poc/probe-aero.ts`.
 * O `positions()` do NFPM tem o mesmo layout da Uniswap (12 campos), mas com
 * `tickSpacing` int24 no lugar do `fee`; o `slot0()` não tem `feeProtocol`.
 */

import { parseAbi } from "viem";

export const aeroPositionsAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

export const aeroSlot0Abi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
]);

export const aeroFactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address)",
  "function allPoolsLength() view returns (uint256)",
  "function allPools(uint256 index) view returns (address)",
]);

export const aeroPoolAbi = parseAbi([
  "function gauge() view returns (address)",
  "function stakedLiquidity() view returns (uint128)",
]);

export const aeroGaugeAbi = parseAbi([
  "function stakedValues(address account) view returns (uint256[])",
  "function earned(address account, uint256[] tokenIds) view returns (uint256)",
]);
