/**
 * PoC — simulador para pools CLÁSSICOS (v2) da Aerodrome/Velodrome (27/10/2026).
 *
 * 1. Endereço: factory.getPool(a, b, stable). A DefiLlama não diz se o pool da
 *    Aerodrome é stable ou volatile (poolMeta null) — quantos pares têm os dois?
 * 2. Taxas: o pool v2 do Solidly guarda `index0/index1` = taxa acumulada por
 *    LP token × 1e18. Δindex em 24 h e 15 min sai num bloco passado provado?
 * 3. APR de taxas (sem stake) = Δindex × LP ÷ 1e18 → US$ ÷ depósito. Bate com
 *    a ordem de grandeza do apyBase da DefiLlama?
 * 4. Emissões: Voter descoberto on-chain (gauge CL → voter()) → gauges(pool) →
 *    rewardRate/periodFinish/totalSupply do gauge.
 *
 *   npx tsx --env-file=.env.local poc/probe-classico.ts
 */

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { AERODROME_BASE } from "../core/adapters/aerodrome/config";

const factoryAbi = parseAbi(["function getPool(address, address, bool) view returns (address)"]);
const poolAbi = parseAbi([
  "function index0() view returns (uint256)",
  "function index1() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function getReserves() view returns (uint256, uint256, uint256)",
  "function stable() view returns (bool)",
  "function symbol() view returns (string)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function factory() view returns (address)",
]);
const clPoolAbi = parseAbi(["function gauge() view returns (address)"]);
const gaugeAbi = parseAbi([
  "function voter() view returns (address)",
  "function rewardRate() view returns (uint256)",
  "function periodFinish() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
]);
const voterAbi = parseAbi(["function gauges(address) view returns (address)"]);
const tsAbi = parseAbi(["function getCurrentBlockTimestamp() view returns (uint256)"]);
const MC3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

const r = createReader(8453);
const V2_FACTORY = AERODROME_BASE.factories[0];

// 1. ambiguidade stable/volatile nos 130 pares da DefiLlama
const body = (await (await fetch("https://yields.llama.fi/pools")).json()) as {
  data: { project: string; chain: string; symbol: string; tvlUsd: number; apyBase: number | null; underlyingTokens: string[] | null }[];
};
const linhas = body.data.filter((p) => p.project === "aerodrome-v1" && p.chain === "Base");
const res = await r.multicall({
  contracts: linhas.flatMap((l) =>
    [true, false].map((st) => ({
      address: V2_FACTORY,
      abi: factoryAbi,
      functionName: "getPool",
      args: [l.underlyingTokens![0], l.underlyingTokens![1], st],
    })),
  ),
  allowFailure: true,
});
const ZERO = "0x0000000000000000000000000000000000000000";
let so1 = 0, dois = 0, nenhum = 0;
linhas.forEach((_, i) => {
  const n = [res[i * 2], res[i * 2 + 1]].filter((x) => x.status === "success" && x.result !== ZERO).length;
  if (n === 1) so1++;
  else if (n === 2) dois++;
  else nenhum++;
});
console.log(`1. aerodrome-v1: ${linhas.length} linhas · um pool só ${so1} · stable E volatile ${dois} · nenhum ${nenhum}`);

// 2-3. um pool de verdade: o USDC/AERO volatile
const usdcAero = linhas.find((l) => l.symbol === "USDC-AERO")!;
const pool = (await r.readContract({
  address: V2_FACTORY,
  abi: factoryAbi,
  functionName: "getPool",
  args: [usdcAero.underlyingTokens![0], usdcAero.underlyingTokens![1], false],
})) as Address;
const ler = async (bn?: bigint) =>
  (
    await r.multicall({
      contracts: [
        { address: pool, abi: poolAbi, functionName: "index0" },
        { address: pool, abi: poolAbi, functionName: "index1" },
        { address: pool, abi: poolAbi, functionName: "totalSupply" },
        { address: pool, abi: poolAbi, functionName: "getReserves" },
        { address: MC3, abi: tsAbi, functionName: "getCurrentBlockTimestamp" },
      ],
      allowFailure: true,
      ...(bn === undefined ? {} : { blockNumber: bn }),
    })
  ).map((x) => x.result);
const head = await r.getBlockNumber!();
const agora = await ler();
const [sym, stable, t0, t1] = (
  await r.multicall({
    contracts: (["symbol", "stable", "token0", "token1"] as const).map((fn) => ({ address: pool, abi: poolAbi, functionName: fn })),
    allowFailure: true,
  })
).map((x) => x.result);
console.log(`2. pool ${pool} ${sym} stable=${stable} token0=${t0} token1=${t1}`);

const pr = (await (await fetch(`https://coins.llama.fi/prices/current/base:${t0},base:${t1}`)).json()) as {
  coins: Record<string, { price: number; decimals: number }>;
};
const p0 = Object.entries(pr.coins).find(([k]) => k.toLowerCase().endsWith((t0 as string).toLowerCase()))![1];
const p1 = Object.entries(pr.coins).find(([k]) => k.toLowerCase().endsWith((t1 as string).toLowerCase()))![1];
const [r0, r1] = agora[3] as readonly bigint[];
const tvl = (Number(r0) / 10 ** p0.decimals) * p0.price + (Number(r1) / 10 ** p1.decimals) * p1.price;
const supply = Number(agora[2] as bigint) / 1e18;
console.log(`   TVL on-chain US$ ${tvl.toFixed(0)} (DefiLlama ${usdcAero.tvlUsd.toFixed(0)}) · apyBase DefiLlama ${usdcAero.apyBase}%`);

for (const horas of [24, 0.25]) {
  try {
    const antes = await ler(head - BigInt(Math.round((horas * 3600) / 2)));
    const seg = Number((agora[4] as bigint) - (antes[4] as bigint));
    const d0 = Number((agora[0] as bigint) - (antes[0] as bigint)) / 1e18 / 10 ** p0.decimals;
    const d1 = Number((agora[1] as bigint) - (antes[1] as bigint)) / 1e18 / 10 ** p1.decimals;
    // taxa por LP token (unidade humana de LP = 1e18) em US$
    const porLp = d0 * 1e18 * p0.price + d1 * 1e18 * p1.price; // Δindex já é por 1e18 de LP cru
    const lp = 1000 / (tvl / supply); // LP tokens (humanos) de um depósito de US$ 1.000
    const fees = (porLp / 1e18) * lp * 1e18 * (supply / (supply + lp));
    const apr = ((fees / seg) * 365 * 86400 * 100) / 1000;
    console.log(`3. janela ${horas} h: ${seg}s provados · Δindex0 ${d0.toExponential(3)} · APR de taxas (sem stake) ${apr.toFixed(2)}%`);
  } catch (e) {
    console.log(`3. janela ${horas} h: ❌ ${(e as Error).message.split("\n")[0].slice(0, 80)}`);
  }
}

// 4. emissões: Voter pelo gauge de um pool CL conhecido (WETH/USDC CL100)
const clGauge = (await r.readContract({
  address: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59",
  abi: clPoolAbi,
  functionName: "gauge",
})) as Address;
const voter = (await r.readContract({ address: clGauge, abi: gaugeAbi, functionName: "voter" })) as Address;
const gauge = (await r.readContract({ address: voter, abi: voterAbi, functionName: "gauges", args: [pool] })) as Address;
const [rr, pf, gts] = (
  await r.multicall({
    contracts: (["rewardRate", "periodFinish", "totalSupply"] as const).map((fn) => ({ address: gauge, abi: gaugeAbi, functionName: fn })),
    allowFailure: true,
  })
).map((x) => x.result);
console.log(
  `4. voter ${voter} · gauge ${gauge} · rewardRate ${rr} · periodFinish ${new Date(Number(pf) * 1000).toISOString()} · LP em stake ${(Number(gts) / 1e18).toFixed(2)} de ${supply.toFixed(2)}`,
);
