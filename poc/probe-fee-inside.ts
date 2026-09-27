/**
 * PoC — Receita G v2: fee APR da posição medido com feeGrowth**Inside**.
 *
 * O MOTIVO (achado de 15/09/2026, numa posição RWA de faixa estreita na Robinhood):
 * o `core/yields/onchain.ts` usa `feeGrowthGlobal × L`, que atribui à posição
 * as taxas do pool INTEIRO — inclusive as geradas enquanto o preço estava
 * FORA da faixa dela. Numa faixa estreita isso infla o APR sem limite; a
 * posição RWA bateu 971,94% (o teto de sanidade é 1.000%).
 *
 * A CONTA CERTA é a que o próprio pool usa para pagar a posição:
 *   feeGrowthInside = fgGlobal − fgOutside(lower) − fgOutside(upper)
 *     (cada lado invertido conforme o tick corrente, aritmética mod 2^256)
 *   taxas = Δ feeGrowthInside × L ÷ 2^128
 *
 * PROPRIEDADE IMPORTANTE: se o preço NÃO cruzou nenhum dos dois ticks da
 * faixa durante a janela, `feeGrowthOutside` dos dois não muda e
 * Δinside == Δglobal — ou seja, o método novo devolve EXATAMENTE o mesmo
 * número do atual onde a premissa do atual vale, e só corrige onde ela falha.
 *
 * Uso: npx tsx poc/probe-fee-inside.ts
 */

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { CHAINS } from "../core/chains";
import { UNISWAP_V3_ROBINHOOD } from "../core/adapters/uniswap-v3/config";

const MOD = 2n ** 256n;
const Q128 = 2n ** 128n;
const YEAR_SEC = 365 * 24 * 3600;

/** subtração de uint256 com wrap — é assim que o Solidity faz (unchecked) */
const sub = (a: bigint, b: bigint): bigint => (a - b + MOD) % MOD;

const poolAbi = parseAbi([
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);
const nfpmAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

interface Snapshot {
  tick: number;
  global0: bigint;
  global1: bigint;
  outLower0: bigint;
  outLower1: bigint;
  outUpper0: bigint;
  outUpper1: bigint;
}

async function snapshot(reader: any, pool: Address, lower: number, upper: number, blockNumber?: bigint): Promise<Snapshot> {
  const at = blockNumber ? { blockNumber } : {};
  const [g0, g1, slot0, tl, tu] = await Promise.all([
    reader.readContract({ address: pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128", ...at }),
    reader.readContract({ address: pool, abi: poolAbi, functionName: "feeGrowthGlobal1X128", ...at }),
    reader.readContract({ address: pool, abi: poolAbi, functionName: "slot0", ...at }),
    reader.readContract({ address: pool, abi: poolAbi, functionName: "ticks", args: [lower], ...at }),
    reader.readContract({ address: pool, abi: poolAbi, functionName: "ticks", args: [upper], ...at }),
  ]);
  return {
    tick: Number((slot0 as any[])[1]),
    global0: g0 as bigint,
    global1: g1 as bigint,
    outLower0: (tl as any[])[2] as bigint,
    outLower1: (tl as any[])[3] as bigint,
    outUpper0: (tu as any[])[2] as bigint,
    outUpper1: (tu as any[])[3] as bigint,
  };
}

/** feeGrowthInside do par (0,1) — a mesma fórmula do Uniswap v3 Pool.sol */
function inside(s: Snapshot, lower: number, upper: number): [bigint, bigint] {
  const below0 = s.tick >= lower ? s.outLower0 : sub(s.global0, s.outLower0);
  const below1 = s.tick >= lower ? s.outLower1 : sub(s.global1, s.outLower1);
  const above0 = s.tick < upper ? s.outUpper0 : sub(s.global0, s.outUpper0);
  const above1 = s.tick < upper ? s.outUpper1 : sub(s.global1, s.outUpper1);
  return [sub(sub(s.global0, below0), above0), sub(sub(s.global1, below1), above1)];
}

async function main() {
  const chainId = 4663;
  const info = CHAINS[chainId];
  const reader = createReader(chainId) as any;
  /* NFT e pool vêm por argumento, sem padrão: o repo é público, e um NFT
     fixo aqui ligava o projeto à carteira dona dele (limpeza de 26/09/2026). */
  const [nftArg, poolArg] = process.argv.slice(2);
  if (!nftArg || !poolArg) throw new Error("uso: npx tsx <este-arquivo> <nft-id> <endereço-do-pool>");
  const nft = BigInt(nftArg);

  const pos = (await reader.readContract({
    address: UNISWAP_V3_ROBINHOOD.nfpm, abi: nfpmAbi, functionName: "positions", args: [nft],
  })) as any[];
  const [, , token0, token1, , tickLowerRaw, tickUpperRaw, liquidity] = pos;
  const lower = Number(tickLowerRaw), upper = Number(tickUpperRaw);
  const L = liquidity as bigint;

  const pool = poolArg as Address;
  const decAbi = [{ type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }] as const;
  const dec0 = Number(await reader.readContract({ address: token0, abi: decAbi, functionName: "decimals" }));
  const dec1 = Number(await reader.readContract({ address: token1, abi: decAbi, functionName: "decimals" }));

  // preços pela MESMA fonte da produção
  const { defillamaPrices } = await import("../core/prices/defillama");
  const precos = await defillamaPrices.fetchUsdPrices(info.priceSlug, [token0, token1] as Address[]);
  const price0 = precos.get(String(token0).toLowerCase()) ?? null;
  const price1 = precos.get(String(token1).toLowerCase()) ?? null;
  console.log(`preços: token0=${price0} token1=${price1}`);
  if (price0 === null || price1 === null) throw new Error("sem preço — abortando");

  const bloco = (await reader.getBlockNumber()) as bigint;
  const agora = await snapshot(reader, pool, lower, upper);
  const [in0Now, in1Now] = inside(agora, lower, upper);

  // valor da posição: aproximação boa o bastante para o PoC (a API já calcula certo)
  const valorUsd = 192.84;

  console.log(`\nposição NFT #${nft}  L=${L}  faixa de ticks ${lower}..${upper}  (tick atual ${agora.tick})`);
  console.log(`valor US$ ${valorUsd}\n`);
  console.log("janela |    MÉTODO ATUAL (global)  |   MÉTODO CERTO (inside)   | razão");
  console.log("-------|---------------------------|---------------------------|-------");

  for (const horas of [1, 6, 24]) {
    const blocos = BigInt(Math.round((horas * 3600) / info.secPerBlock));
    const passado = bloco - blocos;
    const windowSec = Number(blocos) * info.secPerBlock;
    try {
      const antes = await snapshot(reader, pool, lower, upper, passado);
      const [in0Old, in1Old] = inside(antes, lower, upper);

      const usd = (d0: bigint, d1: bigint) =>
        (Number((d0 * L) / Q128) / 10 ** dec0) * price0 + (Number((d1 * L) / Q128) / 10 ** dec1) * price1;
      const apr = (fees: number) => ((fees / windowSec) * YEAR_SEC * 100) / valorUsd;

      const gUsd = usd(sub(agora.global0, antes.global0), sub(agora.global1, antes.global1));
      const iUsd = usd(sub(in0Now, in0Old), sub(in1Now, in1Old));

      console.log(
        `${String(horas).padStart(5)}h | US$ ${gUsd.toFixed(4).padStart(9)} → ${apr(gUsd).toFixed(2).padStart(8)}% | ` +
          `US$ ${iUsd.toFixed(4).padStart(9)} → ${apr(iUsd).toFixed(2).padStart(8)}% | ${(iUsd / gUsd).toFixed(3)}`,
      );
      console.log(`       | tick no início da janela: ${antes.tick} ${antes.tick >= lower && antes.tick < upper ? "(DENTRO da faixa)" : "(FORA da faixa)"}`);
    } catch (e) {
      console.log(`${String(horas).padStart(5)}h | FALHA: ${(e as Error).message.split("\n")[0].slice(0, 70)}`);
    }
  }

  console.log(`\nteto de sanidade do projeto: 1.000% — o método atual passou raspando (971,94% em produção).`);
}

main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
