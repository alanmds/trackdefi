/**
 * PoC do Aero (fusão Aerodrome + Velodrome, no ar desde 22/10/2026) na Base.
 * Rodar ANTES de tocar no site (convenção 3).
 *
 * Endereços: página oficial https://app.aero.xyz/docs/security (lida em
 * 31/10/2026). Cada um é conferido on-chain aqui — nada de memória.
 *
 *   npx tsx poc/probe-aero.ts [0xCARTEIRA ...]
 */

export {}; // arquivo-script

import { createPublicClient, erc20Abi, fallback, http, parseAbi, type Address } from "viem";
import { base } from "viem/chains";

const A = {
  aero: "0x3f5bF3EdAc59d650D8fDf9657a71F2f904A3a4Ee",
  voter: "0x49d7d4f17Ec56Ef8fA04E464AF5D1A4942CC31e6",
  ve: "0xBF7977E1521e9a3032bf7243Ee4712f311f13915",
  factoryVolatile: "0x8E6a9FCd1d638CC760Ffba397605Fe3355dE76D2",
  factoryStable: "0x78589E876edcEbdce72ee3436ab3c9AD3a7cEF2D",
  clFactory: "0x9CB220581b91b0C83223012FE69688b92aD07a76",
  nfpm: "0x4857DB576eE0e45F10525eC59527BfD10beeC60b",
  clGaugeFactory: "0xf437f62053ACB121665b8fDBfeA8F214FB8E589d",
  xaero: "0x6CdDa0E730744DC6fF67654B35350Adad05EceE7",
} as const satisfies Record<string, Address>;

const WALLETS: Address[] = process.argv.slice(2).length
  ? (process.argv.slice(2) as Address[])
  : ["0x08FAb21333012A97c85a6F5dBf8e28eD304ab7f3", "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac"];

const client = createPublicClient({
  chain: base,
  transport: fallback(
    ["https://mainnet.base.org", "https://base-rpc.publicnode.com"].map((u) => http(u)),
  ),
});

const abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function allPoolsLength() view returns (uint256)",
  "function allPools(uint256) view returns (address)",
  "function factory() view returns (address)",
  "function voter() view returns (address)",
  "function gauges(address) view returns (address)",
  "function isAlive(address) view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function getPool(address,address,int24) view returns (address)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function tickSpacing() view returns (int24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
  "function gauge() view returns (address)",
  "function rewardToken() view returns (address)",
  "function periodFinish() view returns (uint256)",
  "function rewardRate() view returns (uint256)",
  "function nft() view returns (address)",
  "function stakedContains(address,uint256) view returns (bool)",
  "function stakedValues(address) view returns (uint256[])",
  "function earned(address,uint256) view returns (uint256)",
  "function fees0() view returns (uint256)",
]);

const read = (address: Address, functionName: string, args: unknown[] = []) =>
  client.readContract({ address, abi, functionName: functionName as never, args: args as never }) as Promise<any>;
const tryRead = async (address: Address, fn: string, args: unknown[] = []) => {
  try {
    return await read(address, fn, args);
  } catch (e) {
    return `ERRO: ${(e as Error).message.split("\n")[0]}`;
  }
};

async function main() {
  console.log("== 1. bytecode e identidade (Base, chainId", await client.getChainId(), ")");
  for (const [k, addr] of Object.entries(A)) {
    const code = await client.getCode({ address: addr });
    console.log(`  ${k.padEnd(16)} ${addr}  bytecode=${code ? (code.length - 2) / 2 : 0}B`);
  }
  console.log("  AERO symbol/name :", await tryRead(A.aero, "symbol"), "/", await tryRead(A.aero, "name"));
  console.log("  AERO decimals    :", await client.readContract({ address: A.aero, abi: erc20Abi, functionName: "decimals" }));
  console.log("  VE name/symbol   :", await tryRead(A.ve, "name"), "/", await tryRead(A.ve, "symbol"));
  console.log("  VE.voter()       :", await tryRead(A.ve, "voter"), "(esperado", A.voter + ")");
  console.log("  xAERO symbol     :", await tryRead(A.xaero, "symbol"));
  console.log("  NFPM name        :", await tryRead(A.nfpm, "name"));
  console.log("  NFPM.factory()   :", await tryRead(A.nfpm, "factory"), "(esperado", A.clFactory + ")");
  console.log("  v2 vol/stable allPoolsLength:", await tryRead(A.factoryVolatile, "allPoolsLength"), "/", await tryRead(A.factoryStable, "allPoolsLength"));
  const clLen = await tryRead(A.clFactory, "allPoolsLength");
  console.log("  CLFactory allPoolsLength:", clLen);

  console.log("\n== 2. pools CL: ABI Slipstream (tickSpacing, slot0 de 6 campos), gauge e emissão");
  const n = typeof clLen === "bigint" ? Number(clLen) : 0;
  for (let i = 0; i < Math.min(n, 6); i++) {
    const pool = (await read(A.clFactory, "allPools", [BigInt(i)])) as Address;
    const [t0, t1, ts, liq, s0, g] = await Promise.all([
      tryRead(pool, "token0"), tryRead(pool, "token1"), tryRead(pool, "tickSpacing"),
      tryRead(pool, "liquidity"), tryRead(pool, "slot0"), tryRead(A.voter, "gauges", [pool]),
    ]);
    console.log(`  pool ${pool} ts=${ts} liq=${liq}\n    slot0=${Array.isArray(s0) ? `tick ${s0[1]} (${s0.length} campos)` : s0}\n    gauge=${g}`);
    if (typeof g === "string" && g.startsWith("0x") && !/^0x0+$/.test(g)) {
      console.log(
        `    gauge: isAlive=${await tryRead(A.voter, "isAlive", [g])} rewardToken=${await tryRead(g as Address, "rewardToken")} nft=${await tryRead(g as Address, "nft")} periodFinish=${await tryRead(g as Address, "periodFinish")} rewardRate=${await tryRead(g as Address, "rewardRate")}`,
      );
    }
  }

  console.log("\n== 3. carteiras: NFTs do position manager");
  for (const w of WALLETS) {
    const bal = await tryRead(A.nfpm, "balanceOf", [w]);
    console.log(`  ${w}  NFPM.balanceOf=${bal}  veAERO(novo).balanceOf=${await tryRead(A.ve, "balanceOf", [w])}`);
    if (typeof bal !== "bigint") continue;
    for (let i = 0; i < Math.min(Number(bal), 8); i++) {
      const id = (await read(A.nfpm, "tokenOfOwnerByIndex", [w, BigInt(i)])) as bigint;
      const p = await tryRead(A.nfpm, "positions", [id]);
      if (!Array.isArray(p)) { console.log("   ", id, p); continue; }
      const [, , t0, t1, ts, lo, hi, liq, , , o0, o1] = p;
      const pool = await tryRead(A.clFactory, "getPool", [t0, t1, ts]);
      const gauge = typeof pool === "string" && pool.startsWith("0x") ? await tryRead(A.voter, "gauges", [pool]) : "—";
      console.log(`   #${id} ${t0}/${t1} ts=${ts} [${lo},${hi}] liq=${liq} owed=${o0}/${o1}\n      pool=${pool} gauge=${gauge}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

/** 4. ticks() do pool CL no layout Slipstream (10 campos) — base do fee APR on-chain */
async function probeTicks() {
  const len = (await read(A.clFactory, "allPoolsLength")) as bigint;
  const pool = (await read(A.clFactory, "allPools", [len - 1n])) as Address; // pool recente
  const best = (await read(A.clFactory, "allPools", [0n])) as Address;
  for (const p of [best, pool]) {
    const s0 = await client.readContract({ address: p, abi, functionName: "slot0" });
    const ts = Number(await read(p, "tickSpacing"));
    const tick = Math.floor(Number(s0[1]) / ts) * ts;
    const ticksAbi = parseAbi([
      "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, int128 stakedLiquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, uint256 rewardGrowthOutsideX128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
      "function feeGrowthGlobal0X128() view returns (uint256)",
    ]);
    const g0 = await client.readContract({ address: p, abi: ticksAbi, functionName: "feeGrowthGlobal0X128" });
    const t = await client.readContract({ address: p, abi: ticksAbi, functionName: "ticks", args: [tick] });
    console.log(`  ticks(${tick}) em ${p}: gross=${t[0]} initialized=${t[9]} feeOut0=${t[3]} global0=${g0} (outside <= global: ${t[3] <= g0})`);
  }
}
probeTicks().catch((e) => console.log("  ticks ERRO", e.message.split("\n")[0]));
