/**
 * PoC da etapa A (APR & idade): a API de rendimentos da DefiLlama cobre nossos
 * pools? Qual e a CHAVE para casar o dado dela com o endereco do nosso pool?
 *
 *   npx tsx poc/probe-yields.ts
 */

// pools reais conhecidos (carteira 0x05963CdC + demo), para testar o casamento
const KNOWN: Record<string, string> = {
  "0x9D14ff91AE2c6e3D1A760542248B6c7F206894b0": "CL1-USDC/cbBTC (Aerodrome/Base)",
  "0x4e392fBfE4D0557C82D2F97F02ec39daA31516dd": "CL1-WETH/USDC (Aerodrome/Base)",
  "0x2Ec397DafBC0E693026a981f4bca988CDD93406B": "vAMM-USDC/cbXEN (Aerodrome/Base)",
};

const CHAINS = new Set(["Base", "Optimism", "Ethereum", "Arbitrum"]);

async function main() {
  console.log("Baixando yields.llama.fi/pools (pode levar alguns segundos)...");
  const res = await fetch("https://yields.llama.fi/pools");
  const body = (await res.json()) as { status: string; data: any[] };
  const all = body.data ?? [];
  console.log(`Total de pools no dataset: ${all.length.toLocaleString("pt-BR")}\n`);

  // 1) quais "projects" (slugs) da DefiLlama nos interessam?
  const rx = /aero|velo|uniswap-v3/i;
  const projects = new Map<string, number>();
  for (const p of all) {
    if (rx.test(p.project) && CHAINS.has(p.chain)) {
      projects.set(p.project, (projects.get(p.project) ?? 0) + 1);
    }
  }
  console.log("Projects relevantes (slug DefiLlama → nº de pools nas nossas redes):");
  for (const [proj, n] of [...projects.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${proj.padEnd(26)} ${n}`);
  }

  // 2) campos disponiveis num pool de exemplo (Aerodrome na Base)
  const example = all.find((p) => /aero/i.test(p.project) && p.chain === "Base");
  console.log(`\nCampos de um pool Aerodrome/Base (ex.: ${example?.symbol}):`);
  console.log("  " + Object.keys(example ?? {}).join(", "));
  console.log("\nValores de APR do exemplo:");
  for (const k of ["apy", "apyBase", "apyReward", "apyMean30d", "apyBase7d", "count", "tvlUsd", "pool", "poolMeta", "underlyingTokens", "rewardTokens"]) {
    if (example && k in example) console.log(`  ${k.padEnd(18)} ${JSON.stringify(example[k])}`);
  }

  // 3) CHAVE de casamento: algum campo bate com nossos enderecos conhecidos?
  console.log("\nProcurando a chave de casamento (nossos enderecos no dataset)...");
  for (const [addr, label] of Object.entries(KNOWN)) {
    const lc = addr.toLowerCase();
    const hit = all.find((p) =>
      Object.values(p).some((v) => {
        if (typeof v === "string") return v.toLowerCase().includes(lc);
        if (Array.isArray(v)) return v.some((x) => typeof x === "string" && x.toLowerCase().includes(lc));
        return false;
      }),
    );
    if (hit) {
      const field = Object.entries(hit).find(([, v]) =>
        (typeof v === "string" && v.toLowerCase().includes(lc)) ||
        (Array.isArray(v) && v.some((x: any) => typeof x === "string" && x.toLowerCase().includes(lc))),
      )?.[0];
      console.log(`  ✅ ${label}`);
      console.log(`     casou pelo campo "${field}" · APR=${hit.apy}% · média30d=${hit.apyMean30d}% · TVL=$${Math.round(hit.tvlUsd)}`);
    } else {
      console.log(`  ❌ ${label} — nao encontrado por endereco`);
    }
  }
}

main().catch((e) => {
  console.error("Falhou:", (e as Error).message);
  process.exit(1);
});
