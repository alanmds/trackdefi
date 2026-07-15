/**
 * PoC-A parte 2: (1) cobertura da Velodrome; (2) casar POR CONJUNTO DE TOKENS
 * (ja que o endereco do pool nao esta no dataset) e medir o problema de
 * desambiguacao (mesma dupla de tokens em varios fee tiers).
 */

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const WETH = "0x4200000000000000000000000000000000000006".toLowerCase();
const CBBTC = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf".toLowerCase();

function sameTokens(pool: any, a: string, b: string): boolean {
  const ut = (pool.underlyingTokens ?? []).map((x: string) => x.toLowerCase());
  return ut.length === 2 && ut.includes(a) && ut.includes(b);
}

async function main() {
  const res = await fetch("https://yields.llama.fi/pools");
  const all = ((await res.json()) as { data: any[] }).data ?? [];

  // 1) cobertura Velodrome
  console.log("Projects com 'velo' (slug → nº total de pools):");
  const velo = new Map<string, number>();
  for (const p of all) if (/velo/i.test(p.project)) velo.set(p.project, (velo.get(p.project) ?? 0) + 1);
  for (const [k, n] of [...velo.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(26)} ${n}`);
  const veloOp = all.filter((p) => /velo/i.test(p.project) && p.chain === "Optimism");
  console.log(`  → na Optimism: ${veloOp.length} pools; ex.: ${veloOp.slice(0, 3).map((p) => `${p.symbol} (apy=${p.apy}, m30=${p.apyMean30d}, inc=${p.apyBaseInception})`).join(" | ")}`);

  // 2) casamento por tokens + desambiguacao
  console.log("\nCasamento por conjunto de tokens (Base):");
  for (const [label, a, b] of [
    ["WETH/USDC", WETH, USDC],
    ["USDC/cbBTC", USDC, CBBTC],
  ] as const) {
    const cands = all.filter((p) => p.chain === "Base" && /aero/i.test(p.project) && sameTokens(p, a, b));
    console.log(`  ${label}: ${cands.length} candidato(s) na DefiLlama`);
    for (const c of cands) {
      console.log(`     · ${c.project} | poolMeta=${JSON.stringify(c.poolMeta)} | symbol=${c.symbol} | apy=${c.apy}% | m30=${c.apyMean30d}% | incBase=${c.apyBaseInception}% | TVL=$${Math.round(c.tvlUsd)}`);
    }
  }
}

main().catch((e) => {
  console.error("Falhou:", (e as Error).message);
  process.exit(1);
});
