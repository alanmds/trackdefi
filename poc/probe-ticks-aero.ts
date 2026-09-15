/**
 * PoC — layout do `ticks()` no pool CL da Aerodrome/Velodrome (Slipstream).
 * Pega os ticks de uma posição CL REAL (nada de adivinhar tick inicializado)
 * e decodifica o retorno com as duas ABIs candidatas.
 *
 * Uso: npx tsx poc/probe-ticks-aero.ts [0xCARTEIRA]
 */

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";

const uniTicks = parseAbi([
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);
const slipTicks = parseAbi([
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, int128 stakedLiquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, uint256 rewardGrowthOutsideX128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);

/** feeGrowth de pool vivo é Q128 (gigante); liquidez/stakedLiquidityNet, não */
const pareceQ128 = (v: bigint) => (v < 0n ? false : v > 10n ** 24n);

async function main() {
  const carteira = (process.argv[2] ?? "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac") as Address;
  const reader = createReader(8453);
  const posicoes = await new AerodromeAdapter(reader).getPositions(carteira);
  const cl = posicoes.filter((p) => p.kind === "concentrated" && p.range);
  console.log(`carteira ${carteira}: ${posicoes.length} posições, ${cl.length} concentradas`);
  if (cl.length === 0) return console.log("sem posição CL nessa carteira — rode com outra");

  const r = reader as any;
  for (const p of cl.slice(0, 2)) {
    const { tickLower, tickUpper } = p.range!;
    console.log(`\n--- ${p.poolSymbol} ${p.poolAddress}  ticks ${tickLower}..${tickUpper} ---`);
    for (const t of [tickLower, tickUpper]) {
      let uni: any[] | null = null, slip: any[] | null = null;
      try { uni = (await r.readContract({ address: p.poolAddress, abi: uniTicks, functionName: "ticks", args: [t] })) as any[]; } catch (e) { console.log(`  tick ${t}: ABI Uniswap FALHOU (${(e as Error).message.split("\n")[0].slice(0, 45)})`); }
      try { slip = (await r.readContract({ address: p.poolAddress, abi: slipTicks, functionName: "ticks", args: [t] })) as any[]; } catch (e) { console.log(`  tick ${t}: ABI Slipstream FALHOU (${(e as Error).message.split("\n")[0].slice(0, 45)})`); }
      if (uni) console.log(`  tick ${t} | Uniswap    campo[2]=${uni[2]}  → Q128? ${pareceQ128(uni[2])}`);
      if (slip) console.log(`  tick ${t} | Slipstream campo[2]=${slip[2]} campo[3]=${slip[3]} → Q128? ${pareceQ128(slip[3])}`);
      if (uni && slip) {
        const veredito = pareceQ128(uni[2]) ? "UNISWAP (layout igual)" : pareceQ128(slip[3]) ? "SLIPSTREAM (campo a mais)" : "INCONCLUSIVO (tick sem taxa acumulada)";
        console.log(`  VEREDITO: ${veredito}`);
      }
    }
  }
}
main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
