/**
 * Simulador de APR pela linha de comando — o mesmo caminho do /api/pool.
 *   npx tsx --env-file=.env.local poc/simulador.ts 0xPOOL [US$] [faixa±%]
 */
import { extractPoolAddress, lookupPool } from "../core/simulator/lookup";
import { simulate } from "../core/simulator/math";

const addr = extractPoolAddress(process.argv[2] ?? "");
if (!addr) throw new Error("passe o endereço do pool");
const usd = Number(process.argv[3] ?? 1000);
const pct = Number(process.argv[4] ?? 5) / 100;
const t0 = Date.now();
const pools = await lookupPool(addr, undefined, (m) => console.log("  aviso:", m));
console.log(`${pools.length} pool(s) em ${Date.now() - t0} ms`);
for (const p of pools) {
  const { feeWindows, history, ...resto } = p;
  console.log(resto, `janelas: ${feeWindows.map((w) => w.windowSec + "s").join(", ")}`, `histórico: ${history?.length ?? 0} pontos`);
  const cur = (p.price0Usd ?? 0) / (p.price1Usd ?? 1);
  const r = simulate(p, { depositUsd: usd, priceLower: cur * (1 - pct), priceUpper: cur * (1 + pct), staked: true });
  console.log(r);
}
