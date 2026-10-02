/**
 * ABIs mínimas da PancakeSwap v3 que DIFEREM da Uniswap v3 (o NFPM e a
 * factory são idênticos — ver `../uniswap-v3/abi.ts`).
 */

import { parseAbi } from "viem";

/** `slot0()` da Pancake: `feeProtocol` é uint32 (na Uniswap, uint8). */
export const pancakeSlot0Abi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)",
]);

export const masterChefV3Abi = parseAbi([
  "function userPositionInfos(uint256 tokenId) view returns (uint128 liquidity, uint128 boostLiquidity, int24 tickLower, int24 tickUpper, uint256 rewardGrowthInside, uint256 reward, address user, uint256 pid, uint256 boostMultiplier)",
  "function pendingCake(uint256 tokenId) view returns (uint256)",
  "function getLatestPeriodInfo(address v3Pool) view returns (uint256 cakePerSecond, uint256 endTime)",
]);

export const pancakePoolLmAbi = parseAbi(["function lmPool() view returns (address)"]);

/** LMPool: a liquidez em stake ATIVA no tick corrente (o `stakedLiquidity` da Slipstream) */
export const lmPoolAbi = parseAbi(["function lmLiquidity() view returns (uint128)"]);
