/**
 * ABIs mínimas para ler a Aerodrome.
 *
 * O struct Position foi copiado campo a campo do LpSugar.vy
 * (github.com/velodrome-finance/sugar) e VALIDADO contra o contrato
 * publicado em 10/07/2026 — decodifica corretamente.
 *
 * Metadados de pool são lidos DIRETO do contrato do pool (token0/token1/
 * stable/tickSpacing/slot0) em vez do byAddress do Sugar: o struct Lp do
 * contrato publicado diverge do branch main (achado da Fase 1), e a leitura
 * direta é imune a versões do Sugar.
 */

import { parseAbi } from "viem";

export const sugarAbi = parseAbi([
  "struct Position { uint256 id; address lp; uint256 liquidity; uint256 staked; uint256 amount0; uint256 amount1; uint256 staked0; uint256 staked1; uint256 unstaked_earned0; uint256 unstaked_earned1; uint256 emissions_earned; int24 tick_lower; int24 tick_upper; uint160 sqrt_ratio_lower; uint160 sqrt_ratio_upper; address locker; uint32 unlocks_at; address alm; }",
  "function positions(uint256 _limit, uint256 _offset, address _account) view returns (Position[] memory)",
  "function positionsUnstakedConcentrated(uint256 _limit, uint256 _offset, address _account) view returns (Position[] memory)",
]);

export const factoryAbi = parseAbi([
  "function allPoolsLength() view returns (uint256)",
]);

/** factory CL (Slipstream): o pool é identificado pelo tick spacing. A factory
 *  clássica tem `getPool(a, b, bool)` — outro seletor, e a chamada só falha. */
export const clFactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address)",
]);

/** factory clássica (v2): o pool é identificado por stable/volatile */
export const v2FactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, bool stable) view returns (address)",
]);

/**
 * Pool clássico (v2) para o simulador. `index0/index1` = taxa acumulada por
 * LP token × 1e18 (o pool soma `taxa × 1e18 ÷ totalSupply` a cada swap) —
 * provado em `poc/probe-classico.ts` (27/10/2026).
 */
export const v2PoolAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function index0() view returns (uint256)",
  "function index1() view returns (uint256)",
]);

/** Voter (para achar o gauge de um pool clássico) — a Sugar informa, em toda rede */
export const sugarVoterAbi = parseAbi(["function voter() view returns (address)"]);
export const voterGaugesAbi = parseAbi(["function gauges(address pool) view returns (address)"]);
/** gauge clássico: LP em stake, que divide o rewardRate */
export const v2GaugeAbi = parseAbi(["function totalSupply() view returns (uint256)"]);

/** taxa de swap do pool CL, em milionésimos (o simulador mostra) */
export const clFeeAbi = parseAbi(["function fee() view returns (uint24)"]);

/** sondas de metadados — cada pool responde só às funções do seu tipo.
 * liquidity/stakedLiquidity/gauge só existem nos pools CL (Slipstream) →
 * pool clássico falha nelas (allowFailure) e vira null. */
export const poolProbeAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function stable() view returns (bool)",
  "function symbol() view returns (string)",
  "function tickSpacing() view returns (int24)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function stakedLiquidity() view returns (uint128)",
  "function gauge() view returns (address)",
]);

/** gauge CL do Slipstream — taxa de emissão por segundo (token do gauge). */
export const gaugeAbi = parseAbi([
  "function rewardRate() view returns (uint256)",
  // fim do período pago; depois dele o gauge não paga, mas o rewardRate fica
  "function periodFinish() view returns (uint256)",
]);

/** Formato cru retornado pelo Sugar (espelha o struct Position). */
export type SugarPosition = {
  id: bigint;
  lp: `0x${string}`;
  liquidity: bigint;
  staked: bigint;
  amount0: bigint;
  amount1: bigint;
  staked0: bigint;
  staked1: bigint;
  unstaked_earned0: bigint;
  unstaked_earned1: bigint;
  emissions_earned: bigint;
  tick_lower: number;
  tick_upper: number;
  sqrt_ratio_lower: bigint;
  sqrt_ratio_upper: bigint;
  locker: `0x${string}`;
  unlocks_at: number;
  alm: `0x${string}`;
};

/** MAX_POSITIONS do LpSugar.vy — teto de retorno POR CHAMADA. Chamada que
 * devolve exatamente este número pode ter truncado → re-varrer em janelas
 * menores. */
export const SUGAR_MAX_POSITIONS = 200;
