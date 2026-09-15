/**
 * trackdefi — CLI de verificação: roda o MESMO caminho da API de produção
 * (todos os protocolos do registry, agregados) e imprime o DTO.
 *
 * Uso:
 *   npm run poc -- 0xENDERECO            # imprime as posições (todos os protocolos)
 *   npm run poc -- 0xENDERECO --json     # também salva fixture cru da Aerodrome
 */

import { writeFileSync } from "node:fs";
import { getAddress, isAddress } from "viem";
import { createBaseReader } from "../core/chain";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { CHAINS } from "../core/chains";
import { getWalletPositions, type PositionDTO } from "../core/service";

function usd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 1) return n.toLocaleString("pt-BR", { maximumSignificantDigits: 4 });
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function price(n: number): string {
  return n.toLocaleString("pt-BR", { maximumSignificantDigits: 6 });
}

function kindLabel(p: PositionDTO): string {
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

  console.log(`\ntrackdefi — caminho completo de produção (todas as redes)`);
  console.log(`Carteira: ${account}\n`);
  console.log("Varrendo todos os protocolos/redes do registry...");

  const dto = await getWalletPositions(account);
  console.log(
    `Concluído em ${(dto.scanMs / 1000).toFixed(1)} s — ${dto.totalPositions} posição(ões) [${dto.protocols.join(", ")}] em [${dto.chains.join(", ")}]\n`,
  );
  for (const w of dto.warnings) console.warn(`  aviso: ${w}`);

  if (dto.totalPositions === 0) {
    console.log("Nenhuma posição de liquidez encontrada para esta carteira.");
    return;
  }

  dto.positions.forEach((p, i) => {
    const chain = CHAINS[p.chainId]?.label ?? p.chainId;
    console.log(`── Posição ${i + 1}: ${p.poolSymbol} [${p.protocol} · ${chain}]${p.positionId ? ` (NFT #${p.positionId})` : ""}`);
    console.log(
      `   Tipo: ${kindLabel(p)}${p.staked ? " · EM STAKE no gauge" : ""}${p.managedByAlm ? " · via ALM" : ""}`,
    );
    console.log(
      `   ${p.token0.symbol}: ${amt(p.token0.amount)}   ${p.token1.symbol}: ${amt(p.token1.amount)}   Valor: ${usd(p.valueUsd)}`,
    );
    if (p.range) {
      console.log(
        `   Faixa: ${price(p.range.lower)} – ${price(p.range.upper)} ${p.range.quoteLabel} → ${p.range.inRange ? "✅ NA FAIXA" : "⚠️ FORA DA FAIXA"}`,
      );
    }
    /* "Rendendo agora" é o número que o SITE mostra em destaque (Receita C2).
       Ficou anos fora daqui, e foi por isso que a investigação de 15/09/2026
       começou achando que a posição RWA não tinha APR nenhum: o CLI só
       imprimia o APR do pool (DefiLlama), que naquele caso é mesmo null. */
    if (p.earning && p.earning.windows.length > 0) {
      // uma linha por janela medida, igual à tela (24 h e 15 min)
      console.log(`   Rendendo agora:`);
      for (const w of p.earning.windows) {
        const rotulo = w.windowSec < 3600 ? `${Math.round(w.windowSec / 60)} min` : `${Math.round(w.windowSec / 3600)} h`;
        console.log(
          `     ${rotulo.padStart(6)}  ${w.feePct.toFixed(2).padStart(10)}% a.a.  ·  US$ ${w.feeUsd.toFixed(w.feeUsd < 0.01 ? 6 : 2)} em taxas`,
        );
      }
      if (p.earning.emissionPct !== null) {
        console.log(`     ${"emiss".padStart(6)}  ${p.earning.emissionPct.toFixed(2).padStart(10)}% a.a.  ·  taxa corrente do gauge`);
      }
    } else if (p.earning?.tooNew) {
      console.log(`   Rendendo agora: — (posição recém-aberta; primeira leitura em ~15 min)`);
    } else if (p.earning) {
      const e = p.earning;
      const partes = [
        `taxas ${e.feePct === null ? "—" : e.feePct.toFixed(2) + "%"}`,
        `emissões ${e.emissionPct === null ? "—" : e.emissionPct.toFixed(2) + "%"}`,
      ];
      console.log(`   Rendendo agora: ${e.nowPct.toFixed(2)}% a.a. (${partes.join(" + ")})`);
    } else if (p.range) {
      console.log(`   Rendendo agora: — (sem dado confiável)`);
    }
    if (p.apr) {
      console.log(
        `   APR do pool: ${p.apr.current.toFixed(2)}% a.a. (taxas ${p.apr.base?.toFixed(2) ?? "—"}% + emissões ${p.apr.reward?.toFixed(2) ?? "—"}%) · média 30d ${p.apr.mean30d?.toFixed(2) ?? "—"}% · ${p.apr.source}`,
      );
    }
    if (p.rewards.length > 0) {
      const parts = p.rewards.map(
        (r) => `${amt(r.amount)} ${r.symbol}${r.kind === "emission" ? " (emissões)" : ""}`,
      );
      console.log(`   A receber: ${parts.join(" + ")} ≈ ${usd(p.rewardsUsd)}`);
    }
    console.log("");
  });

  console.log(`══════════════════════════════════════════════`);
  console.log(
    `TOTAL em pools:   ${usd(dto.totals.valueUsd)}${dto.totals.positionsWithoutPrice ? `  (+ ${dto.totals.positionsWithoutPrice} sem preço)` : ""}`,
  );
  console.log(`TOTAL a receber:  ${usd(dto.totals.rewardsUsd)}`);
  console.log(`Conferir: https://trackdefi.app/w/${account}\n`);

  if (wantJson) {
    const adapter = new AerodromeAdapter(createBaseReader());
    const raw = await adapter.fetchRawPositions(account);
    const file = `poc/fixture-${account.slice(0, 10)}.json`;
    writeFileSync(
      file,
      JSON.stringify(
        { account, capturedAt: new Date().toISOString(), positions: raw },
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2,
      ),
    );
    console.log(`Fixture cru (Aerodrome) salvo em ${file}.`);
  }
}

main().catch((e) => {
  console.error(`\nErro: ${(e as Error).message}`);
  process.exit(1);
});
