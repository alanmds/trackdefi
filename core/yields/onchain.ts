/**
 * Fee APR da POSIÇÃO medido no próprio contrato — sem DefiLlama (Receita G).
 *
 * Decisão do Alan em 02/08/2026: sair da dependência para o APR. O motivo está
 * medido, não é gosto — o dataset grátis da DefiLlama não traz endereço de
 * pool, então o casamento é por par de tokens + tick spacing (9 candidatos
 * medidos para WETH/USDC na Base), o `apyReward` já apareceu como 6012% num
 * pool CL1, há linhas duplicadas mortas, e não há cobertura nenhuma de
 * Uniswap v3 na Robinhood Chain.
 *
 * A CONTA
 * `feeGrowthGlobal{0,1}X128` são acumuladores Q128: taxas por unidade de
 * liquidez, desde o nascimento do pool. Para uma posição que ficou EM RANGE
 * durante a janela:
 *
 *     taxas_da_posição = Δ feeGrowthGlobal × L_da_posição ÷ 2^128
 *
 * Repare no que NÃO aparece: TVL do pool, liquidez ativa, nome de pool. É por
 * isso que este caminho é melhor que o do apyBase — o PoC de 02/08 mostrou os
 * dois discordando de forma SISTEMÁTICA (0,78–0,89× em três pools grandes,
 * nunca acima de 1×), o que indica denominador diferente no APR do POOL. No
 * APR da POSIÇÃO esse denominador não existe.
 *
 * LIMITES (por que o resultado pode ser null)
 * - Exige RPC com ARQUIVO. Sem chave, o RPC público recusa estado histórico —
 *   a falha vira "sem dado", nunca número inventado.
 * - Assume a posição em range a janela inteira. Se o tick saiu e voltou, o
 *   número sai ALTO (usa fg_global no lugar de fg_inside) — por isso o teto
 *   de sanidade compartilhado com o positionApr.ts.
 * - Preço ainda vem do PriceProvider (a Receita H trata disso).
 */

import { parseAbi, type Address } from "viem";
import type { ChainReader } from "../types";
import { MAX_SANE_EARNING } from "./positionApr";

const Q128 = 2n ** 128n;
const YEAR_SEC = 365 * 24 * 3600;

/** janela padrão. 24 h dilui o ruído do fluxo de swaps sem exigir arquivo profundo. */
export const DEFAULT_WINDOW_HOURS = 24;

export const poolFeeGrowthAbi = parseAbi([
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
]);

export interface OnchainFeeInputs {
  /** Δ feeGrowthGlobal0X128 na janela (agora − passado) */
  delta0: bigint;
  delta1: bigint;
  /** L da posição (liquidez crua), incluindo a parcela em stake */
  posLiquidity: bigint | null;
  /** duração real da janela, em segundos */
  windowSec: number;
  decimals0: number;
  decimals1: number;
  price0Usd: number | null;
  price1Usd: number | null;
  /** valor da posição em US$ — denominador do APR */
  positionValueUsd: number | null;
}

/**
 * PURO e testável: dados os deltas, devolve o % ao ano de taxas da posição.
 * null = não dá para afirmar nada com honestidade.
 */
export function computeOnchainFeeApr(i: OnchainFeeInputs): number | null {
  if (
    i.posLiquidity === null ||
    i.posLiquidity <= 0n ||
    i.positionValueUsd === null ||
    i.positionValueUsd <= 0 ||
    i.price0Usd === null ||
    i.price1Usd === null ||
    i.windowSec <= 0 ||
    i.delta0 < 0n ||
    i.delta1 < 0n
  ) {
    return null;
  }

  // acumulador só cresce; delta negativo seria leitura inconsistente (já barrado)
  const raw0 = (i.delta0 * i.posLiquidity) / Q128;
  const raw1 = (i.delta1 * i.posLiquidity) / Q128;
  const feesUsd = (Number(raw0) / 10 ** i.decimals0) * i.price0Usd + (Number(raw1) / 10 ** i.decimals1) * i.price1Usd;
  if (!Number.isFinite(feesUsd) || feesUsd < 0) return null;

  const pct = ((feesUsd / i.windowSec) * YEAR_SEC * 100) / i.positionValueUsd;
  if (!Number.isFinite(pct) || pct < 0 || pct > MAX_SANE_EARNING) return null;
  return pct;
}

export interface FeeGrowthWindow {
  delta0: bigint;
  delta1: bigint;
  windowSec: number;
}

/**
 * Lê o par de acumuladores agora e num bloco passado. Devolve null em
 * QUALQUER falha (RPC sem arquivo é o caso comum) — o chamador então cai no
 * "—", que é a política do projeto.
 *
 * `onWarn` recebe o motivo uma vez por pool, para o aviso aparecer na UI.
 */
export async function readFeeGrowthWindow(
  reader: ChainReader,
  pool: Address,
  currentBlock: bigint,
  secPerBlock: number,
  windowHours = DEFAULT_WINDOW_HOURS,
  onWarn: (msg: string) => void = () => {},
): Promise<FeeGrowthWindow | null> {
  const blocks = BigInt(Math.max(1, Math.round((windowHours * 3600) / secPerBlock)));
  if (currentBlock <= blocks) return null; // rede jovem demais para a janela
  const past = currentBlock - blocks;

  const read = (fn: string, blockNumber?: bigint) =>
    reader.readContract({ address: pool, abi: poolFeeGrowthAbi, functionName: fn, ...(blockNumber ? { blockNumber } : {}) }) as Promise<bigint>;

  try {
    const [g0n, g1n, g0o, g1o] = await Promise.all([
      read("feeGrowthGlobal0X128"),
      read("feeGrowthGlobal1X128"),
      read("feeGrowthGlobal0X128", past),
      read("feeGrowthGlobal1X128", past),
    ]);
    return { delta0: g0n - g0o, delta1: g1n - g1o, windowSec: Number(blocks) * secPerBlock };
  } catch (e) {
    onWarn(`fee APR on-chain indisponível em ${pool.slice(0, 10)}… (RPC sem estado histórico): ${(e as Error).message.split("\n")[0].slice(0, 60)}`);
    return null;
  }
}
