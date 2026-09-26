/**
 * Fixture dos testes: a carteira DEMO (0x892Ff98a…, de terceiro), congelada
 * por `poc/capture-demo-fixture.ts` — posições cruas do Sugar, metadados dos
 * pools e tokens, na Base (Aerodrome) e na Optimism (Velodrome).
 *
 * ⚠️ Fixture de teste é SEMPRE de carteira de terceiro. Até 26/09/2026 os
 * testes usavam a carteira do dono do projeto, e o repo é público: isso
 * ligava o nome dos commits àquela carteira.
 */

import type { Address } from "viem";
import { toLpPosition, type PoolMeta } from "../core/adapters/aerodrome/index";
import type { SugarPosition } from "../core/adapters/aerodrome/abi";
import type { LpPosition, TokenInfo } from "../core/types";
import fixture from "../poc/fixture-demo.json";

export const DEMO_ACCOUNT = fixture.account as Address;

type RawJson = (typeof fixture)["base"]["positions"][number];
type Rede = "base" | "optimism";

/** o JSON guarda bigint como string — reidrata para o tipo do Sugar */
export function revive(j: RawJson): SugarPosition {
  return {
    id: BigInt(j.id),
    lp: j.lp as Address,
    liquidity: BigInt(j.liquidity),
    staked: BigInt(j.staked),
    amount0: BigInt(j.amount0),
    amount1: BigInt(j.amount1),
    staked0: BigInt(j.staked0),
    staked1: BigInt(j.staked1),
    unstaked_earned0: BigInt(j.unstaked_earned0),
    unstaked_earned1: BigInt(j.unstaked_earned1),
    emissions_earned: BigInt(j.emissions_earned),
    tick_lower: j.tick_lower,
    tick_upper: j.tick_upper,
    sqrt_ratio_lower: BigInt(j.sqrt_ratio_lower),
    sqrt_ratio_upper: BigInt(j.sqrt_ratio_upper),
    locker: j.locker as Address,
    unlocks_at: j.unlocks_at,
    alm: j.alm as Address,
  };
}

const big = (v: unknown) => (v === null || v === undefined ? null : BigInt(v as string));

export function poolMeta(rede: Rede, lp: string): PoolMeta {
  const m = (fixture[rede].pools as Record<string, Record<string, unknown>>)[lp];
  if (!m) throw new Error(`pool ${lp} fora do fixture (${rede})`);
  return {
    kind: m.kind as PoolMeta["kind"],
    spacing: (m.spacing as number | null) ?? null,
    tick: (m.tick as number | null) ?? null,
    symbol: (m.symbol as string | null) ?? null,
    token0: m.token0 as Address,
    token1: m.token1 as Address,
    activeLiquidity: big(m.activeLiquidity),
    poolStakedLiquidity: big(m.poolStakedLiquidity),
    gauge: (m.gauge as Address | null | undefined) ?? null,
    emissionRatePerSec: big(m.emissionRatePerSec),
  };
}

export function tokens(rede: Rede): Map<Address, TokenInfo> {
  return new Map(
    Object.entries(fixture[rede].tokens as Record<string, TokenInfo>).map(([a, t]) => [a as Address, t]),
  );
}

export function token(rede: Rede, symbol: string): TokenInfo {
  const t = [...tokens(rede).values()].find((x) => x.symbol === symbol);
  if (!t) throw new Error(`token ${symbol} fora do fixture (${rede})`);
  return t;
}

/** posição crua da rede cujo símbolo de pool (ou par, nas concentradas) bate */
export function rawBy(rede: Rede, pick: (meta: PoolMeta, p: RawJson) => boolean): SugarPosition {
  const j = fixture[rede].positions.find((p) => pick(poolMeta(rede, p.lp), p));
  if (!j) throw new Error(`posição não encontrada no fixture (${rede})`);
  return revive(j);
}

/** todas as posições da rede já normalizadas, como o adapter faria */
export function normalized(rede: Rede): LpPosition[] {
  const cfg = fixture[rede];
  const tk = tokens(rede);
  const emissao = tk.get(cfg.emissionsToken as Address)!;
  return cfg.positions.map((j) =>
    toLpPosition(revive(j), poolMeta(rede, j.lp), tk, emissao, cfg.protocol, cfg.chainId),
  );
}

export const EMISSION = {
  base: fixture.base.emissionsToken as Address,
  optimism: fixture.optimism.emissionsToken as Address,
};
