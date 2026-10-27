/**
 * Congela a resposta do /api/pool de um pool real (dados públicos de pool,
 * nenhuma carteira) — para os testes do simulador e para o preview sem rede:
 *   npx tsx --env-file=.env.local poc/capture-pool-fixture.ts 0xPOOL arquivo.json
 */
import { writeFileSync } from "node:fs";
import { extractPoolAddress, lookupPool } from "../core/simulator/lookup";

const addr = extractPoolAddress(process.argv[2] ?? "");
const out = process.argv[3];
if (!addr || !out) throw new Error("uso: capture-pool-fixture.ts 0xPOOL arquivo.json");
const pools = await lookupPool(addr);
writeFileSync(out, JSON.stringify({ pools }, null, 1));
console.log(`${pools.length} pool(s) → ${out}`);
