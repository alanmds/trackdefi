/**
 * PoC da descoberta de pares (26/10/2026) — antes de tocar no site.
 *
 * 1. Quantas linhas do yields.llama.fi caem nos pares (protocolo × rede) que o
 *    trackdefi lê? Quais slugs de projeto da DefiLlama correspondem a cada um?
 * 2. Quantas trazem volume 24 h e underlyingTokens?
 * 3. O POST coins.llama.fi/mcaps aguenta quantos tokens por pedido, e cobre
 *    quantos dos tokens desses pares?
 *
 *   npx tsx poc/probe-descoberta.ts
 */

import { buildAdapters } from "../core/adapters/registry";
import { CHAINS } from "../core/chains";

const lidos = new Set(buildAdapters().map((a) => `${a.protocol}@${a.chainId}`));
const porLabel = new Map(Object.entries(CHAINS).map(([id, c]) => [c.yieldsLabel, Number(id)]));

const t0 = Date.now();
const body = (await (await fetch("https://yields.llama.fi/pools")).json()) as { data: Record<string, unknown>[] };
console.log(`dataset: ${body.data.length} linhas em ${Date.now() - t0} ms`);

// slugs candidatos — conferir abaixo quais caem em redes nossas
const SLUGS = /aerodrome|velodrome|uniswap|pancake|sushi|ramses|orca/;
const tabela = new Map<string, number>();
for (const r of body.data) {
  if (!SLUGS.test(String(r.project))) continue;
  const id = porLabel.get(String(r.chain));
  if (id === undefined) continue;
  const k = `${r.project} @ ${CHAINS[id].label}`;
  tabela.set(k, (tabela.get(k) ?? 0) + 1);
}
console.log("\nslug × rede nossa (linhas):");
for (const [k, n] of [...tabela.entries()].sort()) console.log(`  ${k}: ${n}`);
console.log("\nadapters (protocolo@rede):", [...lidos].sort().join(" "));

// mcaps: cobertura e tamanho de lote
const tokens = new Set<string>();
for (const r of body.data) {
  const id = porLabel.get(String(r.chain));
  if (id === undefined || !SLUGS.test(String(r.project))) continue;
  for (const t of (r.underlyingTokens as string[] | null) ?? []) tokens.add(`${CHAINS[id].priceSlug}:${t}`);
}
const lista = [...tokens];
console.log(`\ntokens distintos: ${lista.length}`);
for (const lote of [100, 500]) {
  const t1 = Date.now();
  const res = await fetch("https://coins.llama.fi/mcaps", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ coins: lista.slice(0, lote) }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, { mcap?: number }>;
  const com = Object.values(j).filter((v) => typeof v?.mcap === "number" && v.mcap > 0).length;
  console.log(`  lote ${lote}: HTTP ${res.status}, ${com} com mcap, ${Date.now() - t1} ms`);
}
