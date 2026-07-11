/**
 * Matemática de liquidez concentrada (modelo Uniswap V3 / Slipstream).
 *
 * Convenção: "price0In1" = quantos token1 vale 1 token0, já ajustado pelas
 * casas decimais de cada token. Ex.: pool WETH(18)/USDC(6) com tick -201k
 * → ~1.790 USDC por WETH.
 */

/** Preço de 1 token0 em token1 para um tick, ajustado por decimais. */
export function tickToPrice0In1(tick: number, decimals0: number, decimals1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, decimals0 - decimals1);
}

/**
 * Posição concentrada rende taxas quando tickLower <= tickCurrent < tickUpper
 * (limite inferior inclusivo, superior exclusivo — convenção do Uniswap V3).
 */
export function isInRange(tickCurrent: number, tickLower: number, tickUpper: number): boolean {
  return tickCurrent >= tickLower && tickCurrent < tickUpper;
}

export interface OrientedRange {
  /** true = exibindo token0 por token1 (direção invertida para legibilidade) */
  inverted: boolean;
  lower: number;
  upper: number;
  current: number;
}

/**
 * Escolhe a direção mais legível para exibir uma faixa de preços: se o preço
 * corrente é fracionário (< 1), inverte — ex.: 0,0000155 cbBTC/USDC vira
 * ~64.500 USDC/cbBTC. Preço corrente <= 0 mantém a direção original.
 */
export function orientRange(priceLower: number, priceUpper: number, priceCurrent: number): OrientedRange {
  if (priceCurrent >= 1 || priceCurrent <= 0 || !Number.isFinite(priceCurrent)) {
    return { inverted: false, lower: priceLower, upper: priceUpper, current: priceCurrent };
  }
  return { inverted: true, lower: 1 / priceUpper, upper: 1 / priceLower, current: 1 / priceCurrent };
}
