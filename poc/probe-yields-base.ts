/**
 * Receita C: mede a cobertura REAL da DefiLlama na Base e na Optimism
 * (17/07/2026 — decidir "ship agora" vs "corrigir lacunas antes").
 * Também procura slugs alternativos que possam cobrir uniswap na Base.
 */

export {}; // arquivo-script: evita colisao de escopo global no tsc

async function main() {
  console.log("baixando dataset...");
  const res = await fetch("https://yields.llama.fi/pools");
  const all = ((await res.json()) as { data: any[] }).data ?? [];

  for (const chain of ["Base", "Optimism", "Arbitrum", "Ethereum"]) {
    const rows = all.filter((p) => p.chain === chain);
    const byProject = new Map<string, number>();
    for (const p of rows) byProject.set(p.project, (byProject.get(p.project) ?? 0) + 1);
    const dexes = [...byProject.entries()]
      .filter(([k]) => /uniswap|aerodrome|velodrome|pancake|sushi/.test(k))
      .sort((a, b) => b[1] - a[1]);
    console.log(`\n${chain}: ${rows.length} pools · projetos DEX relevantes:`);
    for (const [k, n] of dexes) console.log(`  ${k.padEnd(24)} ${n}`);
  }

  // aerodrome na Base: quantos pools passariam nos nossos guardas (TVL>=10k, apy!=null)?
  const aero = all.filter(
    (p) => p.chain === "Base" && /^aerodrome/.test(p.project) && p.apy !== null && p.tvlUsd >= 10_000,
  );
  console.log(`\naerodrome na Base com TVL>=10k e apy != null: ${aero.length} pools`);
}

main().catch((e) => {
  console.error("Falhou:", (e as Error).message);
  process.exit(1);
});
