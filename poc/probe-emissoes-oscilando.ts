/**
 * Investigação (fila, item 3 — 27/09/2026): por que o APR de EMISSÕES oscila
 * tanto entre leituras? Em 02/08 a mesma posição foi de 225% a 89% em 1 min,
 * e toda a variação veio das emissões.
 *
 * Fórmula (core/yields/positionApr.ts):
 *   emissões/s da posição = rewardRate × (L_staked_posição / L_staked_ATIVA_pool)
 * `pool.stakedLiquidity()` é a liquidez em stake ATIVA NO TICK ATUAL: quando o
 * preço cruza um tick, faixas de outros LPs entram ou saem e o denominador
 * pula. Esta sonda lê as posições em stake de uma carteira a cada 30 s e
 * separa cada ingrediente, para ver QUAL deles mexe.
 *
 * Uso: npx tsx poc/probe-emissoes-oscilando.ts [carteira] [leituras]
 */

import type { Address } from "viem";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { createReader } from "../core/chain";

const CARTEIRA = (process.argv[2] ?? "0xad93e07a25e815ebb69bc3272b36ff563197d33b") as Address;
const LEITURAS = Number(process.argv[3] ?? 10);
const ANO = 365 * 24 * 3600;
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

const adapter = new AerodromeAdapter(createReader(8453));
const serie = new Map<string, string[]>();
for (let i = 0; i < LEITURAS; i++) {
  const t = new Date().toISOString().slice(11, 19);
  const ps = (await adapter.getPositions(CARTEIRA)).filter((p) => p.staked && p.earningInputs?.poolStakedLiquidity);
  for (const p of ps) {
    const e = p.earningInputs!;
    const rate = Number(e.emissionRatePerSec ?? 0n) / 1e18;
    const share = Number(e.stakedLiquidity) / Number(e.poolStakedLiquidity);
    // tokens de emissão por ANO da posição — sem preço, para isolar o que é da rede
    const porAno = rate * share * ANO;
    const linha = `${t} tick ${p.range?.tickCurrent} · rewardRate ${rate.toFixed(6)}/s · L_ativa_stake ${e.poolStakedLiquidity} · fatia ${(share * 100).toFixed(4)}% · ${porAno.toFixed(2)} tokens/ano`;
    const k = `${p.poolSymbol} #${p.positionId}`;
    (serie.get(k) ?? serie.set(k, []).get(k)!).push(linha);
  }
  if (i < LEITURAS - 1) await dorme(30_000);
}
for (const [k, linhas] of serie) {
  console.log(`\n━━ ${k}`);
  for (const l of linhas) console.log("  " + l);
}
