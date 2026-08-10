/**
 * ABIs e desempacotamento do Uniswap V4.
 *
 * O que muda em relação ao v3, e por que este arquivo existe:
 * - **o pool não é um contrato.** Todos vivem dentro do singleton
 *   `PoolManager`, identificados por `poolId = keccak256(abi.encode(PoolKey))`.
 *   Não há `getPool()` numa factory nem `slot0()` num endereço de pool.
 * - **o estado se lê pelo `StateView`**, um contrato periférico de leitura.
 * - **faixa e poolId vêm empacotados** num único uint256 (`PositionInfo`).
 *
 * Tudo aqui foi validado on-chain em 10/08/2026 (`poc/probe-uniswap-v4-read.ts`):
 * o layout do PositionInfo é conferido contra o keccak256 calculado à parte,
 * e as taxas resultantes bateram com a interface oficial do Uniswap ao centavo.
 */

import { encodeAbiParameters, encodePacked, keccak256, parseAbi, parseAbiItem, type Address, type Hex } from "viem";

export const positionManagerAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "function getPoolAndPositionInfo(uint256 tokenId) view returns (PoolKey memory, uint256)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
]);

export const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128)",
  "function getFeeGrowthInside(bytes32 poolId, int24 tickLower, int24 tickUpper) view returns (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128)",
  "function getPositionInfo(bytes32 poolId, bytes32 positionId) view returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128)",
]);

export const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

/** endereço zero: no v4 significa a moeda NATIVA da rede (não um token ERC-20) */
export const NATIVE_CURRENCY: Address = "0x0000000000000000000000000000000000000000";

/** hook padrão (sem hook) — pool com hook próprio pode cobrar taxa por fora */
export const NO_HOOK: Address = "0x0000000000000000000000000000000000000000";

export const Q128 = 1n << 128n;
const UINT256_MASK = (1n << 256n) - 1n;

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

/** subtração com wrap de 256 bits — é assim que o contrato acumula fee growth */
export function wrapSub(a: bigint, b: bigint): bigint {
  return (a - b) & UINT256_MASK;
}

/** int24 com sinal a partir dos 24 bits baixos de um bigint */
function toInt24(v: bigint): number {
  const x = Number(v & 0xffffffn);
  return x >= 0x800000 ? x - 0x1000000 : x;
}

export interface PositionInfo {
  tickLower: number;
  tickUpper: number;
  hasSubscriber: boolean;
  /** os 25 bytes altos do poolId — serve para CONFERIR o layout */
  poolIdTruncated: bigint;
}

/**
 * Desempacota o `PositionInfo`. Layout do `PositionInfoLibrary`:
 *   [255..56] poolId truncado (25 bytes) · [55..32] tickUpper (int24)
 *   [31..8] tickLower (int24) · [7..0] flag de subscriber
 */
export function unpackPositionInfo(info: bigint): PositionInfo {
  return {
    tickUpper: toInt24(info >> 32n),
    tickLower: toInt24(info >> 8n),
    hasSubscriber: (info & 0xffn) !== 0n,
    poolIdTruncated: info >> 56n,
  };
}

/** poolId = keccak256(abi.encode(PoolKey)) */
export function poolIdOf(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "currency0", type: "address" },
            { name: "currency1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "tickSpacing", type: "int24" },
            { name: "hooks", type: "address" },
          ],
        },
      ],
      [key],
    ),
  );
}

/** o poolId desempacotado bate com o calculado? (guarda contra layout errado) */
export function positionInfoMatchesPool(info: PositionInfo, poolId: Hex): boolean {
  return BigInt(poolId) >> 56n === info.poolIdTruncated;
}

/**
 * Chave da posição DENTRO do PoolManager. O dono é sempre o PositionManager
 * (é ele que detém a liquidez); o `salt` é o tokenId do NFT.
 *   keccak256(abi.encodePacked(owner, tickLower, tickUpper, salt))
 */
export function positionIdOf(
  positionManager: Address,
  tickLower: number,
  tickUpper: number,
  tokenId: bigint,
): Hex {
  const salt = `0x${tokenId.toString(16).padStart(64, "0")}` as Hex;
  return keccak256(encodePacked(["address", "int24", "int24", "bytes32"], [positionManager, tickLower, tickUpper, salt]));
}

/** taxas pendentes de um lado: (growthAtual - growthNaÚltimaVez) * L / 2^128 */
export function pendingFee(growthNow: bigint, growthLast: bigint, liquidity: bigint): bigint {
  return (wrapSub(growthNow, growthLast) * liquidity) / Q128;
}

export interface V4RawPosition {
  tokenId: bigint;
  key: PoolKey;
  poolId: Hex;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}
