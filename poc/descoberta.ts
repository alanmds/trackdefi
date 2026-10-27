/**
 * Descoberta de pares pela linha de comando — o mesmo caminho do /api/pairs.
 *   npx tsx --env-file=.env.local poc/descoberta.ts [arquivo.json]   (com arquivo: grava o fixture)
 */
import { writeFileSync } from "node:fs";
import { loadPairs } from "../core/discovery/pairs";

const t0 = Date.now();
const dto = await loadPairs((m) => console.log("  aviso:", m));
const p = dto.pairs;
console.log(`${p.length} pares em ${Date.now() - t0} ms · ${JSON.stringify(dto).length} bytes`);
console.log(`com APR ${p.filter((x) => x.apr !== null).length} · com volume ${p.filter((x) => x.volume1d !== null).length} · com market cap ${p.filter((x) => x.mcapMin !== null).length} · com endereço ${p.filter((x) => x.pool !== null).length}`);
const semEndereco: Record<string, number> = {};
const comEndereco: Record<string, number> = {};
for (const x of p) {
  const k = `${x.protocol}@${x.chainId}`;
  if (x.pool) comEndereco[k] = (comEndereco[k] ?? 0) + 1;
  else semEndereco[k] = (semEndereco[k] ?? 0) + 1;
}
console.log("com endereço:", comEndereco);
console.log("sem endereço:", semEndereco);
console.log(p.filter((x) => x.symbol === "WETH-USDC" && x.chainId === 8453).map((x) => [x.protocol, x.meta, x.pool]));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(dto));
