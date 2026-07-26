/**
 * Validação de PRODUÇÃO: bate na API publicada por HTTP e verifica
 * status, cache, invariantes do DTO e a cobertura da carteira-gabarito.
 *
 *   npx tsx poc/validate-live.ts https://trackdefi.app
 */

import type { PositionsResponseDTO } from "../core/service";
import { dtoInvariants, type Check } from "./validate-batch";

const BASE = (process.argv[2] ?? "https://trackdefi.app").replace(/\/$/, "");

/**
 * Carteira-gabarito: a carteira de teste do próprio repo `sugar`, que é também
 * a carteira demo da landing.
 *
 * Trocada em 25/07/2026. Antes era a carteira do Alan, com dois NFTs fixados
 * pelo id — e ela envelheceu: ele retirou a posição `1774608`, o teste passou
 * a falhar e a falha PARECIA bug do site. Um gabarito que quebra quando o dono
 * mexe no próprio dinheiro é um alarme que a gente aprende a ignorar.
 *
 * Esta é de terceiro (ninguém aqui mexe nela) e cobre mais: 2 protocolos,
 * 2 redes, clássicas e concentradas, em stake e fora, e posições sem preço.
 */
const REF_WALLET = "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";

/**
 * O que se cobra dela é COBERTURA, não ids específicos: mesmo carteira de
 * terceiro pode fechar uma posição qualquer dia, e o valor deste teste está em
 * provar que a varredura ainda enxerga cada CLASSE de posição — que é o que
 * quebra de verdade quando um adapter regride. As contas exatas continuam
 * cobertas pelas invariantes do DTO e pelo `validate-batch`.
 */
const MIN_POSITIONS = 8;

async function hit(path: string) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`);
  const ms = Date.now() - t0;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* respostas não-JSON caem nas checagens de status */
  }
  return { status: res.status, ms, cache: res.headers.get("x-cache"), fixture: res.headers.get("x-fixture"), body };
}

function report(checks: Check[]): boolean {
  let ok = true;
  for (const c of checks) {
    if (!c.ok) ok = false;
    console.log(`   ${c.ok ? "✅" : "❌"} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ""}`);
  }
  return ok;
}

async function main() {
  console.log(`Validação de produção: ${BASE}\n`);
  let allOk = true;

  console.log(`━━ carteira-gabarito ${REF_WALLET.slice(0, 10)}…`);
  const a = await hit(`/api/positions?address=${REF_WALLET}`);
  const dto = a.body as PositionsResponseDTO;
  allOk =
    report([
      { name: `HTTP 200 (veio ${a.status} em ${a.ms} ms)`, ok: a.status === 200 },
      { name: "modo fixture DESLIGADO em produção", ok: a.fixture === null },
      { name: `scan no servidor: ${dto?.scanMs} ms`, ok: typeof dto?.scanMs === "number" && dto.scanMs < 50_000 },
      {
        name: `pelo menos ${MIN_POSITIONS} posições (vieram ${dto?.positions?.length ?? 0})`,
        ok: (dto?.positions?.length ?? 0) >= MIN_POSITIONS,
      },
      {
        name: "concentradas presentes, com id de NFT",
        ok: !!dto?.positions?.some((p) => p.kind === "concentrated" && !!p.positionId),
      },
      {
        name: "clássicas (v2) presentes",
        ok: !!dto?.positions?.some((p) => p.kind === "v2-volatile" || p.kind === "v2-stable"),
      },
      {
        name: "posições EM STAKE presentes (o diferencial do produto)",
        ok: !!dto?.positions?.some((p) => p.staked),
      },
      {
        name: "os 2 protocolos do ecossistema Sugar presentes (aerodrome + velodrome)",
        ok: ["aerodrome", "velodrome"].every((x) => dto?.positions?.some((p) => p.protocol === x)),
        detail: `veio ${[...new Set(dto?.positions?.map((p) => p.protocol) ?? [])].join(", ") || "nada"}`,
      },
      {
        name: "as 2 redes da carteira presentes (Base 8453 + Optimism 10)",
        ok: [8453, 10].every((id) => dto?.positions?.some((p) => p.chainId === id)),
        detail: `veio ${[...new Set(dto?.positions?.map((p) => p.chainId) ?? [])].join(", ") || "nada"}`,
      },
      {
        name: "totais plausíveis (US$ 50–5.000, recompensas ≥ 0)",
        ok: dto?.totals?.valueUsd > 50 && dto?.totals?.valueUsd < 5000 && dto?.totals?.rewardsUsd >= 0,
      },
    ]) && allOk;
  if (dto?.positions) allOk = report(dtoInvariants(dto)) && allOk;

  console.log(`━━ cache`);
  const b = await hit(`/api/positions?address=${REF_WALLET}`);
  allOk =
    report([
      {
        name: `2ª chamada é HIT instantâneo (veio ${b.cache} em ${b.ms} ms)`,
        ok: b.status === 200 && b.cache === "HIT" && b.ms < 3000,
      },
    ]) && allOk;

  console.log(`━━ erros`);
  const inv = await hit(`/api/positions?address=lixo`);
  const missing = await hit(`/api/positions`);
  allOk =
    report([
      { name: `endereço inválido → 400 (veio ${inv.status})`, ok: inv.status === 400 },
      { name: `sem parâmetro → 400 (veio ${missing.status})`, ok: missing.status === 400 },
    ]) && allOk;

  console.log(`\n${allOk ? "✅ PRODUÇÃO VALIDADA" : "❌ DIVERGÊNCIAS ENCONTRADAS"}`);
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
