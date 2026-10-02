/**
 * PoC — PancakeSwap v3 na BNB Chain (chainId 56), com as posições em stake no
 * MasterChef v3. Rodar ANTES de tocar no site (convenção nº 3).
 *
 * Endereços da doc OFICIAL, lidos em 02/10/2026:
 *   developer.pancakeswap.finance/contracts/v3/addresses (BSC)
 *   developer.pancakeswap.finance/contracts/masterchef/masterchef-v3
 *
 * Prova, na ordem:
 *  1. o RPC responde e a rede é mesmo a 56;
 *  2. coerência de endereços: NFPM.factory(), NFPM.deployer() e
 *     MasterChef.nonfungiblePositionManager() batem com a doc;
 *  3. o layout do pool: `slot0()` da Pancake tem feeProtocol uint32 (a Uniswap
 *     tem uint8) — decodifica com os dois e compara; `ticks()` igual à Uniswap?
 *  4. posição FORA de stake: garimpa nos mints recentes uma carteira com
 *     liquidez e varre com o UniswapV3Adapter parametrizado (reaproveitamento);
 *  5. posição EM STAKE: o NFT mora no MasterChef. Garimpa um NFT dele, acha o
 *     dono em `userPositionInfos`, e prova que o MasterChef enumera os NFTs
 *     por dono (`balanceOf`/`tokenOfOwnerByIndex`), que `pendingCake` responde
 *     e que as TAXAS saem simulando `collect` no MasterChef;
 *  6. emissões: `getLatestPeriodInfo(pool)` (CAKE/s do pool), o LMPool e a
 *     liquidez em stake ativa — os insumos do "Earning now" de emissões;
 *  7. preço do CAKE na DefiLlama (chave `bsc:`).
 *
 * Nenhuma carteira fica neste arquivo: elas são achadas on-chain e impressas
 * abreviadas.
 *
 *   npx tsx poc/probe-pancake-v3.ts
 *   npx tsx --env-file=.env.local poc/probe-pancake-v3.ts   (usa BSC_RPC_URLS)
 */

export {}; // arquivo-script

import { createPublicClient, decodeFunctionResult, fallback, http, parseAbi, type Address, type Hex } from "viem";
import { bsc } from "viem/chains";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import type { UniV3ChainConfig } from "../core/adapters/uniswap-v3/config";
import type { ChainReader } from "../core/types";

const PANCAKE_V3_BSC = {
  factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as Address,
  poolDeployer: "0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9" as Address,
  nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364" as Address,
  masterChef: "0x556B9306565093C855AEA9AE92A594704c2Cd59e" as Address,
};

const rpcs = [
  ...(process.env.BSC_RPC_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-rpc.publicnode.com",
];
const client = createPublicClient({ chain: bsc, transport: fallback(rpcs.map((u) => http(u, { timeout: 30_000 }))) });
const reader = client as unknown as ChainReader;

const nfpmAbi = parseAbi([
  "function factory() view returns (address)",
  "function deployer() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);
const factoryAbi = parseAbi(["function getPool(address, address, uint24) view returns (address)"]);
const mcAbi = parseAbi([
  "function nonfungiblePositionManager() view returns (address)",
  "function CAKE() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
  "function userPositionInfos(uint256) view returns (uint128 liquidity, uint128 boostLiquidity, int24 tickLower, int24 tickUpper, uint256 rewardGrowthInside, uint256 reward, address user, uint256 pid, uint256 boostMultiplier)",
  "function poolInfo(uint256) view returns (uint256 allocPoint, address v3Pool, address token0, address token1, uint24 fee, uint256 totalLiquidity, uint256 totalBoostLiquidity)",
  "function pendingCake(uint256) view returns (uint256)",
  "function getLatestPeriodInfo(address) view returns (uint256 cakePerSecond, uint256 endTime)",
  "struct CollectParams { uint256 tokenId; address recipient; uint128 amount0Max; uint128 amount1Max; }",
  "function collect(CollectParams params) returns (uint256 amount0, uint256 amount1)",
]);
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function lmPool() view returns (address)",
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);
const uniSlot0Abi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);
const lmAbi = parseAbi(["function lmLiquidity() view returns (uint128)"]);
const MAX128 = (1n << 128n) - 1n;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ok = (b: boolean) => (b ? "✅" : "❌");
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function main() {
  console.log(`RPCs: ${rpcs.length} (${process.env.BSC_RPC_URLS ? "com BSC_RPC_URLS" : "só públicos"})\n`);

  // 1. rede
  const chainId = await client.getChainId();
  const head = await client.getBlockNumber();
  console.log(`1. ${ok(chainId === 56)} chainId ${chainId} · bloco ${head}`);

  // 2. coerência de endereços
  const [f, d, mcNfpm, cake] = await Promise.all([
    client.readContract({ address: PANCAKE_V3_BSC.nfpm, abi: nfpmAbi, functionName: "factory" }),
    client.readContract({ address: PANCAKE_V3_BSC.nfpm, abi: nfpmAbi, functionName: "deployer" }),
    client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "nonfungiblePositionManager" }),
    client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "CAKE" }),
  ]);
  console.log(`2. ${ok(eq(f, PANCAKE_V3_BSC.factory))} NFPM.factory() = doc`);
  console.log(`   ${ok(eq(d, PANCAKE_V3_BSC.poolDeployer))} NFPM.deployer() = doc`);
  console.log(`   ${ok(eq(mcNfpm, PANCAKE_V3_BSC.nfpm))} MasterChef.nonfungiblePositionManager() = doc`);
  console.log(`   CAKE = ${cake}`);

  // 4. posição FORA de stake, nos mints recentes
  const total = await client.readContract({ address: PANCAKE_V3_BSC.nfpm, abi: nfpmAbi, functionName: "totalSupply" });
  console.log(`\n   NFPM.totalSupply = ${total}`);
  let livre = null as { owner: Address; tokenId: bigint } | null;
  let staked = null as { tokenId: bigint } | null;
  for (let k = 1n; k <= 300n && (!livre || !staked); k += 20n) {
    const idxs = Array.from({ length: 20 }, (_, i) => total - k - BigInt(i)).filter((i) => i >= 0n);
    const ids = await client.multicall({
      contracts: idxs.map((i) => ({ address: PANCAKE_V3_BSC.nfpm, abi: nfpmAbi, functionName: "tokenByIndex", args: [i] })),
      allowFailure: true,
    });
    const tokenIds = ids.filter((r) => r.status === "success").map((r) => r.result as bigint);
    const res = await client.multicall({
      contracts: tokenIds.flatMap((id) => [
        { address: PANCAKE_V3_BSC.nfpm, abi: nfpmAbi, functionName: "ownerOf", args: [id] },
        { address: PANCAKE_V3_BSC.nfpm, abi: nfpmAbi, functionName: "positions", args: [id] },
      ]),
      allowFailure: true,
    });
    for (const [i, id] of tokenIds.entries()) {
      const o = res[i * 2];
      const p = res[i * 2 + 1];
      if (o.status !== "success" || p.status !== "success") continue;
      const liq = (p.result as unknown as readonly unknown[])[7] as bigint;
      if (liq === 0n) continue;
      const owner = o.result as Address;
      if (eq(owner, PANCAKE_V3_BSC.masterChef)) staked ??= { tokenId: id };
      else livre ??= { owner, tokenId: id };
    }
  }

  if (livre) {
    console.log(`\n4. Fora de stake — carteira ${short(livre.owner)} (NFT #${livre.tokenId})`);
    const cfg: UniV3ChainConfig = { chainId: 56, factory: PANCAKE_V3_BSC.factory, nfpm: PANCAKE_V3_BSC.nfpm };
    const avisos: string[] = [];
    const ad = new UniswapV3Adapter(reader, { config: cfg, onWarn: (m) => avisos.push(m) });
    const t = Date.now();
    const ps = await ad.getPositions(livre.owner);
    console.log(`   ${ok(ps.length > 0)} UniswapV3Adapter reaproveitado: ${ps.length} posição(ões) em ${Date.now() - t} ms`);
    for (const p of ps.slice(0, 3)) {
      console.log(`   · ${p.poolSymbol} #${p.positionId} inRange=${p.range?.inRange} tick=${p.range?.tickCurrent} a0=${p.amount0Raw} a1=${p.amount1Raw} taxas=${p.rewards.map((r) => `${r.raw} ${r.token.symbol}`).join(" + ") || "0"}`);
    }
    if (avisos.length) console.log("   avisos:", avisos);

    // 3. layout do pool (usa o pool da primeira posição)
    const pool = ps[0]?.poolAddress as Address | undefined;
    if (pool) {
      const raw = (await client.call({ to: pool, data: "0x3850c7bd" as Hex })).data!; // slot0()
      const pan = decodeFunctionResult({ abi: poolAbi, functionName: "slot0", data: raw }) as readonly unknown[];
      let uniOk = "decodificou";
      try {
        const uni = decodeFunctionResult({ abi: uniSlot0Abi, functionName: "slot0", data: raw }) as readonly unknown[];
        uniOk = `decodificou, feeProtocol=${uni[5]} (Pancake: ${pan[5]})`;
      } catch (e) {
        uniOk = `FALHOU (${(e as Error).message.slice(0, 80)})`;
      }
      console.log(`\n3. slot0 Pancake: tick=${pan[1]} feeProtocol(uint32)=${pan[5]} · com ABI da Uniswap: ${uniOk}`);
      const tl = ps[0].range!.tickLower;
      const [tick, fg] = await Promise.all([
        client.readContract({ address: pool, abi: poolAbi, functionName: "ticks", args: [tl] }),
        client.readContract({ address: pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128" }),
      ]);
      console.log(`   ${ok(Boolean(tick[7]))} ticks(${tl}) no layout da Uniswap: initialized=${tick[7]} fgOutside0=${tick[2]} · feeGrowthGlobal0=${fg > 0n}`);
    }
  } else {
    console.log("\n4. ❌ nenhuma posição fora de stake com liquidez nos 300 mints mais recentes");
  }

  // 5. posição EM STAKE
  if (!staked) {
    console.log("\n5. ❌ nenhum NFT recente com liquidez está no MasterChef");
    return;
  }
  const info = await client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "userPositionInfos", args: [staked.tokenId] });
  const user = info[6];
  console.log(`\n5. Em stake — NFT #${staked.tokenId}, dono ${short(user)} (pid ${info[7]}, boost ${info[8]})`);
  const nStaked = await client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "balanceOf", args: [user] });
  const ids = await Promise.all(
    Array.from({ length: Number(nStaked > 20n ? 20n : nStaked) }, (_, i) =>
      client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "tokenOfOwnerByIndex", args: [user, BigInt(i)] }),
    ),
  );
  console.log(`   ${ok(ids.some((x) => x === staked!.tokenId))} MasterChef enumera por dono: balanceOf=${nStaked}, NFT achado na lista`);
  const nLivres = await client.readContract({ address: PANCAKE_V3_BSC.nfpm, abi: nfpmAbi, functionName: "balanceOf", args: [user] });
  console.log(`   (a mesma carteira tem ${nLivres} NFT(s) fora de stake no NFPM — o adapter precisa somar as duas listas)`);

  const pos = await client.readContract({ address: PANCAKE_V3_BSC.nfpm, abi: nfpmAbi, functionName: "positions", args: [staked.tokenId] });
  console.log(`   positions(): liq=${pos[7]} · userPositionInfos.liquidity=${info[0]} · ${ok(pos[7] === info[0])} iguais`);

  const pending = await client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "pendingCake", args: [staked.tokenId] });
  console.log(`   ✅ pendingCake = ${pending} (wei de CAKE)`);

  try {
    const sim = await client.simulateContract({
      address: PANCAKE_V3_BSC.masterChef,
      abi: mcAbi,
      functionName: "collect",
      args: [{ tokenId: staked.tokenId, recipient: user, amount0Max: MAX128, amount1Max: MAX128 }],
      account: user,
    });
    console.log(`   ✅ taxas via collect() simulado no MasterChef: ${sim.result[0]} / ${sim.result[1]} (tokensOwed no NFPM: ${pos[10]} / ${pos[11]})`);
  } catch (e) {
    console.log(`   ❌ collect() simulado no MasterChef falhou: ${(e as Error).message.split("\n")[0].slice(0, 140)}`);
  }

  // 6. emissões
  const pi = await client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "poolInfo", args: [info[7]] });
  const v3Pool = pi[1];
  const [period, lm, poolLiq] = await Promise.all([
    client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "getLatestPeriodInfo", args: [v3Pool] }),
    client.readContract({ address: v3Pool, abi: poolAbi, functionName: "lmPool" }),
    client.readContract({ address: v3Pool, abi: poolAbi, functionName: "liquidity" }),
  ]);
  const lmLiq = await client.readContract({ address: lm, abi: lmAbi, functionName: "lmLiquidity" });
  const fim = new Date(Number(period[1]) * 1000).toISOString();
  console.log(`\n6. pool ${short(v3Pool)} · allocPoint ${pi[0]} · cakePerSecond(cru) ${period[0]} · período até ${fim}`);
  // arquivo: estado de ~24 h atrás num pool ANTIGO (o do item 4 pode ter
  // nascido hoje, e aí "sem dado" seria do pool, não do RPC). BNB ≈ 0,45 s/bloco.
  try {
    await client.readContract({ address: v3Pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128", blockNumber: head - 191_000n });
    console.log(`   ✅ estado de ~24 h atrás respondeu — fee APR on-chain viável neste RPC`);
  } catch (e) {
    console.log(`   ❌ estado de ~24 h atrás recusado (RPC sem arquivo): ${(e as Error).message.split("\n")[0].slice(0, 100)}`);
  }
  console.log(`   LMPool ${short(lm)} · lmLiquidity (stake ativo) ${lmLiq} · liquidity do pool ${poolLiq} · boostLiquidity da posição ${info[1]}`);
  // 6b. escala do cakePerSecond: prever o ritmo do pendingCake da posição e
  // medir de verdade. Só vale com a posição dentro da faixa (fora, rende 0).
  const s0 = await client.readContract({ address: v3Pool, abi: poolAbi, functionName: "slot0" });
  const dentro = s0[1] >= info[2] && s0[1] < info[3];
  if (!dentro || lmLiq === 0n) {
    console.log(`   (posição fora da faixa — sem como conferir a escala por aqui)`);
  } else {
    const previsto = (Number(period[0]) / 1e12) * (Number(info[1]) / Number(lmLiq)); // wei de CAKE por segundo
    const b0 = await client.getBlock();
    const p0 = await client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "pendingCake", args: [staked.tokenId] });
    await new Promise((r) => setTimeout(r, 60_000));
    const b1 = await client.getBlock();
    const p1 = await client.readContract({ address: PANCAKE_V3_BSC.masterChef, abi: mcAbi, functionName: "pendingCake", args: [staked.tokenId] });
    const dt = Number(b1.timestamp - b0.timestamp);
    const medido = Number(p1 - p0) / dt;
    console.log(`   6b. CAKE/s da posição: previsto (cakePerSecond ÷ 1e12 × boostLiq ÷ lmLiquidity) ${previsto.toExponential(3)} · medido em ${dt} s ${medido.toExponential(3)} · razão ${(medido / previsto).toFixed(3)}`);
    console.log(`       tempo de bloco medido: ${(dt / Number(b1.number - b0.number)).toFixed(3)} s`);
  }

  // 7. preço do CAKE
  const r = await fetch(`https://coins.llama.fi/prices/current/bsc:${cake}`);
  const j = (await r.json()) as { coins: Record<string, { price: number; symbol: string }> };
  const c = Object.values(j.coins)[0];
  console.log(`\n7. ${ok(Boolean(c))} DefiLlama bsc:CAKE = ${c ? `US$ ${c.price} (${c.symbol})` : "sem preço"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
