/**
 * Descoberta de pares pela linha de comando — o mesmo caminho do /api/pairs.
 *   npx tsx poc/descoberta.ts [arquivo.json]   (com arquivo: grava o fixture)
 */
import { writeFileSync } from "node:fs";
import { loadPairs } from "../core/discovery/pairs";

const t0 = Date.now();
const dto = await loadPairs((m) => console.log("  aviso:", m));
const p = dto.pairs;
console.log(`${p.length} pares em ${Date.now() - t0} ms · ${JSON.stringify(dto).length} bytes`);
console.log(`com APR ${p.filter((x) => x.apr !== null).length} · com volume ${p.filter((x) => x.volume1d !== null).length} · com market cap ${p.filter((x) => x.mcapMin !== null).length}`);
const porProto: Record<string, number> = {};
for (const x of p) porProto[`${x.protocol}@${x.chainId}`] = (porProto[`${x.protocol}@${x.chainId}`] ?? 0) + 1;
console.log(porProto);
console.log(p.filter((x) => x.apr !== null && x.mcapMin !== null).sort((a, b) => b.volume1d! - a.volume1d!).slice(0, 3));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(dto));
