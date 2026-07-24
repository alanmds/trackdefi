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
  /**
   * Insumos on-chain para o APR "rendendo agora" da posição (Receita C2).
   * Só as posições concentradas trazem; adapter que não coleta deixa ausente
   * e o `earning` do DTO degrada (fee "—" ou só a parte disponível).
   */
  earningInputs?: EarningInputsOnchain;
}

/** Números on-chain que o service combina com preços + APR do pool para o
 *  APR "rendendo agora" (ver core/yields/positionApr.ts). */
export interface EarningInputsOnchain {
  /** L da posição (taxas) — unidades cruas */
  liquidity: bigint | null;
  /** pool.liquidity(): liquidez ativa no tick corrente */
  activeLiquidity: bigint | null;
  /** L em stake da posição (emissões) */
  stakedLiquidity: bigint | null;
  /** pool.stakedLiquidity(): liquidez em stake ativa do pool */
  poolStakedLiquidity: bigint | null;
  /** gauge.rewardRate(): token de emissão por segundo (unidades cruas) */
  emissionRatePerSec: bigint | null;
  /** token de emissão do gauge (para o service buscar o preço) */
  emissionToken: TokenInfo | null;
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
  /**
   * eth_call simulando uma função de escrita SEM transação (continua 100%
   * leitura). Usado p/ ler taxas pendentes da Uniswap via collect().
   * Opcional: adapters devem degradar com aviso quando ausente.
   */
  simulateContract?(args: {
    address: Address;
    abi: unknown;
    functionName: string;
    args?: readonly unknown[];
    account: Address;
  }): Promise<{ result: unknown }>;
};
