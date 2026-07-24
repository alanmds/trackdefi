/**
 * PoC — Receita C2, Fase 2: FEE APR "AGORA" da POSIÇÃO (estimativa honesta).
 *
 * Premissa a provar: para uma posição concentrada EM RANGE dá para estimar o
 * APR de TAXAS que ELA gera agora, sem indexador, via:
 *
 *   feesPorDia_posição ≈ volumeUsd1d_pool × feeTier × (L_posição / L_ativa_pool)
 *   feeAPR = feesPorDia × 365 ÷ valorUSD_posição
 *
 * `volumeUsd1d` vem do dataset grátis da DefiLlama; `L_ativa_pool` = pool.liquidity()
 * (liquidez ativa no tick atual, 1 chamada). A concentração é capturada por
 * L_posição/L_ativa (posição estreita rende mais por dólar que a média do pool).
 *
 * Contraprovas: (A) apyBase do pool na DefiLlama = volume×fee/TVL (a NOSSA
 * fórmula com L_pos/L_ativa deve dar apyBase × multiplicador de concentração,
 * onde mult = (TVL_pool/valor_pos)×(L_pos/L_ativa)); (B) coerência interna
 * volumeUsd1d×fee ≈ apyBase/100×TVL/365. Validação visual: comparar com o
 * "fee APR" que o revert.finance mostra p/ a MESMA carteira 0x8cadb2…6245F8.
 *
 * Sonda secundária: posição CL EM STAKE na Aerodrome ainda acumula FEES para
 * o LP, ou só emissões? (mede unstaked_earned em 2 instantes.)
 *
 *   npx tsx poc/probe-fee-apr.ts
 */

export {}; // arquivo-script

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { getWalletPositions } from "../core/service";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { amountsForLiquidity } from "../core/math/liquidity";
import { getSqrtRatioAtTick } from "../core/math/tickmath";
import { fetchUsdPrices } from "../core/prices/defillama";
import { CHAINS } from "../core/chains";
import { UNISWAP_V3_CHAINS } from "../core/adapters/uniswap-v3/config";

const WALLET = "0x8cadb20A4811f363Dadb863A190708bEd26245F8" as Address;
const ALAN = "0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC" as Address;
const YEAR = 365;

const nfpmAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 f0, uint256 f1, uint128 owed0, uint128 owed1)",
]);
const factoryAbi = parseAbi(["function getPool(address a, address b, uint24 fee) view returns (address)"]);
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 a, uint16 b, uint16 c, uint8 d, bool e)",
  "function liquidity() view returns (uint128)",
]);

type LlamaRow = { chain: string; project: string; tvlUsd: number; apyBase: number | null; volumeUsd1d: number | null; poolMeta: string | null; underlyingTokens: string[] | null };

async function loadYields(): Promise<LlamaRow[]> {
  const res = await fetch("https://yields.llama.fi/pools");
  const body = (await res.json()) as { data: LlamaRow[] };
  return body.data ?? [];
}

function feePctLabel(fee: number): string {
  return (fee / 10_000).toLocaleString("en-US", { maximumFractionDigits: 4 }) + "%";
}

async function main() {
  console.log("═══ PoC fee APR da posição (Uniswap in-range, carteira do Revert) ═══\n");

  const yields = await loadYields();
  const nfpmByChain = new Map(UNISWAP_V3_CHAINS.map((c) => [c.chainId, c]));

  // 1) enumerar a carteira e pegar as concentradas Uniswap EM RANGE com valor
  const dto = await getWalletPositions(WALLET);
  const targets = dto.positions.filter(
    (p) => p.protocol === "uniswap-v3" && p.kind === "concentrated" && p.range?.inRange && (p.valueUsd ?? 0) > 1,
  );
  console.log(`Posições Uniswap in-range com valor > $1: ${targets.length}\n`);

  for (const p of targets.slice(0, 6)) {
    const cfg = nfpmByChain.get(p.chainId);
    const chain = CHAINS[p.chainId];
    if (!cfg || !chain) continue;
    const reader = createReader(p.chainId);
    const tokenId = BigInt(p.positionId!);

    // liquidez da posição (raw NFPM) + liquidez ativa do pool
    let posL: bigint, tickLower: number, tickUpper: number, fee: number;
    try {
      const r = (await reader.readContract({ address: cfg.nfpm, abi: nfpmAbi, functionName: "positions", args: [tokenId] })) as readonly unknown[];
      fee = Number(r[4]); tickLower = Number(r[5]); tickUpper = Number(r[6]); posL = r[7] as bigint;
    } catch (e) { console.log(`  ${p.poolSymbol}: falha ao ler NFPM — ${(e as Error).message.split("\n")[0]}`); continue; }

    const slot0 = (await reader.readContract({ address: p.poolAddress as Address, abi: poolAbi, functionName: "slot0" })) as readonly unknown[];
    const activeL = (await reader.readContract({ address: p.poolAddress as Address, abi: poolAbi, functionName: "liquidity" })) as bigint;
    const sqrtP = slot0[0] as bigint;

    // amounts da posição pela nossa matemática Q96 → valor USD
    const { amount0, amount1 } = amountsForLiquidity(posL, sqrtP, getSqrtRatioAtTick(tickLower), getSqrtRatioAtTick(tickUpper));
    const a0 = Number(amount0) / 10 ** p.token0.decimals;
    const a1 = Number(amount1) / 10 ** p.token1.decimals;
    const valueUsd = (p.token0.priceUsd !== null && p.token1.priceUsd !== null)
      ? a0 * p.token0.priceUsd + a1 * p.token1.priceUsd : (p.valueUsd ?? 0);

    // casar linha DefiLlama pelo par + fee
    const t0 = p.token0.address.toLowerCase(), t1 = p.token1.address.toLowerCase();
    const rows = yields.filter((r) =>
      r.chain === chain.yieldsLabel && r.project === "uniswap-v3" &&
      Array.isArray(r.underlyingTokens) &&
      r.underlyingTokens.map((x) => x.toLowerCase()).includes(t0) &&
      r.underlyingTokens.map((x) => x.toLowerCase()).includes(t1) &&
      typeof r.poolMeta === "string" && Math.abs(parseFloat(r.poolMeta) - fee / 10_000) < 1e-9,
    );
    const row = rows.sort((a, b) => b.tvlUsd - a.tvlUsd)[0];

    console.log(`── ${p.poolSymbol} · ${chain.label} · $${valueUsd.toFixed(2)}`);
    console.log(`   posL=${posL}  activeL=${activeL}  share=${(Number(posL) / Number(activeL) * 100).toFixed(3)}%  fee=${feePctLabel(fee)}`);
    if (!row || row.volumeUsd1d == null) {
      console.log(`   ❌ sem volumeUsd1d na DefiLlama → feeAPR viraria '—'\n`);
      continue;
    }
    const share = Number(posL) / Number(activeL);
    const feesPerDay = row.volumeUsd1d * (fee / 1e6) * share;
    const feeApr = (feesPerDay * YEAR / valueUsd) * 100;
    const mult = row.apyBase ? feeApr / row.apyBase : NaN;
    const coherence = row.volumeUsd1d * (fee / 1e6); // ≈ apyBase/100×TVL/365 ?
    const impliedDailyFromApyBase = (row.apyBase ?? 0) / 100 * row.tvlUsd / 365;
    console.log(`   DefiLlama: volume24h=$${Math.round(row.volumeUsd1d).toLocaleString()} · apyBase(pool)=${row.apyBase?.toFixed(2)}% · TVL=$${Math.round(row.tvlUsd).toLocaleString()}`);
    console.log(`   coerência: volume×fee=$${coherence.toFixed(0)}/dia  vs  apyBase×TVL/365=$${impliedDailyFromApyBase.toFixed(0)}/dia`);
    console.log(`   ► FEE APR posição ≈ ${feeApr.toFixed(2)}%  (mult. concentração ×${mult.toFixed(1)} sobre apyBase do pool)\n`);
  }

  // 2) sonda secundária: staked CL na Aerodrome ainda acumula FEES?
  console.log("── Sonda: posição CL EM STAKE (Aerodrome) acumula fees p/ o LP?");
  const reader = createReader(8453);
  const adapter = new AerodromeAdapter(reader);
  const raw = await adapter.fetchRawPositions(ALAN);
  const staked = raw.find((p) => p.staked > 0n);
  if (staked) {
    console.log(`   NFT #${staked.id}: unstaked_earned0=${staked.unstaked_earned0} unstaked_earned1=${staked.unstaked_earned1} (t0)`);
    console.log("   aguardando 60s…");
    await new Promise((r) => setTimeout(r, 60_000));
    const raw2 = await adapter.fetchRawPositions(ALAN);
    const s2 = raw2.find((p) => p.id === staked.id);
    if (s2) {
      const d0 = s2.unstaked_earned0 - staked.unstaked_earned0;
      const d1 = s2.unstaked_earned1 - staked.unstaked_earned1;
      console.log(`   t1: unstaked_earned0=${s2.unstaked_earned0} (Δ${d0}) unstaked_earned1=${s2.unstaked_earned1} (Δ${d1})`);
      console.log(`   → ${d0 > 0n || d1 > 0n ? "SIM, fees acumulam enquanto em stake (somar fee+emissão)" : "NÃO acumulam fees em stake (só emissão vale p/ 'earning now')"}`);
    }
  } else {
    console.log("   (nenhuma posição em stake na carteira)");
  }

  console.log("\n═══ fim do PoC ═══");
}

main().catch((e) => { console.error("Falhou:", (e as Error).message); process.exit(1); });
