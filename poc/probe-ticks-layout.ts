/**
 * PoC — duas perguntas que o código novo (Receita G v2) depende:
 *
 * 1) O `ticks()` do pool CL da Aerodrome (Slipstream) tem o MESMO layout do
 *    Uniswap v3? O Slipstream é fork, e fork costuma inserir campo. Se
 *    inserir, decodificar com a ABI do Uniswap lê `stakedLiquidityNet` como
 *    se fosse `feeGrowthOutside0X128` — número errado, silenciosamente.
 * 2) A posição RWA da Robinhood já existia 24 h atrás, com o mesmo L?
 *    (a medição assume L constante na janela)
 *
 * Uso: npx tsx poc/probe-ticks-layout.ts
 */

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { CHAINS } from "../core/chains";
import { UNISWAP_V3_ROBINHOOD } from "../core/adapters/uniswap-v3/config";

const uniTicks = parseAbi([
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);
const slipTicks = parseAbi([
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, int128 stakedLiquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, uint256 rewardGrowthOutsideX128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);
/* ATENÇÃO: o slot0() do Slipstream tem 6 campos (sem feeProtocol) — provado
   neste PoC em 15/09/2026: decodificar com a ABI do Uniswap (7 campos) dá
   "Position 223 is out of bounds". Já estava certo em adapters/aerodrome/abi.ts. */
const poolMisc = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
  "function tickSpacing() view returns (int24)",
]);
const nfpmAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

/** um Q128 de feeGrowth de pool vivo é gigante; liquidez cabe em ~1e20 */
const pareceQ128 = (v: bigint) => v > 10n ** 24n;

async function pergunta1() {
  console.log("\n===== 1) layout do ticks() no pool CL da Aerodrome (Base) =====\n");
  const pool = "0x82321f3BEB69f503380D6B233857d5C43562e2D0" as Address; // CL200-WETH/AERO
  const reader = createReader(8453) as any;

  const [slot0, spacing] = await Promise.all([
    reader.readContract({ address: pool, abi: poolMisc, functionName: "slot0" }),
    reader.readContract({ address: pool, abi: poolMisc, functionName: "tickSpacing" }),
  ]);
  const tickAtual = Number((slot0 as any[])[1]);
  const sp = Number(spacing);
  console.log(`pool ${pool} — tick atual ${tickAtual}, spacing ${sp}`);

  // procura um tick INICIALIZADO perto do preço (senão vem tudo zero e não prova nada)
  const base = Math.floor(tickAtual / sp) * sp;
  for (let i = 0; i < 40; i++) {
    const t = base + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * sp;
    let uni: any[];
    try {
      uni = (await reader.readContract({ address: pool, abi: uniTicks, functionName: "ticks", args: [t] })) as any[];
    } catch {
      continue;
    }
    if ((uni[0] as bigint) === 0n) continue; // liquidityGross 0 = não inicializado
    const slip = (await reader.readContract({ address: pool, abi: slipTicks, functionName: "ticks", args: [t] })) as any[];
    console.log(`\ntick inicializado encontrado: ${t} (liquidityGross=${uni[0]})`);
    console.log(`  ABI Uniswap  → campo[2] "feeGrowthOutside0X128" = ${uni[2]}`);
    console.log(`                 parece Q128? ${pareceQ128(uni[2] as bigint) ? "SIM" : "NÃO (é pequeno demais)"}`);
    console.log(`  ABI Slipstream→ campo[2] "stakedLiquidityNet"   = ${slip[2]}`);
    console.log(`                 campo[3] "feeGrowthOutside0X128" = ${slip[3]}`);
    console.log(`                 parece Q128? ${pareceQ128(slip[3] as bigint) ? "SIM" : "NÃO"}`);
    console.log(
      `\n  VEREDITO: o layout correto para a Aerodrome é o ${
        pareceQ128(uni[2] as bigint) && !pareceQ128(slip[3] as bigint) ? "do UNISWAP (igual)" : "do SLIPSTREAM (tem campo a mais!)"
      }`,
    );
    return;
  }
  console.log("nenhum tick inicializado encontrado perto do preço — inconclusivo");
}

async function pergunta2() {
  console.log("\n===== 2) a posição RWA já existia 24 h atrás, com o mesmo L? =====\n");
  const reader = createReader(4663) as any;
  const bloco = (await reader.getBlockNumber()) as bigint;
  const sp = CHAINS[4663].secPerBlock;

  for (const horas of [0, 1, 6, 24, 72]) {
    const alvo = bloco - BigInt(Math.round((horas * 3600) / sp));
    try {
      const p = (await reader.readContract({
        address: UNISWAP_V3_ROBINHOOD.nfpm, abi: nfpmAbi, functionName: "positions", args: [1181755n],
        ...(horas === 0 ? {} : { blockNumber: alvo }),
      })) as any[];
      console.log(`  ${String(horas).padStart(3)}h atrás (bloco ${alvo}): L = ${p[7]}`);
    } catch (e) {
      console.log(`  ${String(horas).padStart(3)}h atrás (bloco ${alvo}): NÃO EXISTIA / ${(e as Error).message.split("\n")[0].slice(0, 50)}`);
    }
  }
}

async function main() {
  await pergunta1();
  await pergunta2();
}
main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
