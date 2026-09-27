/**
 * Bateria da Fase 5: valida N carteiras reais de ponta a ponta.
 *
 * Para cada carteira:
 *  1. roda o pipeline completo (adapter → preços → DTO);
 *  2. checa INVARIANTES do DTO (totais = soma das partes, faixa só em
 *     concentradas, nada de NaN/negativo, contagem de sem-preço);
 *  3. CONTRAPROVA independente: para posições concentradas, recalcula
 *     amount0/amount1 com a nossa matemática Q96 (core/math/liquidity) a
 *     partir de liquidity+staked e do slot0 lido DIRETO do pool — e compara
 *     com o que o Sugar reportou (tolerância p/ deriva entre blocos).
 *
 *   npx tsx poc/validate-batch.ts 0xA... 0xB... (sem args usa a lista padrão)
 */

import { createPublicClient, fallback, http, isAddress, getAddress, parseAbi, type Address } from "viem";
import { base } from "viem/chains";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { amountsForLiquidity } from "../core/math/liquidity";
import { buildResponse, type PositionsResponseDTO } from "../core/service";
import { fetchUsdPrices } from "../core/prices/defillama";
import { CHAIN_SLUG } from "../core/adapters/aerodrome/config";
import type { ChainReader } from "../core/types";
import { ABSURD_APR_PCT } from "../core/yields/onchain";
import { MAX_SANE_EARNING } from "../core/yields/positionApr";

const DEFAULT_WALLETS: Address[] = [
  "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac", // demo (v2 staked + CL fora de stake)
  "0x0000000000000000000000000000000000000001", // vazia (fluxo de zero posições)
];

const slot0Abi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 a, uint16 b, uint16 c, bool d)",
]);

const client = createPublicClient({
  chain: base,
  transport: fallback(
    ["https://mainnet.base.org", "https://base-rpc.publicnode.com"].map((u) => http(u, { timeout: 30_000 })),
  ),
});

export type Check = { name: string; ok: boolean; detail?: string };

function approxEqual(a: bigint, b: bigint, tolPct: number, absEps: bigint): boolean {
  const diff = a > b ? a - b : b - a;
  if (diff <= absEps) return true;
  const ref = a > b ? a : b;
  return diff * 10000n <= ref * BigInt(Math.round(tolPct * 100));
}

export function dtoInvariants(dto: PositionsResponseDTO): Check[] {
  const checks: Check[] = [];
  let sumValue = 0;
  let sumRewards = 0;
  let rewardsWithoutPrice = 0;
  let withoutPrice = 0;
  let issues: string[] = [];

  for (const p of dto.positions) {
    if (p.valueUsd !== null) sumValue += p.valueUsd;
    else withoutPrice++;
    /* item a item desde 26/09/2026: um token sem preço não apaga mais o resto
       do card no total (antes somava p.rewardsUsd, que é null nesse caso) */
    for (const r of p.rewards) {
      if (r.valueUsd !== null) sumRewards += r.valueUsd;
      else rewardsWithoutPrice++;
    }

    if (p.kind === "concentrated" && !p.range) issues.push(`${p.poolSymbol}: concentrada sem range`);
    if (p.kind !== "concentrated" && p.range) issues.push(`${p.poolSymbol}: clássica com range`);
    if (p.kind === "concentrated" && !p.positionId) issues.push(`${p.poolSymbol}: concentrada sem NFT id`);
    if (p.token0.amount < 0 || p.token1.amount < 0) issues.push(`${p.poolSymbol}: quantidade negativa`);
    for (const v of [p.valueUsd, p.rewardsUsd, p.token0.amount, p.token1.amount]) {
      if (v !== null && !Number.isFinite(v)) issues.push(`${p.poolSymbol}: número não-finito`);
    }
    if (p.range) {
      if (p.range.lower > p.range.upper) issues.push(`${p.poolSymbol}: faixa invertida (lower > upper)`);
      const inside = p.range.current >= p.range.lower && p.range.current < p.range.upper;
      if (inside !== p.range.inRange) issues.push(`${p.poolSymbol}: inRange inconsistente com preços exibidos`);
    }
    if (p.apr) {
      // Receita C: APR exibido tem que passar nos guardas de sanidade
      if (!(p.apr.current >= 0 && p.apr.current <= 1000)) issues.push(`${p.poolSymbol}: APR fora do teto (${p.apr.current}%)`);
      if (p.apr.mean30d !== null && !Number.isFinite(p.apr.mean30d)) issues.push(`${p.poolSymbol}: média 30d não-finita`);
    }
    if (p.earning) {
      /* Receita C2 + G v2. Desde 15/09/2026 as TAXAS MEDIDAS não têm teto de
         plausibilidade (decisão do Alan: rendimento real de 2.000% aparece como
         2.000%) — só a barreira de absurdo aritmético. Emissões seguem com o
         teto de 1.000%. Cobrar 1.000% no total aqui reprovaria a produção
         justamente no caso que a mudança quis mostrar. */
      const teto = ABSURD_APR_PCT + MAX_SANE_EARNING;
      if (!(p.earning.nowPct >= 0 && p.earning.nowPct <= teto)) issues.push(`${p.poolSymbol}: earning fora da barreira (${p.earning.nowPct}%)`);
      for (const w of p.earning.windows ?? []) {
        if (!(Number.isFinite(w.feePct) && w.feePct >= 0 && w.feePct <= ABSURD_APR_PCT)) issues.push(`${p.poolSymbol}: janela ${w.windowSec}s com % inválido`);
        if (!(Number.isFinite(w.feeUsd) && w.feeUsd >= 0)) issues.push(`${p.poolSymbol}: janela ${w.windowSec}s com US$ inválido`);
      }
      for (const c of [p.earning.feePct, p.earning.emissionPct]) {
        if (c !== null && !Number.isFinite(c)) issues.push(`${p.poolSymbol}: componente de earning não-finito`);
      }
      if (p.range && !p.range.inRange && p.earning.nowPct !== 0) issues.push(`${p.poolSymbol}: fora do range mas earning ≠ 0`);
    }
  }

  // locks (25/09/2026): as recompensas deles entram no total a receber, e o
  // valor travado tem total próprio, separado do total em pools
  const locks = dto.locks ?? [];
  let sumLocked = 0;
  for (const l of locks) {
    if (l.valueUsd !== null) sumLocked += l.valueUsd;
    for (const r of l.rewards) {
      if (r.valueUsd !== null) sumRewards += r.valueUsd;
      else rewardsWithoutPrice++;
    }
    for (const v of [l.valueUsd, l.rewardsUsd, l.token.amount, l.votingPower]) {
      if (v !== null && !Number.isFinite(v)) issues.push(`lock #${l.lockId}: número não-finito`);
    }
    if (l.token.amount < 0 || l.votingPower < 0) issues.push(`lock #${l.lockId}: quantidade negativa`);
    if (l.permanent && l.expired) issues.push(`lock #${l.lockId}: permanente marcado como vencido`);
  }

  const truncated = dto.totalPositions > dto.positions.length;
  checks.push({
    name: truncated ? "totals.valueUsd ≥ soma das posições exibidas (resposta cortada)" : "totals.valueUsd = soma das posições",
    ok: truncated ? dto.totals.valueUsd >= sumValue - 0.01 : Math.abs(sumValue - dto.totals.valueUsd) < 0.01,
    detail: `${sumValue.toFixed(2)} vs ${dto.totals.valueUsd.toFixed(2)}`,
  });
  checks.push({
    name: truncated ? "totals.rewardsUsd ≥ soma exibida (resposta cortada)" : "totals.rewardsUsd = soma das posições + locks",
    ok: truncated ? dto.totals.rewardsUsd >= sumRewards - 0.01 : Math.abs(sumRewards - dto.totals.rewardsUsd) < 0.01,
    detail: `${sumRewards.toFixed(2)} vs ${dto.totals.rewardsUsd.toFixed(2)}`,
  });
  if (!truncated && dto.totals.rewardsWithoutPrice !== undefined) {
    checks.push({
      name: "totals.rewardsWithoutPrice = recompensas sem preço",
      ok: dto.totals.rewardsWithoutPrice === rewardsWithoutPrice,
      detail: `${rewardsWithoutPrice} vs ${dto.totals.rewardsWithoutPrice}`,
    });
  }
  checks.push({
    name: "totals.lockedUsd = soma dos locks",
    ok: Math.abs(sumLocked - (dto.totals.lockedUsd ?? 0)) < 0.01,
    detail: `${sumLocked.toFixed(2)} vs ${(dto.totals.lockedUsd ?? 0).toFixed(2)}`,
  });
  checks.push({
    name: "contagem de posições sem preço",
    ok: truncated ? dto.totals.positionsWithoutPrice >= withoutPrice : withoutPrice === dto.totals.positionsWithoutPrice,
    detail: `${withoutPrice} vs ${dto.totals.positionsWithoutPrice}`,
  });
  checks.push({
    name: "ordenação por valor (desc) e corte coerente",
    ok:
      dto.positions.every(
        (p, i) => i === 0 || (dto.positions[i - 1].valueUsd ?? -1) >= (p.valueUsd ?? -1),
      ) && dto.positions.length <= dto.totalPositions,
  });
  checks.push({ name: "consistência estrutural das posições", ok: issues.length === 0, detail: issues.join("; ") });
  return checks;
}

async function crossCheckConcentrated(
  raw: Awaited<ReturnType<AerodromeAdapter["fetchRawPositions"]>>,
): Promise<Check[]> {
  const cl = raw.filter((p) => p.sqrt_ratio_lower > 0n && p.sqrt_ratio_upper > 0n);
  if (cl.length === 0) return [{ name: "contraprova Q96 (sem posições concentradas)", ok: true }];

  const checks: Check[] = [];
  for (const p of cl) {
    const [sqrtCur] = (await client.readContract({ address: p.lp, abi: slot0Abi, functionName: "slot0" })) as readonly [
      bigint,
      number,
      number,
      number,
      number,
      boolean,
    ];
    const L = p.liquidity + p.staked;
    const ours = amountsForLiquidity(L, sqrtCur, p.sqrt_ratio_lower, p.sqrt_ratio_upper);
    const sugar0 = p.amount0 + p.staked0;
    const sugar1 = p.amount1 + p.staked1;
    // tolerância: 1% (preço anda entre a chamada do Sugar e o slot0) + epsilon absoluto
    const ok0 = approxEqual(ours.amount0, sugar0, 1, 10n);
    const ok1 = approxEqual(ours.amount1, sugar1, 1, 10n);
    checks.push({
      name: `contraprova Q96 NFT #${p.id}`,
      ok: ok0 && ok1,
      detail: `nossa (${ours.amount0}, ${ours.amount1}) vs Sugar (${sugar0}, ${sugar1})`,
    });
  }
  return checks;
}

async function validateWallet(address: Address): Promise<boolean> {
  console.log(`\n━━ ${address}`);
  const warnings: string[] = [];
  const adapter = new AerodromeAdapter(client as unknown as ChainReader, { onWarn: (m) => warnings.push(m) });

  const t0 = Date.now();
  const raw = await adapter.fetchRawPositions(address);
  const normalized = await adapter.normalize(raw);
  const scanMs = Date.now() - t0;

  const tokens = normalized.flatMap((p) => [p.token0.address, p.token1.address, ...p.rewards.map((r) => r.token.address)]);
  const raw_prices = await fetchUsdPrices(CHAIN_SLUG, tokens, (m) => warnings.push(m));
  // chaves de preço agora são multi-rede: chainId:endereço (bateria = Base/8453)
  const prices = new Map<string, number>();
  for (const [addr, price] of raw_prices) prices.set(`8453:${addr}`, price);
  const dto = buildResponse({ address, normalized, prices, scanMs, warnings });

  console.log(
    `   ${dto.positions.length} posições em ${(scanMs / 1000).toFixed(1)} s · US$ ${dto.totals.valueUsd.toFixed(2)} · ` +
      `a receber US$ ${dto.totals.rewardsUsd.toFixed(2)} · sem preço: ${dto.totals.positionsWithoutPrice} · avisos: ${warnings.length}`,
  );

  const checks = [...dtoInvariants(dto), ...(await crossCheckConcentrated(raw))];
  let allOk = true;
  for (const c of checks) {
    if (!c.ok) allOk = false;
    console.log(`   ${c.ok ? "✅" : "❌"} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ""}`);
  }
  if (warnings.length > 0) for (const w of warnings) console.log(`   ⚠ ${w}`);
  return allOk;
}

async function main() {
  const args = process.argv
    .slice(2)
    .filter((a) => isAddress(a))
    .map((a) => getAddress(a));
  const wallets = args.length > 0 ? args : DEFAULT_WALLETS;
  let failures = 0;
  for (const w of wallets) {
    try {
      if (!(await validateWallet(w))) failures++;
    } catch (e) {
      failures++;
      console.log(`   ❌ exceção: ${(e as Error).message}`);
    }
  }
  console.log(`\n${failures === 0 ? "✅ BATERIA OK" : `❌ ${failures} carteira(s) com falha`} (${wallets.length} carteiras)`);
  if (failures > 0) process.exit(1);
}

// só roda a bateria quando executado direto (o arquivo também é importado
// pelo validate-live.ts, que reaproveita dtoInvariants)
if (process.argv[1]?.replace(/\\/g, "/").endsWith("validate-batch.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
