/**
 * PoC — fontes de preço além da DefiLlama (27/09/2026), pedido do Alan:
 * "mostre o melhor preço que conseguir".
 *
 * Prova, por rede:
 *  1. qual `chainId` a DexScreener usa e se ela devolve preço (WETH da rede);
 *  2. nas redes da Superchain: o contrato 0x4200…0006 é o WETH-padrão
 *     (predeploy do OP Stack: nome "Wrapped Ether", 18 casas) — condição para
 *     tratar WETH = ETH, que é trocável 1 por 1 por construção.
 *
 * Uso: npx tsx poc/probe-precos-alternativos.ts
 */

import { createPublicClient, erc20Abi, fallback, http, type Address } from "viem";
import { CHAINS } from "../core/chains";

const OP_WETH: Address = "0x4200000000000000000000000000000000000006";
/** WETH de cada rede fora do padrão OP Stack */
const WETH_FORA: Record<number, Address> = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
};
/** candidatos de chainId da DexScreener por rede (o primeiro que responder vale) */
const SLUGS: Record<number, string[]> = {
  8453: ["base"], 10: ["optimism"], 1: ["ethereum"], 42161: ["arbitrum"], 46630: ["robinhood"], 4663: ["robinhood"],
  130: ["unichain"], 57073: ["ink"], 34443: ["mode"], 1868: ["soneium"], 252: ["fraxtal"],
  1135: ["lisk"], 1923: ["swellchain", "swell"], 1750: ["metal", "metall2"], 5330: ["superseed"], 42220: ["celo"],
};

const eth = await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum").then((r) => r.json());
const ethUsd = eth.coins["coingecko:ethereum"].price as number;
console.log(`ETH (DefiLlama, coingecko:ethereum) = US$ ${ethUsd}\n`);

for (const [idStr, info] of Object.entries(CHAINS)) {
  const id = Number(idStr);
  const weth = WETH_FORA[id] ?? OP_WETH;
  const client = createPublicClient({ chain: info.chain, transport: fallback(info.defaultRpcs.map((u) => http(u, { timeout: 20_000 }))) });
  let nome = "?", dec = 0;
  try {
    [nome, dec] = (await Promise.all([
      client.readContract({ address: weth, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: weth, abi: erc20Abi, functionName: "decimals" }),
    ])) as [string, number];
  } catch {
    nome = "(sem contrato)";
  }
  let dex = "—";
  for (const s of SLUGS[id] ?? []) {
    const pares = await fetch(`https://api.dexscreener.com/tokens/v1/${s}/${weth}`).then((r) => r.json()).catch(() => []);
    if (Array.isArray(pares) && pares.length) {
      const top = pares.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      const usd = top.baseToken.address.toLowerCase() === weth.toLowerCase() ? Number(top.priceUsd) : Number(top.priceUsd) / Number(top.priceNative);
      dex = `${s}: WETH US$ ${usd.toFixed(2)} (${pares.length} pares, liquidez US$ ${Math.round(top.liquidity?.usd ?? 0).toLocaleString("en-US")})`;
      break;
    }
  }
  const padrao = weth === OP_WETH && nome === "Wrapped Ether" && dec === 18;
  console.log(`${info.label.padEnd(16)} WETH ${weth.slice(0, 8)}… "${nome}" ${dec} casas${padrao ? " · ✅ WETH-padrão OP Stack" : ""} · DexScreener ${dex}`);
}
