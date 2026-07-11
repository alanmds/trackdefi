/**
 * Matemática de liquidez concentrada em BigInt puro (formato Q96 do
 * Uniswap V3 / Slipstream) — port de LiquidityAmounts.getAmountsForLiquidity.
 *
 * Usos: (1) contraprova independente dos números do Sugar na validação da
 * Fase 5; (2) base para futuros adapters que não entregam amounts prontos
 * (ex.: Uniswap V3). Arredondamento para baixo (floor), como no contrato.
 */

export const Q96 = 1n << 96n;

export interface Amounts {
  amount0: bigint;
  amount1: bigint;
}

/**
 * Quantidades de token0/token1 representadas por `liquidity` numa faixa
 * [sqrtLower, sqrtUpper], dado o preço corrente sqrtCur (todos sqrtPriceX96).
 */
export function amountsForLiquidity(
  liquidity: bigint,
  sqrtCur: bigint,
  sqrtLower: bigint,
  sqrtUpper: bigint,
): Amounts {
  if (liquidity < 0n) throw new Error("liquidity negativa");
  if (sqrtLower <= 0n || sqrtUpper <= 0n) throw new Error("sqrt ratio deve ser positivo");
  if (sqrtLower > sqrtUpper) [sqrtLower, sqrtUpper] = [sqrtUpper, sqrtLower];

  let amount0 = 0n;
  let amount1 = 0n;

  if (sqrtCur <= sqrtLower) {
    // preço abaixo da faixa — posição 100% token0
    amount0 = (liquidity * Q96 * (sqrtUpper - sqrtLower)) / (sqrtUpper * sqrtLower);
  } else if (sqrtCur < sqrtUpper) {
    // dentro da faixa — mistura dos dois
    amount0 = (liquidity * Q96 * (sqrtUpper - sqrtCur)) / (sqrtUpper * sqrtCur);
    amount1 = (liquidity * (sqrtCur - sqrtLower)) / Q96;
  } else {
    // preço acima da faixa — posição 100% token1
    amount1 = (liquidity * (sqrtUpper - sqrtLower)) / Q96;
  }

  return { amount0, amount1 };
}
