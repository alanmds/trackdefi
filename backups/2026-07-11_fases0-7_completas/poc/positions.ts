/**
 * trackdefi — CLI de verificação (agora uma casca fina sobre o core/).
 *
 * Lê TODAS as posições de liquidez de uma carteira na Aerodrome (rede Base).
 * Sem chaves, sem login — somente leitura.
 *
 * Uso:
 *   npm run poc -- 0xENDERECO            # imprime as posições
 *   npm run poc -- 0xENDERECO --json     # também salva poc/fixture-<addr>.json
 */

import { writeFileSync } from "node:fs";
import { createPublicClient, fallback, formatUnits, getAddress, http, isAddress } from "viem";
import { base } from "viem/chains";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { CHAIN_SLUG } from "../core/adapters/aerodrome/config";
import { orientRange } from "../core/math/ticks";
import { fetchUsdPrices } from "../core/prices/defillama";
import type { ChainReader, LpPosition } from "../core/types";

const RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.llamarpc.com",
];

function fmt(raw: bigint, decimals: number, digits = 6): string {
  const n = Number(formatUnits(raw, decimals));
  return n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

function usd(n: number | undefined): string {
  if (n === undefined) return "—";
  return "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function kindLabel(p: LpPosition): string {
  if (p.kind === "concentrated") return "concentrada";
  return p.kind === "v2-stable" ? "clássica estável" : "clássica volátil";
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  const wantJson = process.argv.includes("--json");
  const input = args[0] ?? "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";
  if (!isAddress(input)) {
    console.error(`Endereço inválido: ${input}`);
    process.exit(1);
  }
  const account = getAddress(input);

  console.log(`\ntrackdefi — Aerodrome @ Base`);
  console.log(`Carteira: ${account}\n`);

  const client = createPublicClient({
    chain: base,
    transport: fallback(RPCS.map((url) => http(url, { timeout: 30_000 }))),
  });
  const adapter = new AerodromeAdapter(client as unknown as ChainReader, {
    onWarn: (m) => console.warn(`  aviso: ${m}`),
  });

  console.log("Varrendo posições (janelas em paralelo)...");
  const t0 = Date.now();
  const raw = await adapter.fetchRawPositions(account);
  const scanSecs = ((Date.now() - t0) / 1000).toFixed(1);
  const positions = await adapter.normalize(raw);
  console.log(`Varredura concluída em ${scanSecs} s — ${positions.length} posição(ões).\n`);

  if (positions.length === 0) {
    console.log("Nenhuma posição de liquidez encontrada na Aerodrome para esta carteira.");
    return;
  }

  const tokenAddrs = positions.flatMap((p) => [
    p.token0.address,
    p.token1.address,
    ...p.rewards.map((r) => r.token.address),
  ]);
  const prices = await fetchUsdPrices(CHAIN_SLUG, tokenAddrs, (m) => console.warn(`  aviso: ${m}`));
  const priceOf = (addr: string) => prices.get(addr.toLowerCase());
  const valUsd = (raw: bigint, token: { address: string; decimals: number }): number | undefined => {
    const p = priceOf(token.address);
    return p === undefined ? undefined : Number(formatUnits(raw, token.decimals)) * p;
  };

  let totalUsd = 0;
  let totalRewardsUsd = 0;
  let missingPrices = 0;

  positions.forEach((p, i) => {
    const v0 = valUsd(p.amount0Raw, p.token0);
    const v1 = valUsd(p.amount1Raw, p.token1);
    const value = v0 !== undefined && v1 !== undefined ? v0 + v1 : undefined;
    if (value !== undefined) totalUsd += value;
    else missingPrices++;

    const badges = [
      p.kind === "concentrated" ? `concentrada, id NFT #${p.positionId}` : "clássica",
    ];
    console.log(`── Posição ${i + 1}: ${p.poolSymbol} (${badges.join(", ")})`);
    console.log(
      `   Tipo: ${kindLabel(p)}${p.staked ? " · EM STAKE no gauge" : ""}${p.managedByAlm ? " · via ALM (gestor automático)" : ""}`,
    );
    console.log(
      `   ${p.token0.symbol}: ${fmt(p.amount0Raw, p.token0.decimals)}   ${p.token1.symbol}: ${fmt(p.amount1Raw, p.token1.decimals)}   Valor: ${usd(value)}`,
    );

    if (p.range) {
      const o = orientRange(p.range.priceLower, p.range.priceUpper, p.range.priceCurrent);
      const pair = o.inverted
        ? `${p.token0.symbol}/${p.token1.symbol}`
        : `${p.token1.symbol}/${p.token0.symbol}`;
      const f = (n: number) => n.toLocaleString("pt-BR", { maximumSignificantDigits: 6 });
      console.log(
        `   Faixa: ${f(o.lower)} – ${f(o.upper)} ${pair} → ${p.range.inRange ? "✅ NA FAIXA" : "⚠️ FORA DA FAIXA"}`,
      );
    }

    if (p.rewards.length > 0) {
      const parts: string[] = [];
      let rewUsd = 0;
      let complete = true;
      for (const r of p.rewards) {
        parts.push(`${fmt(r.raw, r.token.decimals)} ${r.token.symbol}${r.kind === "emission" ? " (emissões)" : ""}`);
        const v = valUsd(r.raw, r.token);
        if (v === undefined) complete = false;
        else rewUsd += v;
      }
      console.log(`   A receber: ${parts.join(" + ")} ≈ ${complete ? usd(rewUsd) : "—"}`);
      if (complete) totalRewardsUsd += rewUsd;
    }
    console.log("");
  });

  console.log(`══════════════════════════════════════════════`);
  console.log(`TOTAL em pools:   ${usd(totalUsd)}${missingPrices ? `  (+ ${missingPrices} posição(ões) sem preço)` : ""}`);
  console.log(`TOTAL a receber:  ${usd(totalRewardsUsd)}`);
  console.log(`Conferir em: https://aerodrome.finance/dash?account=${account}\n`);

  if (wantJson) {
    const file = `poc/fixture-${account.slice(0, 10)}.json`;
    writeFileSync(
      file,
      JSON.stringify(
        { account, capturedAt: new Date().toISOString(), positions: raw },
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2,
      ),
    );
    console.log(`Fixture salvo em ${file} (posições cruas, para testes).`);
  }
}

main().catch((e) => {
  console.error(`\nErro: ${(e as Error).message}`);
  process.exit(1);
});
