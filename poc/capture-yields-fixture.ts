/**
 * Congela um subconjunto REAL do dataset da DefiLlama para os testes da
 * Receita C (o dado vivo muda a cada hora; testes precisam de foto estável).
 *
 *   npx tsx poc/capture-yields-fixture.ts
 */

import { writeFileSync } from "node:fs";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const WETH = "0x4200000000000000000000000000000000000006".toLowerCase();
const CBBTC = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf".toLowerCase();
// Ethereum mainnet (a DefiLlama NAO cobre uniswap-v3 na Base — achado 14/07)
const USDC_ETH = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH_ETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
// Optimism — ATENCAO: no dataset a chain se chama "OP Mainnet", nao
// "Optimism" (foi isso que escondeu a Velodrome no PoC de 14/07)
const USDC_OP = "0x0b2c639c533813f4aa9d7837caf62653d097ff85"; // USDC nativo
const USDCE_OP = "0x7f5c764cbc14f9669b88837ca1490cca17c31607"; // USDC.e (bridged)

function hasTokens(p: any, a: string, b: string): boolean {
  const ut = (p.underlyingTokens ?? []).map((x: string) => (x ?? "").toLowerCase());
  return ut.length === 2 && ut.includes(a) && ut.includes(b);
}

const KEEP = [
  "chain", "project", "symbol", "tvlUsd", "apy", "apyBase", "apyReward",
  "apyMean30d", "count", "poolMeta", "underlyingTokens", "pool",
];

function slim(p: any) {
  const out: any = {};
  for (const k of KEEP) out[k] = p[k] ?? null;
  return out;
}

async function main() {
  const res = await fetch("https://yields.llama.fi/pools");
  const all = ((await res.json()) as { data: any[] }).data ?? [];

  const aeroWethUsdc = all.filter((p) => p.chain === "Base" && /^aerodrome/.test(p.project) && hasTokens(p, WETH, USDC));
  const aeroUsdcCbbtc = all.filter((p) => p.chain === "Base" && /^aerodrome/.test(p.project) && hasTokens(p, USDC, CBBTC));
  const uniEthWethUsdc = all.filter((p) => p.chain === "Ethereum" && p.project === "uniswap-v3" && hasTokens(p, WETH_ETH, USDC_ETH));
  const veloOptimism = all.filter((p) => /^velodrome/.test(p.project) && p.chain === "OP Mainnet");
  const veloOpWethUsdc = veloOptimism.filter((p) => hasTokens(p, WETH, USDC_OP) || hasTokens(p, WETH, USDCE_OP));

  // cobertura da uniswap-v3 por rede (evidencia da lacuna da Base)
  const uniPerChain: Record<string, number> = {};
  for (const p of all) if (p.project === "uniswap-v3") uniPerChain[p.chain] = (uniPerChain[p.chain] ?? 0) + 1;

  const fixture = {
    capturedAt: new Date().toISOString(),
    note: "subconjunto real de yields.llama.fi/pools para testes de casamento",
    aeroWethUsdc: aeroWethUsdc.map(slim),
    aeroUsdcCbbtc: aeroUsdcCbbtc.map(slim),
    uniEthWethUsdc: uniEthWethUsdc.map(slim),
    veloOpWethUsdc: veloOpWethUsdc.map(slim),
    veloOptimismCount: veloOptimism.length,
    uniswapPoolsPerChain: uniPerChain,
  };

  writeFileSync("tests/fixtures/yields-fixture.json", JSON.stringify(fixture, null, 2));
  console.log(`aeroWethUsdc: ${aeroWethUsdc.length} | aeroUsdcCbbtc: ${aeroUsdcCbbtc.length} | uniEthWethUsdc: ${uniEthWethUsdc.length} | veloOP: ${veloOptimism.length}`);
  console.log("uniswap-v3 por rede:", JSON.stringify(uniPerChain));
  console.log("\nFixture salvo em tests/fixtures/yields-fixture.json");
}

main().catch((e) => {
  console.error("Falhou:", (e as Error).message);
  process.exit(1);
});
