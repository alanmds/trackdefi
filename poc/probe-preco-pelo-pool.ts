/**
 * PoC — preço de token tirado do PRÓPRIO pool da posição, quando a DefiLlama
 * não tem preço (item 1 da fila de 27/09/2026).
 *
 * Regra do Alan (27/09): se o pool estiver distorcido, mostrar o preço COMO
 * ESTÁ NO POOL — esconder ou "corrigir" seria desinformação.
 *
 * Como o preço sai, sem nenhuma leitura extra na blockchain:
 *  - concentrada: `range.priceCurrent` (token1 por 1 token0, no tick atual);
 *  - clássica VOLÁTIL: a proporção das quantidades da posição É a proporção
 *    das reservas do pool (x·y=k), logo preço0em1 = qtd1 / qtd0;
 *  - clássica ESTÁVEL: a curva não é x·y=k — a proporção NÃO é o preço. Fica
 *    de fora (continua "—").
 * Preço em US$ = preço do outro token (DefiLlama) × preço do pool.
 *
 * Contraprova: DexScreener (fonte independente, par mais líquido do token).
 *
 * Uso: npx tsx poc/probe-preco-pelo-pool.ts [carteira]   (padrão: gabarito do validate-live)
 */

import type { Address } from "viem";
import { getWalletPositions } from "../core/service";

const CARTEIRA = (process.argv[2] ?? "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac") as Address;
const CHAIN_DEX: Record<number, string> = {
  8453: "base", 10: "optimism", 1: "ethereum", 42161: "arbitrum",
  34443: "mode", 57073: "ink", 130: "unichain", 1868: "soneium", 252: "fraxtal",
};

async function dexscreener(chainId: number, token: string): Promise<{ usd: number; liq: number } | null> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`).then((x) => x.json()).catch(() => null);
  const pares = (r?.pairs ?? []).filter((p: { chainId: string }) => p.chainId === CHAIN_DEX[chainId]);
  if (!pares.length) return null;
  pares.sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  return { usd: Number(pares[0].priceUsd), liq: pares[0].liquidity?.usd ?? 0 };
}

const dto = await getWalletPositions(CARTEIRA);
console.log(`${dto.positions.length} posições; sem preço hoje: ${dto.totals.positionsWithoutPrice}\n`);

for (const p of dto.positions) {
  const [t0, t1] = [p.token0, p.token1];
  const semPreco0 = t0.priceUsd === null;
  const semPreco1 = t1.priceUsd === null;
  if (semPreco0 === semPreco1) continue; // os dois com preço, ou os dois sem: nada a derivar

  let preco0em1: number | null = null;
  let como = "";
  if (p.kind === "concentrated" && p.range) {
    // o DTO já orienta a faixa para leitura; o preço cru do pool é o de token1 por token0
    preco0em1 = p.range.inverted ? 1 / p.range.current : p.range.current;
    como = "tick atual";
  } else if (p.kind === "v2-volatile" && t0.amount > 0 && t1.amount > 0) {
    preco0em1 = t1.amount / t0.amount;
    como = "reservas (volátil)";
  } else {
    console.log(`  ${p.poolSymbol}: ${p.kind} — fora do escopo (${p.kind === "v2-stable" ? "curva estável" : "sem quantidade"})`);
    continue;
  }

  const alvo = semPreco0 ? t0 : t1;
  const usd = semPreco0 ? t1.priceUsd! * preco0em1 : t0.priceUsd! / preco0em1;
  const ref = await dexscreener(p.chainId, alvo.address);
  const dif = ref ? ((usd / ref.usd - 1) * 100).toFixed(1) + "%" : "—";
  console.log(
    `  ${p.poolSymbol} (rede ${p.chainId}, ${como}): ${alvo.symbol} = US$ ${usd.toPrecision(5)}` +
      ` · DexScreener ${ref ? `US$ ${ref.usd.toPrecision(5)} (liquidez US$ ${Math.round(ref.liq).toLocaleString("en-US")})` : "sem par"} · diferença ${dif}` +
      ` · posição passaria a valer US$ ${(t0.amount * (semPreco0 ? usd : t0.priceUsd!) + t1.amount * (semPreco1 ? usd : t1.priceUsd!)).toFixed(2)}`,
  );
}
