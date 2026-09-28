/**
 * Investigação (fila, item 3 — 27/09/2026): linhas DUPLICADAS no dataset de
 * APR da DefiLlama. O mesmo pool aparece duas vezes, uma delas "morta" (APY 0).
 * Como o casamento exige dominância de TVL (o maior com 10× o segundo), um
 * gêmeo morto com TVL parecido derruba o casamento e o card mostra "—".
 *
 * Mede no dataset ATUAL, com as mesmas regras do `core/yields/defillama.ts`:
 *  - quantos grupos (rede + protocolo + par + forma do pool) caem por falta de
 *    dominância;
 *  - em quantos a culpa é de um gêmeo morto — tirar as linhas de APY 0
 *    resolveria.
 *
 * Só mede; não muda nada no site. Uso: npx tsx poc/probe-duplicatas-defillama.ts
 */

import { CHAINS } from "../core/chains";
import { MIN_TVL_USD } from "../core/yields/defillama";

const PROJ: Record<string, string> = {
  "aerodrome-slipstream": "aerodrome",
  "aerodrome-v1": "aerodrome",
  "velodrome-v3": "velodrome",
  "velodrome-v2": "velodrome",
  "uniswap-v3": "uniswap-v3",
};
const DOMINANCE = 10;

interface Row {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyMean30d: number | null;
  poolMeta: string | null;
  underlyingTokens: string[] | null;
}

const labels = new Set(Object.values(CHAINS).map((c) => c.yieldsLabel));
const body = (await fetch("https://yields.llama.fi/pools").then((r) => r.json())) as { data: Row[] };
const rows = body.data.filter((r) => labels.has(r.chain) && PROJ[r.project] && r.underlyingTokens?.length === 2);

const forma = (r: Row) => {
  const cl = r.poolMeta?.match(/^CL(\d+)\b/);
  if (cl) return `CL${cl[1]}`;
  const fee = r.poolMeta?.match(/^([\d.]+)%/);
  return PROJ[r.project] === "uniswap-v3" && fee ? `fee${fee[1]}` : "v2";
};

const grupos = new Map<string, Row[]>();
for (const r of rows) {
  const [a, b] = r.underlyingTokens!.map((t) => t.toLowerCase()).sort();
  const k = `${r.chain}|${PROJ[r.project]}|${a}|${b}|${forma(r)}`;
  (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(r);
}

const decide = (cands: Row[]) => {
  const c = cands.filter((r) => r.apy !== null && r.tvlUsd >= MIN_TVL_USD).sort((x, y) => y.tvlUsd - x.tvlUsd);
  if (c.length === 0) return "vazio";
  return c.length === 1 || c[0].tvlUsd >= DOMINANCE * c[1].tvlUsd ? "casa" : "empate";
};

let empates = 0, porGemeoMorto = 0;
const exemplos: string[] = [];
for (const [k, g] of grupos) {
  if (decide(g) !== "empate") continue;
  empates++;
  const vivos = g.filter((r) => (r.apy ?? 0) > 0);
  if (decide(vivos) === "casa") {
    porGemeoMorto++;
    if (exemplos.length < 8) {
      const [chain, proto] = k.split("|");
      exemplos.push(
        `  ${chain} ${proto} ${g[0].symbol} (${forma(g[0])}): ` +
          g.map((r) => `TVL $${Math.round(r.tvlUsd).toLocaleString("en-US")} APY ${r.apy?.toFixed(1)}%`).join(" | "),
      );
    }
  }
}
console.log(`${rows.length} linhas das nossas redes/protocolos · ${grupos.size} grupos`);
console.log(`grupos que caem em "—" por falta de dominância: ${empates}`);
console.log(`…desses, resolvidos tirando só as linhas de APY 0 (gêmeo morto): ${porGemeoMorto}`);
console.log(exemplos.join("\n"));
