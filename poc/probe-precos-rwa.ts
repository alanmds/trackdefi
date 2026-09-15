/**
 * PoC — as ações tokenizadas (RWA) da Robinhood Chain têm preço?
 * Sem preço, o valor da posição é null e o fee APR nem pode ser calculado
 * (o denominador é o valor em US$). Endereços tirados do dataset da
 * DefiLlama em 15/09/2026.
 *
 * Uso: npx tsx poc/probe-precos-rwa.ts
 */
import type { Address } from "viem";
import { defillamaPrices } from "../core/prices/defillama";
import { CHAINS } from "../core/chains";

const TOKENS: Array<[string, string]> = [
  ["USDG (stable)", "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"],
  ["HIMS", "0xCceE82fE024c36fA15E1005edE3E9e4787e23D09"],
  ["AAPL", "0xaf3d76f1834a1d425780943c99ea8a608f8a93f9"],
  ["TSLA", "0x322f0929c4625ed5bad873c95208d54e1c003b2d"],
  ["SPY", "0x117cc2133c37b721f49de2a7a74833232b3b4c0c"],
  ["NVDA", "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec"],
  ["GME", "0x1b0e319c6a659f002271b69db8a7df2f911c153e"],
  ["SGOV", "0x92fd66527192e3e61d4ddd13322aa222de86f9b5"],
  ["COST", "0x4ea005168d7f09a7a0ba9d1def21a479950e44c2"],
  ["SNDK", "0xb90a19ff0af67f7779aff50a882a9cff42446400"],
  ["WETH", "0x0bd7d308f8e1639fab988df18a8011f41eacad73"],
];

async function main() {
  const slug = CHAINS[4663].priceSlug;
  const precos = await defillamaPrices.fetchUsdPrices(slug, TOKENS.map(([, a]) => a as Address), (m) => console.log("aviso:", m));
  let com = 0;
  for (const [nome, addr] of TOKENS) {
    const p = precos.get(addr.toLowerCase());
    if (p !== undefined) com++;
    console.log(`  ${nome.padEnd(16)} ${p === undefined ? "SEM PREÇO → posição mostra —" : "US$ " + p}`);
  }
  console.log(`\n  ${com}/${TOKENS.length} tokens RWA com preço na DefiLlama (slug "${slug}")`);
}
main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
