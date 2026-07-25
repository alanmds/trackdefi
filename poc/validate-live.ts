/**
 * Validação de PRODUÇÃO: bate na API publicada por HTTP e verifica
 * status, cache, invariantes do DTO e a presença das posições conhecidas
 * da carteira-gabarito (validada pelo Alan contra a Aerodrome).
 *
 *   npx tsx poc/validate-live.ts https://trackdefi.app
 */

import type { PositionsResponseDTO } from "../core/service";
import { dtoInvariants, type Check } from "./validate-batch";

const BASE = (process.argv[2] ?? "https://trackdefi.app").replace(/\/$/, "");

// gabarito: carteira do Alan, conferida visualmente contra a Aerodrome (Fase 1)
const REF_WALLET = "0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC";
const REF_NFT_IDS = ["1774557", "1774608"];
const REF_V2_POOLS = [
  "0x2Ec397DafBC0E693026a981f4bca988CDD93406B", // vAMM-USDC/cbXEN
  "0xfF706958d58B9A501F2C310367bb36BEB3A281c0", // vAMM-AERO/cbXEN
];

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
        name: "as 2 concentradas conhecidas presentes (NFT 1774557/1774608)",
        ok: REF_NFT_IDS.every((id) => dto?.positions?.some((p) => p.positionId === id)),
      },
      {
        name: "os 2 pools clássicos conhecidos presentes",
        ok: REF_V2_POOLS.every((lp) => dto?.positions?.some((p) => p.poolAddress.toLowerCase() === lp.toLowerCase())),
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
