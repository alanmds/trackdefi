/**
 * trackdefi core — modelo normalizado, independente de protocolo/rede.
 *
 * Regra anti-retrabalho do projeto: TODO código específico de protocolo vive
 * atrás de ProtocolAdapter. Interface, API, preços e site só conhecem estes
 * tipos. Valores monetários ficam em bigint (unidades cruas do token) até a
 * borda de apresentação — float só na formatação final.
 */

import type { Address } from "viem";

export interface TokenInfo {
  address: Address;
  symbol: string;
  decimals: number;
}

export type PositionKind = "v2-volatile" | "v2-stable" | "concentrated";

export interface RewardAmount {
  token: TokenInfo;
  raw: bigint;
  /** fee = taxa de swap acumulada; emission = incentivo do protocolo (ex.: AERO) */
  kind: "fee" | "emission";
}

export interface RangeInfo {
  tickLower: number;
  tickUpper: number;
  tickCurrent: number;
  inRange: boolean;
  /** preços expressos como token1 por 1 token0 (orientação de exibição fica na UI) */
  priceLower: number;
  priceUpper: number;
  priceCurrent: number;
}

export interface LpPosition {
  protocol: string;
  chainId: number;
  poolAddress: Address;
  poolSymbol: string;
  kind: PositionKind;
  /** id do NFT para posições concentradas; null para pools clássicos */
  positionId: string | null;
  staked: boolean;
  /** gestor automático de liquidez (ALM), quando a posição não é gerida direto pela carteira */
  managedByAlm: Address | null;
  token0: TokenInfo;
  token1: TokenInfo;
  /** principal total da posição (depositado + em stake), em unidades cruas */
  amount0Raw: bigint;
  amount1Raw: bigint;
  rewards: RewardAmount[];
  /** null para pools clássicos */
  range: RangeInfo | null;
}

export interface ProtocolAdapter {
  readonly protocol: string;
  readonly chainId: number;
  getPositions(account: Address): Promise<LpPosition[]>;
}

/**
 * Superfície mínima de leitura on-chain que os adapters usam. Um PublicClient
 * do viem satisfaz este tipo; testes injetam stubs.
 */
export type ChainReader = {
  readContract(args: {
    address: Address;
    abi: unknown;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
  multicall(args: {
    contracts: readonly {
      address: Address;
      abi: unknown;
      functionName: string;
      args?: readonly unknown[];
    }[];
    allowFailure: true;
  }): Promise<{ status: "success" | "failure"; result?: unknown; error?: Error }[]>;
};
