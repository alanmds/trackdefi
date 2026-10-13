/**
 * PoC — PancakeSwap v3 por rede (BNB Chain, Ethereum, Base e Arbitrum One),
 * com as posições EM STAKE no MasterChef v3. Rodar ANTES de tocar no site
 * (convenção nº 3 do guia).
 *
 * Endereços da doc OFICIAL, lidos em 12/10/2026:
 *   developer.pancakeswap.finance/contracts/v3/addresses      (factory, PoolDeployer,
 *       NonfungiblePositionManager e MasterChefV3 por rede)
 *   developer.pancakeswap.finance/contracts/masterchef/masterchef-v3
 *       (API do MasterChefV3: userPositionInfos, pendingCake, getLatestPeriodInfo…)
 *   developer.pancakeswap.finance/contracts/cake              (endereço do CAKE por rede)
 *
 * O que este script prova, para a rede pedida:
 *  1. o RPC responde e a rede é mesmo a esperada;
 *  2. coerência de endereços: NFPM.factory(), NFPM.deployer(),
 *     MasterChef.nonfungiblePositionManager() e MasterChef.CAKE() batem com a doc;
 *  3. uma carteira com posição FORA de stake é achada sozinha (garimpo nos mints
 *     recentes) e varrida pelo adapter — nenhum endereço de carteira neste arquivo;
 *  4. uma posição EM STAKE é achada do mesmo jeito: o NFT mora no MasterChef, que
 *     enumera por dono (balanceOf/tokenOfOwnerByIndex); pendingCake responde e as
 *     taxas saem simulando collect no MasterChef;
 *  5. emissões: prova do ritmo — a previsão (cakePerSecond ÷ 1e12 × boostLiquidity
 *     ÷ LMPool.lmLiquidity()) contra o que o contrato paga de fato, medido por
 *     `harvest` SIMULADO em dois instantes (e, ao lado, pelo `pendingCake`, que
 *     NÃO serve sozinho: ele se atualiza no último estado do LMPool);
 *  6. preço do CAKE na DefiLlama.
 *
 * Uso:
 *   npx tsx poc/probe-pancake-v3.ts                 # BNB Chain (como antes)
 *   npx tsx poc/probe-pancake-v3.ts bsc|eth|base|arb
 *   npx tsx --env-file=.env.local poc/probe-pancake-v3.ts arb   (usa *_RPC_URLS)
 *
 * Nenhuma carteira fica neste arquivo: elas são achadas on-chain e impressas
 * abreviadas.
 */

export {}; // arquivo-script

import { createPublicClient, decodeFunctionResult, fallback, http, parseAbi, type Address, type Chain, type Hex } from "viem";
import { arbitrum, base, bsc, mainnet } from "viem/chains";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import type { UniV3ChainConfig } from "../core/adapters/uniswap-v3/config";
import type { ChainReader } from "../core/types";

/** Uma rede da doc oficial da PancakeSwap v3 (lida em 12/10/2026). */
interface RedeDoc {
  chainId: number;
  chain: Chain;
  /** env que injeta o RPC dedicado (campo rpcEnv de core/chains.ts) */
  rpcEnv: string;
  /** reservas públicas, na mesma ordem de core/chains.ts */
  publicos: string[];
  /** endereços CONFORME a doc oficial */
  factory: Address;
  poolDeployer: Address;
  nfpm: Address;
  masterChef: Address;
  cake: Address;
  /** blocos em ~24 h — para a prova de que o RPC serve estado passado */
  blocosPorDia: bigint;
  /** slug de preço da DefiLlama (core/chains.ts priceSlug) */
  precoSlug: string;
}

/**
 * A doc (12/10/2026) diz: factory e PoolDeployer IGUAIS nas quatro redes;
 * NonfungiblePositionManager IGUAL nas quatro (BSC, ETH, Arbitrum, Base — a
 * tabela de Periphery lista as quatro na mesma coluna); MasterChefV3 igual só
 * em BSC/ETH, com Arbitrum e Base tendo o seu; e o CAKE com endereço próprio em
 * cada rede (página contracts/cake). Nada aqui é de memória: cada linha foi
 * lida na doc e é conferida on-chain no passo 2.
 */
const REDES: Record<string, RedeDoc> = {
  bsc: {
    chainId: 56,
    chain: bsc,
    rpcEnv: "BSC_RPC_URLS",
    publicos: ["https://bsc-dataseed.bnbchain.org", "https://bsc-rpc.publicnode.com"],
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    poolDeployer: "0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    masterChef: "0x556B9306565093C855AEA9AE92A594704c2Cd59e",
    cake: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    blocosPorDia: 191_000n,
    precoSlug: "bsc",
  },
  eth: {
    chainId: 1,
    chain: mainnet,
    rpcEnv: "ETHEREUM_RPC_URLS",
    publicos: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com"],
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    poolDeployer: "0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    masterChef: "0x556B9306565093C855AEA9AE92A594704c2Cd59e",
    cake: "0x152649eA73beAb28c5b49B26eb48f7EAD6d4c898",
    blocosPorDia: 7_200n,
    precoSlug: "ethereum",
  },
  base: {
    chainId: 8453,
    chain: base,
    rpcEnv: "BASE_RPC_URLS",
    publicos: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://base.llamarpc.com"],
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    poolDeployer: "0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    masterChef: "0xC6A2Db661D5a5690172d8eB0a7DEA2d3008665A3",
    cake: "0x3055913c90Fcc1A6CE9a358911721eEb942013A1",
    blocosPorDia: 43_200n,
    precoSlug: "base",
  },
  arb: {
    chainId: 42161,
    chain: arbitrum,
    rpcEnv: "ARBITRUM_RPC_URLS",
    publicos: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com", "https://arbitrum.llamarpc.com"],
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    poolDeployer: "0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    masterChef: "0x5e09ACf80C0296740eC5d6F643005a4ef8DaA694",
    cake: "0x1b896893dfc86bb67Cf57767298b9073D2c1bA2c",
    blocosPorDia: 345_600n,
    precoSlug: "arbitrum",
  },
};

const aliases: Record<string, string> = {
  bsc: "bsc",
  bnb: "bsc",
  "bnb chain": "bsc",
  eth: "eth",
  ethereum: "eth",
  mainnet: "eth",
  base: "base",
  arb: "arb",
  arbitrum: "arb",
};

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
const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);
const MAX128 = (1n << 128n) - 1n;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ok = (b: boolean) => (b ? "✅" : "❌");
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function main() {
  const pedido = (process.argv[2] ?? "bsc").toLowerCase();
  const chave = aliases[pedido];
  if (!chave) {
    console.error(`Rede desconhecida: "${pedido}". Use: ${Object.keys(REDES).join(", ")}`);
    process.exit(1);
  }
  const rede = REDES[chave];

  const rpcs = [
    ...(process.env[rede.rpcEnv] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    ...rede.publicos,
  ];
  const client = createPublicClient({ chain: rede.chain, transport: fallback(rpcs.map((u) => http(u, { timeout: 30_000 }))) });
  const reader = client as unknown as ChainReader;

  console.log(`Rede ${rede.chain.name} (chainId ${rede.chainId}) · RPCs: ${rpcs.length} (${process.env[rede.rpcEnv] ? `com ${rede.rpcEnv}` : "só públicos"})\n`);

  // 1. rede
  const chainId = await client.getChainId();
  const head = await client.getBlockNumber();
  console.log(`1. ${ok(chainId === rede.chainId)} chainId ${chainId} · bloco ${head}`);

  // 2. coerência de endereços contra a doc oficial
  const [f, d, mcNfpm, cake] = await Promise.all([
    client.readContract({ address: rede.nfpm, abi: nfpmAbi, functionName: "factory" }),
    client.readContract({ address: rede.nfpm, abi: nfpmAbi, functionName: "deployer" }),
    client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "nonfungiblePositionManager" }),
    client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "CAKE" }),
  ]);
  console.log(`2. ${ok(eq(f, rede.factory))} NFPM.factory() = doc`);
  console.log(`   ${ok(eq(d, rede.poolDeployer))} NFPM.deployer() = doc`);
  console.log(`   ${ok(eq(mcNfpm, rede.nfpm))} MasterChef.nonfungiblePositionManager() = doc`);
  console.log(`   ${ok(eq(cake, rede.cake))} MasterChef.CAKE() = doc (${cake})`);
  try {
    const [sym, dec] = await Promise.all([
      client.readContract({ address: cake, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: cake, abi: erc20Abi, functionName: "decimals" }),
    ]);
    console.log(`   CAKE on-chain: "${sym}", ${dec} casas`);
  } catch (e) {
    console.log(`   ❌ CAKE não respondeu symbol()/decimals(): ${(e as Error).message.split("\n")[0].slice(0, 120)}`);
  }

  // 3. posição FORA de stake, nos mints recentes
  const total = await client.readContract({ address: rede.nfpm, abi: nfpmAbi, functionName: "totalSupply" });
  console.log(`\n   NFPM.totalSupply = ${total}`);
  let livre = null as { owner: Address; tokenId: bigint } | null;
  let staked = null as { tokenId: bigint } | null;
  for (let k = 1n; k <= 300n && (!livre || !staked); k += 20n) {
    const idxs = Array.from({ length: 20 }, (_, i) => total - k - BigInt(i)).filter((i) => i >= 0n);
    const ids = await client.multicall({
      contracts: idxs.map((i) => ({ address: rede.nfpm, abi: nfpmAbi, functionName: "tokenByIndex", args: [i] })),
      allowFailure: true,
    });
    const tokenIds = ids.filter((r) => r.status === "success").map((r) => r.result as bigint);
    const res = await client.multicall({
      contracts: tokenIds.flatMap((id) => [
        { address: rede.nfpm, abi: nfpmAbi, functionName: "ownerOf", args: [id] },
        { address: rede.nfpm, abi: nfpmAbi, functionName: "positions", args: [id] },
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
      if (eq(owner, rede.masterChef)) staked ??= { tokenId: id };
      else livre ??= { owner, tokenId: id };
    }
  }

  if (livre) {
    console.log(`\n3. Fora de stake — carteira ${short(livre.owner)} (NFT #${livre.tokenId})`);
    // endereço completo SÓ na tela (nunca no arquivo): é o que o passo seguinte
    // — `npx tsx --env-file=.env.local poc/positions.ts 0x…` — pede.
    console.log(`   endereço completo: ${livre.owner}`);
    const cfg: UniV3ChainConfig = { chainId: rede.chainId, factory: rede.factory, nfpm: rede.nfpm };
    const avisos: string[] = [];
    const ad = new UniswapV3Adapter(reader, { config: cfg, onWarn: (m) => avisos.push(m) });
    const t = Date.now();
    const ps = await ad.getPositions(livre.owner);
    console.log(`   ${ok(ps.length > 0)} UniswapV3Adapter reaproveitado: ${ps.length} posição(ões) em ${Date.now() - t} ms`);
    for (const p of ps.slice(0, 3)) {
      console.log(`   · ${p.poolSymbol} #${p.positionId} inRange=${p.range?.inRange} tick=${p.range?.tickCurrent} a0=${p.amount0Raw} a1=${p.amount1Raw} taxas=${p.rewards.map((r) => `${r.raw} ${r.token.symbol}`).join(" + ") || "0"}`);
    }
    if (avisos.length) console.log("   avisos:", avisos);

    // 4. layout do pool (usa o pool da primeira posição)
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
      console.log(`\n4. slot0 Pancake: tick=${pan[1]} feeProtocol(uint32)=${pan[5]} · com ABI da Uniswap: ${uniOk}`);
      const tl = ps[0].range!.tickLower;
      const [tick, fg] = await Promise.all([
        client.readContract({ address: pool, abi: poolAbi, functionName: "ticks", args: [tl] }),
        client.readContract({ address: pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128" }),
      ]);
      console.log(`   ${ok(Boolean(tick[7]))} ticks(${tl}) no layout da Uniswap: initialized=${tick[7]} fgOutside0=${tick[2]} · feeGrowthGlobal0=${fg > 0n}`);
    }
  } else {
    console.log("\n3. ❌ nenhuma posição fora de stake com liquidez nos 300 mints mais recentes");
  }

  // 5. posição EM STAKE
  if (!staked) {
    console.log("\n5. ❌ nenhum NFT recente com liquidez está no MasterChef");
    return;
  }
  const info = await client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "userPositionInfos", args: [staked.tokenId] });
  const user = info[6];
  console.log(`\n5. Em stake — NFT #${staked.tokenId}, dono ${short(user)} (pid ${info[7]}, boost ${info[8]})`);
  console.log(`   endereço completo: ${user}`);
  const nStaked = await client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "balanceOf", args: [user] });
  const ids = await Promise.all(
    Array.from({ length: Number(nStaked > 20n ? 20n : nStaked) }, (_, i) =>
      client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "tokenOfOwnerByIndex", args: [user, BigInt(i)] }),
    ),
  );
  console.log(`   ${ok(ids.some((x) => x === staked!.tokenId))} MasterChef enumera por dono: balanceOf=${nStaked}, NFT achado na lista`);
  const nLivres = await client.readContract({ address: rede.nfpm, abi: nfpmAbi, functionName: "balanceOf", args: [user] });
  console.log(`   (a mesma carteira tem ${nLivres} NFT(s) fora de stake no NFPM — o adapter precisa somar as duas listas)`);

  const pos = await client.readContract({ address: rede.nfpm, abi: nfpmAbi, functionName: "positions", args: [staked.tokenId] });
  console.log(`   positions(): liq=${pos[7]} · userPositionInfos.liquidity=${info[0]} · ${ok(pos[7] === info[0])} iguais`);

  const pending = await client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "pendingCake", args: [staked.tokenId] });
  console.log(`   ✅ pendingCake = ${pending} (wei de CAKE)`);

  try {
    const sim = await client.simulateContract({
      address: rede.masterChef,
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
  const pi = await client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "poolInfo", args: [info[7]] });
  const v3Pool = pi[1];
  const [period, lm, poolLiq] = await Promise.all([
    client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "getLatestPeriodInfo", args: [v3Pool] }),
    client.readContract({ address: v3Pool, abi: poolAbi, functionName: "lmPool" }),
    client.readContract({ address: v3Pool, abi: poolAbi, functionName: "liquidity" }),
  ]);
  const lmLiq = await client.readContract({ address: lm, abi: lmAbi, functionName: "lmLiquidity" });
  const fim = new Date(Number(period[1]) * 1000).toISOString();
  console.log(`\n6. pool ${short(v3Pool)} · allocPoint ${pi[0]} · cakePerSecond(cru) ${period[0]} · período até ${fim}`);
  // arquivo: estado de ~24 h atrás num pool ANTIGO (o do item 3 pode ter
  // nascido hoje, e aí "sem dado" seria do pool, não do RPC).
  try {
    await client.readContract({ address: v3Pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128", blockNumber: head - rede.blocosPorDia });
    console.log(`   ✅ estado de ~24 h atrás respondeu — fee APR on-chain viável neste RPC`);
  } catch (e) {
    console.log(`   ❌ estado de ~24 h atrás recusado (RPC sem arquivo): ${(e as Error).message.split("\n")[0].slice(0, 100)}`);
  }
  console.log(`   LMPool ${short(lm)} · lmLiquidity (stake ativo) ${lmLiq} · liquidity do pool ${poolLiq} · boostLiquidity da posição ${info[1]}`);
  // 6b. escala do cakePerSecond: prever o ritmo e medir de verdade. Só vale com
  // a posição dentro da faixa (fora, rende 0).
  //
  // ⚠️ MEDIR PELO `pendingCake` NÃO BASTA, e o PoC descobriu isso na Ethereum:
  // o `pendingCake` é calculado sobre o ÚLTIMO estado do LMPool (a doc do
  // MasterChef v3 avisa: "the pending cake amount is based on the last state in
  // LMPool"), e o acumulador do LMPool só anda quando alguém mexe no pool
  // (depósito, saque ou harvest). Num pool parado o pendingCake fica EXATAMENTE
  // parado — medido: 0 CAKE/s em 60 s na Ethereum, e não 1,5e13. Por isso a
  // medida de rigor é o `harvest` simulado em dois instantes: a simulação roda
  // `accumulateReward(block.timestamp)` dentro do eth_call, que contabiliza o
  // tempo REAL desde a última mexida, sem depender de ninguém cutucar o pool.
  const s0 = await client.readContract({ address: v3Pool, abi: poolAbi, functionName: "slot0" });
  const dentro = s0[1] >= info[2] && s0[1] < info[3];
  if (!dentro || lmLiq === 0n) {
    console.log(`   (posição fora da faixa ou pool sem stake ativo — sem como conferir a escala por aqui)`);
  } else {
    const previsto = (Number(period[0]) / 1e12) * (Number(info[1]) / Number(lmLiq)); // wei de CAKE por segundo
    const harvestAbi = parseAbi(["function harvest(uint256 _tokenId, address _to) external returns (uint256 reward)"]);
    const medir = async () => {
      const b = await client.getBlock();
      const [pend, h] = await Promise.all([
        client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "pendingCake", args: [staked.tokenId] }),
        client
          .simulateContract({ address: rede.masterChef, abi: harvestAbi, functionName: "harvest", args: [staked.tokenId, user], account: user })
          .then((r) => (r.result as bigint) ?? 0n)
          .catch((e: Error) => {
            console.log(`   (harvest simulado falhou: ${e.message.split("\n")[0].slice(0, 90)})`);
            return null;
          }),
      ]);
      return { t: Number(b.timestamp), n: b.number, pend, h };
    };
    const a0 = await medir();
    const amostras: bigint[] = [a0.pend];
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 10_000));
      amostras.push(await client.readContract({ address: rede.masterChef, abi: mcAbi, functionName: "pendingCake", args: [staked.tokenId] }));
    }
    const a1 = await medir();
    const dt = a1.t - a0.t;
    const medido = a1.h !== null && a0.h !== null && dt > 0 ? Number(a1.h - a0.h) / dt : NaN;
    const porPending = Number(a1.pend - a0.pend) / dt;
    console.log(`   6b. CAKE/s da posição: previsto (cakePerSecond ÷ 1e12 × boostLiq ÷ lmLiquidity) ${previsto.toExponential(3)}`);
    console.log(`       MEDIDO por harvest simulado em ${dt} s: ${Number.isNaN(medido) ? "—" : medido.toExponential(3)} · razão ${Number.isNaN(medido) || medido === 0 ? "—" : (medido / previsto).toFixed(3)}`);
    console.log(`       MEDIDO pelo pendingCake no mesmo intervalo: ${porPending.toExponential(3)} (razão ${previsto === 0 ? "—" : (porPending / previsto).toFixed(3)}) — acumulador do LMPool, que só anda quando o pool é mexido`);
    console.log(`       rampa do pendingCake em ~10 s cada: ${amostras.slice(1).map((p, i) => (p - amostras[i]).toString()).join(" · ")} (wei; zero seguido = pool intocado na janela)`);
    console.log(`       tempo de bloco medido: ${(dt / Number(a1.n - a0.n)).toFixed(2)} s · blocos ${a0.n} → ${a1.n}`);
  }

  // 7. preço do CAKE
  const r = await fetch(`https://coins.llama.fi/prices/current/${rede.precoSlug}:${cake}`);
  const j = (await r.json()) as { coins: Record<string, { price: number; symbol: string }> };
  const c = Object.values(j.coins)[0];
  console.log(`\n7. ${ok(Boolean(c))} DefiLlama ${rede.precoSlug}:CAKE = ${c ? `US$ ${c.price} (${c.symbol})` : "sem preço"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
