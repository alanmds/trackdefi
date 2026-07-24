/**
 * PoC — Receita C2, Fase 1: APR de EMISSÕES da POSIÇÃO (não do pool).
 *
 * Premissa a provar: para uma posição CL EM STAKE e EM RANGE, dá para calcular
 * o APR de emissões que ELA recebe AGORA, single-shot, via:
 *
 *   emissõesPorSeg_posição = rewardRate_gauge × (L_staked_posição / L_staked_ativa_pool)
 *   APR = emissõesPorSeg × segundosNoAno × preço(AERO) ÷ valorUSD_posição
 *
 * E que fora do range esse número é 0 (o gauge CL só paga liquidez ativa no
 * tick corrente). Contraprovas: (A) o apyReward do pool na DefiLlama; (B) a
 * taxa REALIZADA, medindo o earned da posição em dois instantes separados.
 *
 * Este PoC NÃO assume a ABI do gauge de memória: SONDA várias assinaturas
 * candidatas e reporta o que o contrato publicado responde (regra do projeto).
 *
 *   npx tsx poc/probe-emissions.ts
 */

export {}; // arquivo-script

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { AERODROME_BASE } from "../core/adapters/aerodrome/config";
import { fetchUsdPrices } from "../core/prices/defillama";
import type { ChainReader } from "../core/types";

const ACCOUNT = "0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC" as Address;
const POOL = "0x9D14ff91AE2c6e3D1A760542248B6c7F206894b0" as Address; // CL1-USDC/cbBTC
const NFT_ID = 1774557n;
const AERO = AERODROME_BASE.emissionsToken;
const YEAR = 365 * 24 * 3600;

/** tenta uma leitura; devolve o valor ou null (com o motivo no log de sondagem) */
async function tryRead(
  reader: ChainReader,
  address: Address,
  sig: string,
  fn: string,
  args: readonly unknown[] = [],
): Promise<unknown | null> {
  try {
    return await reader.readContract({ address, abi: parseAbi([sig]), functionName: fn, args });
  } catch (e) {
    console.log(`     ✗ ${fn}(${args.join(",")}) — ${(e as Error).message.split("\n")[0].slice(0, 70)}`);
    return null;
  }
}

async function main() {
  const reader = createReader(8453);

  console.log("═══ PoC emissões da posição (Aerodrome/Base) ═══");
  console.log(`Conta ${ACCOUNT}\nPool ${POOL} (CL1-USDC/cbBTC), NFT #${NFT_ID}\n`);

  // 1) posição crua do Sugar: L em stake, emissões pendentes, ticks
  const adapter = new AerodromeAdapter(reader, { onWarn: (m) => console.log(`   [warn] ${m}`) });
  const raw = await adapter.fetchRawPositions(ACCOUNT);
  const pos = raw.find((p) => p.id === NFT_ID);
  if (!pos) {
    console.log("❌ NFT não encontrado na carteira (foi fechado?) — abortando.");
    process.exit(1);
  }
  console.log("1) Posição no Sugar:");
  console.log(`   liquidity(unstaked)=${pos.liquidity}  staked(L)=${pos.staked}`);
  console.log(`   staked0=${pos.staked0} staked1=${pos.staked1}  emissions_earned=${pos.emissions_earned}`);
  console.log(`   tick_lower=${pos.tick_lower} tick_upper=${pos.tick_upper}`);

  // 2) sondar o POOL: gauge, liquidez ativa staked, tick corrente
  console.log("\n2) Sondando o POOL (assinaturas candidatas):");
  const gauge = (await tryRead(reader, POOL, "function gauge() view returns (address)", "gauge")) as Address | null;
  const stakedLiquidity = (await tryRead(
    reader,
    POOL,
    "function stakedLiquidity() view returns (uint128)",
    "stakedLiquidity",
  )) as bigint | null;
  const liquidity = (await tryRead(reader, POOL, "function liquidity() view returns (uint128)", "liquidity")) as
    | bigint
    | null;
  const slot0 = (await tryRead(
    reader,
    POOL,
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 a, uint16 b, uint16 c, bool unlocked)",
    "slot0",
  )) as readonly unknown[] | null;
  const tickCurrent = slot0 ? Number(slot0[1]) : null;
  console.log(`   gauge=${gauge}`);
  console.log(`   stakedLiquidity=${stakedLiquidity}  liquidity(total ativa)=${liquidity}  tickAtual=${tickCurrent}`);

  const inRange =
    tickCurrent !== null && tickCurrent >= pos.tick_lower && tickCurrent < pos.tick_upper;
  console.log(`   → posição ${inRange ? "EM RANGE" : "FORA do range"}`);

  // 3) sondar o GAUGE: rewardRate, rewardToken, earned(account,tokenId)
  let rewardRate: bigint | null = null;
  let earned0: bigint | null = null;
  if (gauge && gauge !== "0x0000000000000000000000000000000000000000") {
    console.log("\n3) Sondando o GAUGE:");
    rewardRate = (await tryRead(reader, gauge, "function rewardRate() view returns (uint256)", "rewardRate")) as
      | bigint
      | null;
    const rewardToken = (await tryRead(
      reader,
      gauge,
      "function rewardToken() view returns (address)",
      "rewardToken",
    )) as Address | null;
    const periodFinish = (await tryRead(
      reader,
      gauge,
      "function periodFinish() view returns (uint256)",
      "periodFinish",
    )) as bigint | null;
    earned0 = (await tryRead(
      reader,
      gauge,
      "function earned(address account, uint256 tokenId) view returns (uint256)",
      "earned",
      [ACCOUNT, NFT_ID],
    )) as bigint | null;
    console.log(`   rewardRate(AERO/seg, 1e18)=${rewardRate}`);
    console.log(`   rewardToken=${rewardToken} (esperado AERO ${AERO})`);
    console.log(`   periodFinish=${periodFinish}  (agora=${Math.floor(Date.now() / 1000)})`);
    console.log(`   earned(account,tokenId)=${earned0}`);
  } else {
    console.log("\n3) ❌ pool não tem gauge legível — sem emissões calculáveis aqui.");
  }

  // 4) preço do AERO e valor da posição (usa preços dos tokens do par)
  console.log("\n4) Preços (DefiLlama) e valor da posição:");
  const prices = await fetchUsdPrices("base", [AERO], (m) => console.log(`   [warn] ${m}`));
  const aeroPrice = prices.get(AERO.toLowerCase()) ?? null;
  // valor da posição: reusa a normalização do adapter p/ pegar amounts + preços do par
  const normalized = await adapter.normalize([pos]);
  const np = normalized[0];
  const parPrices = await fetchUsdPrices(
    "base",
    [np.token0.address, np.token1.address],
    (m) => console.log(`   [warn] ${m}`),
  );
  const p0 = parPrices.get(np.token0.address.toLowerCase()) ?? null;
  const p1 = parPrices.get(np.token1.address.toLowerCase()) ?? null;
  const a0 = Number(np.amount0Raw) / 10 ** np.token0.decimals;
  const a1 = Number(np.amount1Raw) / 10 ** np.token1.decimals;
  const valueUsd = p0 !== null && p1 !== null ? a0 * p0 + a1 * p1 : null;
  console.log(`   AERO=$${aeroPrice}  ${np.token0.symbol}=$${p0} ${np.token1.symbol}=$${p1}`);
  console.log(`   valorUSD posição ≈ $${valueUsd?.toFixed(2)}`);

  // 5) CÁLCULO single-shot
  console.log("\n5) APR de emissões — SINGLE-SHOT (rewardRate × share):");
  if (rewardRate && stakedLiquidity && stakedLiquidity > 0n && aeroPrice && valueUsd) {
    const share = Number(pos.staked) / Number(stakedLiquidity);
    const aeroPerSec = (Number(rewardRate) / 1e18) * share;
    const aprInRange = ((aeroPerSec * YEAR * aeroPrice) / valueUsd) * 100;
    const apr = inRange ? aprInRange : 0;
    console.log(`   share = staked_pos/stakedLiquidity = ${pos.staked}/${stakedLiquidity} = ${(share * 100).toFixed(4)}%`);
    console.log(`   AERO/seg da posição = ${aeroPerSec.toExponential(4)}`);
    console.log(`   APR se em range = ${aprInRange.toFixed(2)}%  →  APR AGORA (${inRange ? "em range" : "fora"}) = ${apr.toFixed(2)}%`);
  } else {
    console.log("   ❌ dados insuficientes (rewardRate/stakedLiquidity/preço/valor) — vira '—'.");
  }

  // 6) CONTRAPROVA A — apyReward do pool na DefiLlama
  console.log("\n6) Contraprova A — apyReward do pool na DefiLlama:");
  try {
    const yres = await fetch("https://yields.llama.fi/pools");
    const ybody = (await yres.json()) as { data: any[] };
    const usdc = np.token0.address.toLowerCase();
    const cbbtc = np.token1.address.toLowerCase();
    const cands = ybody.data.filter(
      (r) =>
        r.chain === "Base" &&
        r.project === "aerodrome-slipstream" &&
        Array.isArray(r.underlyingTokens) &&
        r.underlyingTokens.map((x: string) => x.toLowerCase()).includes(usdc) &&
        r.underlyingTokens.map((x: string) => x.toLowerCase()).includes(cbbtc) &&
        typeof r.poolMeta === "string" &&
        r.poolMeta.startsWith("CL1 "),
    );
    for (const c of cands) {
      console.log(`   ${c.poolMeta} · TVL $${Math.round(c.tvlUsd)} · apyReward=${c.apyReward}% · apyBase=${c.apyBase}% · mean30d=${c.apyMean30d}%`);
    }
  } catch (e) {
    console.log(`   [warn] falha ao baixar yields: ${(e as Error).message}`);
  }

  // 7) CONTRAPROVA B — taxa realizada (earned em dois instantes)
  if (gauge && earned0 !== null && rewardRate && aeroPrice && valueUsd) {
    const WAIT = 90;
    console.log(`\n7) Contraprova B — earned realizado (aguardando ${WAIT}s)…`);
    console.log(`   earned t0 = ${earned0}`);
    await new Promise((r) => setTimeout(r, WAIT * 1000));
    const earned1 = (await tryRead(
      reader,
      gauge,
      "function earned(address account, uint256 tokenId) view returns (uint256)",
      "earned",
      [ACCOUNT, NFT_ID],
    )) as bigint | null;
    if (earned1 !== null) {
      const dAero = Number(earned1 - earned0) / 1e18;
      const perSec = dAero / WAIT;
      const aprReal = ((perSec * YEAR * aeroPrice) / valueUsd) * 100;
      console.log(`   earned t1 = ${earned1}  (Δ=${(earned1 - earned0).toString()} = ${dAero.toExponential(4)} AERO em ${WAIT}s)`);
      console.log(`   APR REALIZADO ≈ ${aprReal.toFixed(2)}%`);
    }
  }

  console.log("\n═══ fim do PoC ═══");
}

main().catch((e) => {
  console.error("Falhou:", (e as Error).message);
  process.exit(1);
});
