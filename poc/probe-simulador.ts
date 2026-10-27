/**
 * PoC do simulador de APR (26/10/2026) — antes de tocar no site.
 *
 * Perguntas:
 * 1. Dá para reconhecer um pool só pelo endereço? (factory.getPool(t0,t1,x) == pool)
 * 2. Δ feeGrowthGlobal em 24 h / 15 min sai num bloco passado provado?
 * 3. O APR "em faixa" de uma faixa simulada bate com a ordem de grandeza do pool?
 * 4. A DefiLlama devolve histórico de preço (7 dias, de hora em hora) dos dois tokens?
 * 5. Slipstream: gauge(), rewardRate(), stakedLiquidity() legíveis?
 *
 *   npx tsx poc/probe-simulador.ts
 */

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { chainInfo } from "../core/chains";
import { poolLayout } from "../core/yields/onchain";

const Q128 = 2n ** 128n;
const YEAR = 365 * 86400;

const poolAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function tickSpacing() view returns (int24)",
  "function liquidity() view returns (uint128)",
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
  "function factory() view returns (address)",
]);
const slipAbi = parseAbi([
  "function gauge() view returns (address)",
  "function stakedLiquidity() view returns (uint128)",
]);
const gaugeAbi = parseAbi(["function rewardRate() view returns (uint256)", "function periodFinish() view returns (uint256)"]);
const uniFactory = parseAbi(["function getPool(address, address, uint24) view returns (address)"]);
const slipFactory = parseAbi(["function getPool(address, address, int24) view returns (address)"]);
const erc = parseAbi(["function decimals() view returns (uint8)", "function symbol() view returns (string)"]);
const tsAbi = parseAbi(["function getCurrentBlockTimestamp() view returns (uint256)"]);
const MC3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

interface Caso {
  nome: string;
  chainId: number;
  protocol: string;
  pool: Address;
  factory: Address;
  slip: boolean;
}

const CASOS: Caso[] = [
  {
    nome: "Uniswap v3 Base WETH/USDC 0,05%",
    chainId: 8453,
    protocol: "uniswap-v3",
    pool: "0xd0b53D9277642d899DF5C87A3966A349A798F224",
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    slip: false,
  },
  {
    nome: "Aerodrome Slipstream WETH/USDC CL100",
    chainId: 8453,
    protocol: "aerodrome",
    pool: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59",
    factory: "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
    slip: true,
  },
];

async function rodar(c: Caso) {
  console.log(`\n━━ ${c.nome}`);
  const r = createReader(c.chainId);
  const layout = poolLayout(c.protocol)!;
  const base = await r.multicall({
    contracts: [
      { address: c.pool, abi: poolAbi, functionName: "token0" },
      { address: c.pool, abi: poolAbi, functionName: "token1" },
      { address: c.pool, abi: poolAbi, functionName: "fee" },
      { address: c.pool, abi: poolAbi, functionName: "tickSpacing" },
      { address: c.pool, abi: poolAbi, functionName: "liquidity" },
      { address: c.pool, abi: layout.slot0Abi, functionName: "slot0" },
      { address: c.pool, abi: poolAbi, functionName: "factory" },
    ],
    allowFailure: true,
  });
  const [t0, t1, fee, ts, liq, s0, fac] = base.map((x) => x.result);
  console.log(`  token0 ${t0} token1 ${t1} fee ${fee} tickSpacing ${ts} L ${liq} tick ${(s0 as unknown[])?.[1]} factory() ${fac}`);

  const getPool = c.slip
    ? await r.readContract({ address: c.factory, abi: slipFactory, functionName: "getPool", args: [t0, t1, ts] })
    : await r.readContract({ address: c.factory, abi: uniFactory, functionName: "getPool", args: [t0, t1, fee] });
  console.log(`  1. factory.getPool == pool? ${(getPool as string).toLowerCase() === c.pool.toLowerCase() ? "✅" : "❌"} (${getPool})`);

  const [d0, d1, sy0, sy1] = (await r.multicall({
    contracts: [
      { address: t0 as Address, abi: erc, functionName: "decimals" },
      { address: t1 as Address, abi: erc, functionName: "decimals" },
      { address: t0 as Address, abi: erc, functionName: "symbol" },
      { address: t1 as Address, abi: erc, functionName: "symbol" },
    ],
    allowFailure: true,
  })).map((x) => x.result) as [number, number, string, string];

  // preços atuais
  const slug = chainInfo(c.chainId).priceSlug;
  const pr = (await (await fetch(`https://coins.llama.fi/prices/current/${slug}:${t0},${slug}:${t1}`)).json()) as {
    coins: Record<string, { price: number }>;
  };
  const p0 = pr.coins[`${slug}:${(t0 as string).toLowerCase()}`]?.price ?? pr.coins[`${slug}:${t0}`]?.price;
  const p1 = pr.coins[`${slug}:${(t1 as string).toLowerCase()}`]?.price ?? pr.coins[`${slug}:${t1}`]?.price;
  console.log(`  preços: ${sy0}=${p0} ${sy1}=${p1}`);

  const head = await r.getBlockNumber!();
  const ler = async (bn?: bigint) => {
    const x = await r.multicall({
      contracts: [
        { address: c.pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128" },
        { address: c.pool, abi: poolAbi, functionName: "feeGrowthGlobal1X128" },
        { address: MC3, abi: tsAbi, functionName: "getCurrentBlockTimestamp" },
      ],
      allowFailure: true,
      ...(bn === undefined ? {} : { blockNumber: bn }),
    });
    return x.map((y) => y.result as bigint);
  };
  const agora = await ler();
  for (const horas of [24, 0.25]) {
    const blocos = BigInt(Math.round((horas * 3600) / chainInfo(c.chainId).secPerBlock));
    try {
      const antes = await ler(head - blocos);
      const seg = Number(agora[2] - antes[2]);
      const g0 = agora[0] - antes[0];
      const g1 = agora[1] - antes[1];
      // taxas por unidade de L (1 L), em US$
      const usdPorL = (Number(g0) / Number(Q128) / 10 ** d0) * p0 + (Number(g1) / Number(Q128) / 10 ** d1) * p1;
      // simulação: faixa ±5% em volta do preço, US$ 1000 — L aproximado por fórmula fechada
      const P = Number((agora as unknown as bigint[]).length) && 0; // só para manter o tipo
      void P;
      const sqrtP = Math.sqrt(1.0001 ** Number((s0 as unknown[])[1]));
      const sa = sqrtP * Math.sqrt(0.95);
      const sb = sqrtP * Math.sqrt(1.05);
      // valor de 1 L (unidades cruas) em US$
      const a0 = (1 / sqrtP - 1 / sb) / 10 ** d0;
      const a1 = (sqrtP - sa) / 10 ** d1;
      const valor1L = a0 * p0 + a1 * p1;
      const L = 1000 / valor1L;
      const diluicao = Number(liq) / (Number(liq) + L);
      const feesUsd = usdPorL * L * diluicao;
      const apr = ((feesUsd / seg) * YEAR * 100) / 1000;
      console.log(
        `  2. janela ${horas} h: ✅ ${seg}s provados · US$ ${feesUsd.toFixed(4)} em US$ 1000 (±5%) → APR em faixa ${apr.toFixed(2)}% · diluição ${diluicao.toFixed(6)}`,
      );
    } catch (e) {
      console.log(`  2. janela ${horas} h: ❌ ${(e as Error).message.split("\n")[0].slice(0, 100)}`);
    }
  }

  // 4. histórico
  const start = Math.floor(Date.now() / 1000) - 7 * 86400;
  const url = `https://coins.llama.fi/chart/${slug}:${t0},${slug}:${t1}?start=${start}&span=169&period=1h`;
  const h = (await (await fetch(url)).json()) as { coins: Record<string, { prices: { timestamp: number; price: number }[] }> };
  for (const [k, v] of Object.entries(h.coins ?? {})) {
    const ps = v.prices.map((x) => x.price);
    console.log(`  4. ${k.slice(0, 20)}… ${v.prices.length} pontos, mín ${Math.min(...ps).toFixed(4)} máx ${Math.max(...ps).toFixed(4)}`);
  }

  if (c.slip) {
    const [g, sl] = (await r.multicall({
      contracts: [
        { address: c.pool, abi: slipAbi, functionName: "gauge" },
        { address: c.pool, abi: slipAbi, functionName: "stakedLiquidity" },
      ],
      allowFailure: true,
    })).map((x) => x.result);
    const [rr, pf] = (await r.multicall({
      contracts: [
        { address: g as Address, abi: gaugeAbi, functionName: "rewardRate" },
        { address: g as Address, abi: gaugeAbi, functionName: "periodFinish" },
      ],
      allowFailure: true,
    })).map((x) => x.result);
    console.log(`  5. gauge ${g} · stakedLiquidity ${sl} (de ${liq}) · rewardRate ${rr} · periodFinish ${new Date(Number(pf) * 1000).toISOString()}`);
  }
}

for (const c of CASOS) await rodar(c).catch((e) => console.log(`  ❌ ${(e as Error).message.split("\n")[0]}`));
