/**
 * CONTRAPROVA da Receita G v2 — usa o código DE PRODUÇÃO (core/yields/onchain)
 * contra a posição RWA da Robinhood e confere o resultado por fora.
 *
 * A prova forte: `(feeGrowthInside_agora − feeGrowthInside_last) × L ÷ 2^128`
 * tem de dar as MESMAS taxas pendentes que o site mostra em "A receber" — que
 * vêm de outro caminho (collect() simulado no NFPM). Se os dois números
 * baterem, a fórmula do feeGrowthInside está certa, incluindo o layout do
 * pool e a aritmética mod 2^256.
 *
 * Uso: npx tsx poc/probe-fee-inside-check.ts
 */

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { CHAINS } from "../core/chains";
import { UNISWAP_V3_ROBINHOOD } from "../core/adapters/uniswap-v3/config";
import {
  computeOnchainFeeApr,
  feeGrowthInside,
  readPositionFeeWindows,
  wrapSub,
  type FeeWindowTarget,
} from "../core/yields/onchain";

const Q128 = 2n ** 128n;
const nfpmAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);
const poolAbi = parseAbi([
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);

async function main() {
  const chainId = 4663;
  const info = CHAINS[chainId];
  const reader = createReader(chainId);
  const r = reader as any;
  const pool = "0xC8C90d3a1c1a24967E773ac2aD0d456BA3E31F64" as Address;
  const nft = 1181755n;

  const pos = (await r.readContract({ address: UNISWAP_V3_ROBINHOOD.nfpm, abi: nfpmAbi, functionName: "positions", args: [nft] })) as any[];
  const lower = Number(pos[5]), upper = Number(pos[6]);
  const L = pos[7] as bigint;
  const inside0Last = pos[8] as bigint;
  const inside1Last = pos[9] as bigint;

  const [g0, g1, slot0, tl, tu] = await Promise.all([
    r.readContract({ address: pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128" }),
    r.readContract({ address: pool, abi: poolAbi, functionName: "feeGrowthGlobal1X128" }),
    r.readContract({ address: pool, abi: poolAbi, functionName: "slot0" }),
    r.readContract({ address: pool, abi: poolAbi, functionName: "ticks", args: [lower] }),
    r.readContract({ address: pool, abi: poolAbi, functionName: "ticks", args: [upper] }),
  ]);
  const snap = {
    tick: Number((slot0 as any[])[1]),
    global0: g0 as bigint, global1: g1 as bigint,
    outLower0: (tl as any[])[2] as bigint, outLower1: (tl as any[])[3] as bigint,
    outUpper0: (tu as any[])[2] as bigint, outUpper1: (tu as any[])[3] as bigint,
  };
  const [in0, in1] = feeGrowthInside(snap, lower, upper);

  // ---- CONTRAPROVA 1: taxas desde o último toque == "A receber" do site
  const dev0 = (wrapSub(in0, inside0Last) * L) / Q128;
  const dev1 = (wrapSub(in1, inside1Last) * L) / Q128;
  console.log("=== contraprova: taxas acumuladas desde o mint ===");
  console.log(`  pela fórmula feeGrowthInside : ${Number(dev0) / 1e6} USDG + ${Number(dev1) / 1e18} HIMS`);
  console.log(`  tokensOwed gravado na posição: ${Number(pos[10]) / 1e6} USDG + ${Number(pos[11]) / 1e18} HIMS`);
  console.log(`  (o site mostra ~0,0412 USDG + 0,000355 HIMS via collect() simulado)`);

  // ---- CONTRAPROVA 2: o caminho de produção, janela por janela
  console.log("\n=== readPositionFeeWindows (código de produção) ===");
  const bloco = (await r.getBlockNumber()) as bigint;
  const alvo: FeeWindowTarget = { key: "rwa", protocol: "uniswap-v3", pool, tickLower: lower, tickUpper: upper, inside0Last };
  const comIdade = await readPositionFeeWindows(reader, [alvo], bloco, info.secPerBlock, (m) => console.log("   aviso:", m));
  const semIdade = await readPositionFeeWindows(reader, [{ ...alvo, inside0Last: null }], bloco, info.secPerBlock, () => {});

  const precos = { u: 1.0, h: 28.21 };
  const apr = (w: any) => w && computeOnchainFeeApr({
    delta0: w.delta0, delta1: w.delta1, posLiquidity: L, windowSec: w.windowSec,
    decimals0: 6, decimals1: 18, price0Usd: precos.u, price1Usd: precos.h, positionValueUsd: 193.04,
  });
  const a = comIdade.get("rwa"), b = semIdade.get("rwa");
  console.log(`  COM guarda de idade : janela ${a ? a.windowSec / 60 + " min" : "—"} → ${apr(a)?.toFixed(2) ?? "—"}% a.a.`);
  console.log(`  SEM guarda de idade : janela ${b ? b.windowSec / 3600 + " h" : "—"} → ${apr(b)?.toFixed(2) ?? "—"}% a.a.`);
  console.log(`\n  deltas da janela escolhida (para o teste de regressão):`);
  if (a) console.log(`    delta0=${a.delta0}n delta1=${a.delta1}n windowSec=${a.windowSec} L=${L}n`);
}
main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
