/**
 * PoC — Ramses V3 (liquidez concentrada, fork da Uniswap v3 com ve(3,3)).
 * Rodar ANTES de tocar no site (convenção nº 3).
 *
 * Endereços da doc OFICIAL, lidos em 02/10/2026:
 *   www.ramses.xyz/docs/contract-addresses
 * Código-fonte: github.com/RamsesExchange/ramses-v3-contracts
 *
 * Diferenças que o código-fonte mostra e este PoC prova on-chain:
 *  - o NFPM expõe `deployer()` (o PoolDeployer), não `factory()`;
 *  - `positions()` tem 10 campos (sem nonce/operator) e `tickSpacing` no lugar
 *    do fee; `factory.getPool(token0, token1, tickSpacing)`;
 *  - `slot0()` com feeProtocol uint24; `ticks()` igual à Uniswap;
 *  - NÃO há stake: o NFT fica na carteira e o gauge do pool paga emissões a
 *    ele direto (`GaugeV3.earned(token, nfpm, tokenId)`). O gauge sai de
 *    `Voter.gaugeForPool(pool)`, e o Voter de `FeeCollector.voter()` (o
 *    FeeCollector está na doc em todas as redes; o Voter, não).
 *
 * Em cada rede: coerência de endereços → garimpa posição com liquidez nos
 * mints recentes → amounts/taxas → gauge, recompensas e ritmo de emissão
 * (previsto × medido em 60 s) → estado de ~24 h atrás (fee APR on-chain).
 * Nenhuma carteira fica neste arquivo.
 *
 *   npx tsx --env-file=.env.local poc/probe-ramses.ts            (todas)
 *   npx tsx --env-file=.env.local poc/probe-ramses.ts robinhood  (uma)
 */

export {}; // arquivo-script

import { createPublicClient, fallback, http, parseAbi, type Address, type Chain } from "viem";
import { arbitrum, hyperEvm, polygon, robinhood } from "viem/chains";

interface Rede {
  nome: string;
  chain: Chain;
  env: string;
  rpcs: string[];
  secPerBlock: number;
  factory: Address;
  poolDeployer: Address;
  nfpm: Address;
  feeCollector: Address;
}

const REDES: Rede[] = [
  {
    nome: "robinhood",
    chain: robinhood,
    env: "ROBINHOOD_RPC_URLS",
    rpcs: ["https://robinhood-rpc.publicnode.com"],
    secPerBlock: 0.1,
    factory: "0xE0c4ceb92d08CA985bB70fe0a22fEb121A9854A8",
    poolDeployer: "0x4b37359BF291AbE8453692DB58d515a8b013Dca9",
    nfpm: "0x2eBd7B85a4E08D5B508b04BA147976C94afE6590",
    feeCollector: "0x2Bef16A0081565E72100D73CBe19B1Bd2d802380",
  },
  {
    nome: "hyperevm",
    chain: hyperEvm,
    env: "HYPEREVM_RPC_URLS",
    rpcs: ["https://rpc.hyperliquid.xyz/evm"],
    secPerBlock: 1,
    factory: "0x07E60782535752be279929e2DFfDd136Db2e6b45",
    poolDeployer: "0x301d2E3c7Db5904b3971cf9C36195e37c5a14873",
    nfpm: "0xB3F77C5134D643483253D22E0Ca24627aE42ED51",
    feeCollector: "0xA22fc9950bE328D8a32a8c1e2c92eAc4e6bADa00",
  },
  {
    nome: "polygon",
    chain: polygon,
    env: "POLYGON_RPC_URLS",
    rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon.drpc.org"],
    secPerBlock: 2,
    factory: "0x2Bef16A0081565E72100D73CBe19B1Bd2d802380",
    poolDeployer: "0x43B2Bf9f33036a02fC7A00935571c2A6b0108e66",
    nfpm: "0xcc543a9EDBa25cEB2922b165047b6A7bE861C55b",
    feeCollector: "0x83341F891f898cb5E0cacC8a70501BBa83d9CecF",
  },
  {
    nome: "arbitrum",
    chain: arbitrum,
    env: "ARBITRUM_RPC_URLS",
    rpcs: ["https://arb1.arbitrum.io/rpc"],
    secPerBlock: 0.25,
    factory: "0xd0019e86edB35E1fedaaB03aED5c3c60f115d28b",
    poolDeployer: "0xb722efaAbe807FAeA16068f595EaA9aa1a62CECD",
    nfpm: "0x807a31EF83342D279a1F7708Adbc3492405A4CbC",
    feeCollector: "0xa22bE6E1a1a5A22b3a52De872bB757CD5F45dC32",
  },
];

const nfpmAbi = parseAbi([
  "function deployer() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function positions(uint256 tokenId) view returns (address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "struct CollectParams { uint256 tokenId; address recipient; uint128 amount0Max; uint128 amount1Max; }",
  "function collect(CollectParams params) payable returns (uint256 amount0, uint256 amount1)",
]);
const factoryAbi = parseAbi(["function getPool(address, address, int24) view returns (address)"]);
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint24 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function fee() view returns (uint24)",
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);
const feeCollectorAbi = parseAbi(["function voter() view returns (address)"]);
const voterAbi = parseAbi(["function gaugeForPool(address) view returns (address)", "function isAlive(address) view returns (bool)"]);
const gaugeAbi = parseAbi([
  "function getRewardTokens() view returns (address[])",
  "function rewardRate(address token) view returns (uint256)",
  "function earned(address token, address nfpManagerAddress, uint256 tokenId) view returns (uint256)",
]);
const ercAbi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);
const MAX128 = (1n << 128n) - 1n;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ok = (b: boolean) => (b ? "✅" : "❌");
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const ZERO = "0x0000000000000000000000000000000000000000";

async function provar(r: Rede) {
  const env = (process.env[r.env] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const urls = [...env, ...r.rpcs];
  const c = createPublicClient({ chain: r.chain, transport: fallback(urls.map((u) => http(u, { timeout: 30_000 }))) });
  console.log(`\n━━ ${r.nome} (${env.length ? "com " + r.env : "só RPC público"})`);

  const [chainId, head] = await Promise.all([c.getChainId(), c.getBlockNumber()]);
  console.log(`1. ${ok(chainId === r.chain.id)} chainId ${chainId} · bloco ${head}`);

  const [f, voter, total] = await Promise.all([
    c.readContract({ address: r.nfpm, abi: nfpmAbi, functionName: "deployer" }),
    c.readContract({ address: r.feeCollector, abi: feeCollectorAbi, functionName: "voter" }).catch(() => ZERO as Address),
    c.readContract({ address: r.nfpm, abi: nfpmAbi, functionName: "totalSupply" }),
  ]);
  console.log(`2. ${ok(eq(f, r.poolDeployer))} NFPM.deployer() = PoolDeployer da doc · Voter (via FeeCollector) ${eq(voter, ZERO) ? "NENHUM" : short(voter)} · NFTs já mintados: ${total}`);

  // 3. posição com liquidez entre os mints recentes (prefere uma com gauge)
  type Alvo = { id: bigint; owner: Address; pos: readonly unknown[]; pool: Address; gauge: Address };
  // preferência: com gauge E dentro da faixa > com gauge > qualquer uma
  let alvo = null as Alvo | null;
  let comGauge = null as Alvo | null;
  let semGauge = null as Alvo | null;
  for (let k = 1n; k <= 400n && !alvo; k += 40n) {
    const idxs = Array.from({ length: 40 }, (_, i) => total - k - BigInt(i)).filter((i) => i >= 0n);
    const ids = (await c.multicall({ contracts: idxs.map((i) => ({ address: r.nfpm, abi: nfpmAbi, functionName: "tokenByIndex", args: [i] })), allowFailure: true }))
      .filter((x) => x.status === "success").map((x) => x.result as bigint);
    const res = await c.multicall({
      contracts: ids.flatMap((id) => [
        { address: r.nfpm, abi: nfpmAbi, functionName: "ownerOf", args: [id] },
        { address: r.nfpm, abi: nfpmAbi, functionName: "positions", args: [id] },
      ]),
      allowFailure: true,
    });
    for (const [i, id] of ids.entries()) {
      const o = res[i * 2], p = res[i * 2 + 1];
      if (o.status !== "success" || p.status !== "success") continue;
      const v = p.result as unknown as readonly unknown[];
      if ((v[5] as bigint) === 0n) continue;
      const pool = await c.readContract({ address: r.factory, abi: factoryAbi, functionName: "getPool", args: [v[0] as Address, v[1] as Address, Number(v[2])] });
      const gauge = eq(voter, ZERO) ? (ZERO as Address) : await c.readContract({ address: voter, abi: voterAbi, functionName: "gaugeForPool", args: [pool] });
      const cand = { id, owner: o.result as Address, pos: v, pool, gauge };
      if (!eq(gauge, ZERO)) {
        const s0 = await c.readContract({ address: pool, abi: poolAbi, functionName: "slot0" });
        if (s0[1] >= Number(v[3]) && s0[1] < Number(v[4])) { alvo = cand; break; }
        comGauge ??= cand;
      }
      semGauge ??= cand;
    }
  }
  alvo ??= comGauge ?? semGauge;
  if (!alvo) return console.log("3. ❌ nenhuma posição com liquidez nos 400 mints mais recentes");

  const v = alvo.pos;
  const [s0, liq, fee, sym0, sym1] = await Promise.all([
    c.readContract({ address: alvo.pool, abi: poolAbi, functionName: "slot0" }),
    c.readContract({ address: alvo.pool, abi: poolAbi, functionName: "liquidity" }),
    c.readContract({ address: alvo.pool, abi: poolAbi, functionName: "fee" }),
    c.readContract({ address: v[0] as Address, abi: ercAbi, functionName: "symbol" }),
    c.readContract({ address: v[1] as Address, abi: ercAbi, functionName: "symbol" }),
  ]);
  const dentro = s0[1] >= Number(v[3]) && s0[1] < Number(v[4]);
  console.log(`3. NFT #${alvo.id} de ${short(alvo.owner)}: CL${v[2]}-${sym0}/${sym1} · fee atual ${fee / 10_000}% · L ${v[5]} · ${dentro ? "dentro" : "fora"} da faixa (tick ${s0[1]}) · pool ${short(alvo.pool)}`);

  try {
    const sim = await c.simulateContract({
      address: r.nfpm, abi: nfpmAbi, functionName: "collect",
      args: [{ tokenId: alvo.id, recipient: alvo.owner, amount0Max: MAX128, amount1Max: MAX128 }],
      account: alvo.owner,
    });
    console.log(`4. ✅ taxas via collect() simulado: ${sim.result[0]} / ${sim.result[1]}`);
  } catch (e) {
    console.log(`4. ❌ collect() simulado falhou: ${(e as Error).message.split("\n")[0].slice(0, 120)}`);
  }

  const tick = await c.readContract({ address: alvo.pool, abi: poolAbi, functionName: "ticks", args: [Number(v[3])] });
  console.log(`5. ${ok(Boolean(tick[7]))} ticks() no layout da Uniswap (initialized=${tick[7]})`);
  try {
    await c.readContract({ address: alvo.pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128", blockNumber: head - BigInt(Math.round(86_400 / r.secPerBlock)) });
    console.log(`   ✅ estado de ~24 h atrás respondeu — fee APR on-chain viável neste RPC`);
  } catch (e) {
    console.log(`   ❌ estado de ~24 h atrás recusado (pool novo ou RPC sem arquivo): ${(e as Error).message.split("\n")[0].slice(0, 90)}`);
  }

  if (eq(alvo.gauge, ZERO)) return console.log(`6. — pool sem gauge (sem emissões) ${eq(voter, ZERO) ? "· rede sem Voter" : ""}`);
  const tokens = await c.readContract({ address: alvo.gauge, abi: gaugeAbi, functionName: "getRewardTokens" });
  console.log(`6. gauge ${short(alvo.gauge)} · ${tokens.length} token(s) de recompensa`);
  for (const t of tokens) {
    const [s, d, rate, e0] = await Promise.all([
      c.readContract({ address: t, abi: ercAbi, functionName: "symbol" }),
      c.readContract({ address: t, abi: ercAbi, functionName: "decimals" }),
      c.readContract({ address: alvo.gauge, abi: gaugeAbi, functionName: "rewardRate", args: [t] }),
      c.readContract({ address: alvo.gauge, abi: gaugeAbi, functionName: "earned", args: [t, r.nfpm, alvo.id] }),
    ]);
    console.log(`   · ${s} (${short(t)}, ${d} casas): rewardRate ${rate}/s · earned ${e0}`);
  }
  // ritmo: o token com o MAIOR rewardRate, previsto × medido
  const taxas = await Promise.all(tokens.map((x) => c.readContract({ address: alvo!.gauge, abi: gaugeAbi, functionName: "rewardRate", args: [x] })));
  const t = tokens[taxas.indexOf(taxas.reduce((a, b) => (b > a ? b : a), 0n))];
  if (dentro && t) {
    const rate = await c.readContract({ address: alvo.gauge, abi: gaugeAbi, functionName: "rewardRate", args: [t] });
    const previsto = Number(rate) * (Number(v[5]) / Number(liq));
    const b0 = await c.getBlock();
    const e0 = await c.readContract({ address: alvo.gauge, abi: gaugeAbi, functionName: "earned", args: [t, r.nfpm, alvo.id] });
    await new Promise((res) => setTimeout(res, 60_000));
    const b1 = await c.getBlock();
    const e1 = await c.readContract({ address: alvo.gauge, abi: gaugeAbi, functionName: "earned", args: [t, r.nfpm, alvo.id] });
    const dt = Number(b1.timestamp - b0.timestamp);
    const medido = Number(e1 - e0) / dt;
    console.log(`7. ritmo de emissão: previsto (rewardRate × L ÷ liquidity do pool) ${previsto.toExponential(3)}/s · medido em ${dt} s ${medido.toExponential(3)}/s · razão ${(medido / previsto).toFixed(3)}`);
  }
  const llama = await fetch(`https://coins.llama.fi/prices/current/${tokens.map((x) => `${r.nome === "hyperevm" ? "hyperliquid" : r.nome}:${x}`).join(",")}`).then((x) => x.json()) as { coins: Record<string, { price: number; symbol: string }> };
  console.log(`8. preços DefiLlama dos tokens de recompensa: ${Object.values(llama.coins).map((x) => `${x.symbol} US$ ${x.price}`).join(" · ") || "nenhum"}`);
}

const so = process.argv[2];
for (const r of REDES.filter((x) => !so || x.nome === so)) {
  try { await provar(r); } catch (e) { console.log(`   ❌ ${r.nome}: ${(e as Error).message.split("\n")[0].slice(0, 160)}`); }
}
