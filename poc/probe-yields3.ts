/** Por que uniswap-v3/Base nao casou por tokens? Inspeciona o formato real. */


export {}; // arquivo-script: evita colisao de escopo global no tsc
async function main() {
  console.log("baixando dataset...");
  const res = await fetch("https://yields.llama.fi/pools");
  const all = ((await res.json()) as { data: any[] }).data ?? [];

  const uniBase = all.filter((p) => p.project === "uniswap-v3" && p.chain === "Base");
  console.log(`uniswap-v3 na Base: ${uniBase.length} pools`);
  for (const p of uniBase.slice(0, 8)) {
    console.log(`  ${String(p.symbol).padEnd(18)} meta=${JSON.stringify(p.poolMeta)} underlying=${JSON.stringify(p.underlyingTokens)} apy=${p.apy?.toFixed(1)} tvl=${Math.round(p.tvlUsd)}`);
  }

  const wethusdc = uniBase.filter((p) => /WETH-USDC|USDC-WETH/.test(p.symbol ?? ""));
  console.log(`\npor SYMBOL WETH/USDC: ${wethusdc.length}`);
  for (const p of wethusdc) {
    console.log(`  ${p.symbol} meta=${JSON.stringify(p.poolMeta)} underlying=${JSON.stringify(p.underlyingTokens)} apyBase=${p.apyBase?.toFixed(2)} m30=${p.apyMean30d?.toFixed(2)} tvl=${Math.round(p.tvlUsd)} pool=${p.pool}`);
  }

  // o campo pool tem cara de uuid ou de endereco?
  const uniEth = all.filter((p) => p.project === "uniswap-v3" && p.chain === "Ethereum").slice(0, 3);
  console.log("\nuniswap-v3 na Ethereum (3 exemplos):");
  for (const p of uniEth) {
    console.log(`  ${p.symbol} meta=${JSON.stringify(p.poolMeta)} underlying=${JSON.stringify(p.underlyingTokens)} pool=${p.pool}`);
  }
}

main().catch((e) => {
  console.error("Falhou:", (e as Error).message);
  process.exit(1);
});
