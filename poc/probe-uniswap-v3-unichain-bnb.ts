/**
 * PoC — Uniswap v3 na Unichain (130) e na BNB Chain (56): passo 2 da meta de
 * cobertura total. Rodar ANTES de tocar no site (convenção nº 3).
 *
 * Endereços da doc OFICIAL, lidos em 04/10/2026:
 *   developers.uniswap.org → v3 → deployments → Unichain / BNB
 *
 * Prova, por rede:
 *  1. o RPC responde e a rede é a certa;
 *  2. NFPM.factory() bate com a doc;
 *  3. garimpa nos mints recentes uma carteira com liquidez e varre com o
 *     UniswapV3Adapter (só config — nenhum código novo);
 *  4. o slot0 do pool decodifica com o ABI da Uniswap (feeProtocol uint8).
 *
 * Nenhuma carteira fica neste arquivo: são achadas on-chain e impressas
 * abreviadas (a inteira só com POC_FULL=1, para rodar `npm run poc` nela).
 *
 *   npx tsx --env-file=.env.local poc/probe-uniswap-v3-unichain-bnb.ts
 */

export {}; // arquivo-script

import { createPublicClient, fallback, http, parseAbi, type Address, type Chain } from "viem";
import { bsc, unichain } from "viem/chains";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import type { UniV3ChainConfig } from "../core/adapters/uniswap-v3/config";
import type { ChainReader } from "../core/types";

const REDES: Array<{ nome: string; chain: Chain; env: string; publicos: string[]; cfg: UniV3ChainConfig }> = [
  {
    nome: "Unichain",
    chain: unichain,
    env: "UNICHAIN_RPC_URLS",
    publicos: ["https://mainnet.unichain.org", "https://unichain-rpc.publicnode.com"],
    cfg: {
      chainId: 130,
      factory: "0x1f98400000000000000000000000000000000003",
      nfpm: "0x943e6e07a7e8e791dafc44083e54041d743c46e9",
    },
  },
  {
    nome: "BNB Chain",
    chain: bsc,
    env: "BSC_RPC_URLS",
    publicos: ["https://bsc-dataseed.bnbchain.org", "https://bsc-rpc.publicnode.com"],
    cfg: {
      chainId: 56,
      factory: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
      nfpm: "0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613",
    },
  },
];

const nfpmAbi = parseAbi([
  "function factory() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);
const slot0Abi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

const ok = (b: boolean) => (b ? "✅" : "❌");
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const short = (a: string) => (process.env.POC_FULL ? a : `${a.slice(0, 6)}…${a.slice(-4)}`);

async function rede(r: (typeof REDES)[number]) {
  const rpcs = [...(process.env[r.env] ?? "").split(",").map((s) => s.trim()).filter(Boolean), ...r.publicos];
  const client = createPublicClient({ chain: r.chain, transport: fallback(rpcs.map((u) => http(u, { timeout: 30_000 }))) });
  console.log(`\n=== ${r.nome} (${r.cfg.chainId}) — ${process.env[r.env] ? `${r.env} + públicos` : "só públicos"}`);

  const id = await client.getChainId();
  console.log(`1. ${ok(id === r.cfg.chainId)} chainId ${id}`);
  const f = await client.readContract({ address: r.cfg.nfpm, abi: nfpmAbi, functionName: "factory" });
  console.log(`2. ${ok(eq(f, r.cfg.factory))} NFPM.factory() = doc`);

  const total = await client.readContract({ address: r.cfg.nfpm, abi: nfpmAbi, functionName: "totalSupply" });
  console.log(`   NFPM.totalSupply = ${total}`);
  const donos = new Set<Address>();
  for (let k = 1n; k <= 400n && donos.size < 3; k += 25n) {
    const idxs = Array.from({ length: 25 }, (_, i) => total - k - BigInt(i)).filter((i) => i >= 0n);
    const ids = await client.multicall({
      contracts: idxs.map((i) => ({ address: r.cfg.nfpm, abi: nfpmAbi, functionName: "tokenByIndex" as const, args: [i] as const })),
      allowFailure: true,
    });
    const tokenIds = ids.filter((x) => x.status === "success").map((x) => x.result as bigint);
    const res = await client.multicall({
      contracts: tokenIds.flatMap((t) => [
        { address: r.cfg.nfpm, abi: nfpmAbi, functionName: "ownerOf" as const, args: [t] as const },
        { address: r.cfg.nfpm, abi: nfpmAbi, functionName: "positions" as const, args: [t] as const },
      ]),
      allowFailure: true,
    });
    for (const i of tokenIds.keys()) {
      const o = res[i * 2];
      const p = res[i * 2 + 1];
      if (o.status !== "success" || p.status !== "success") continue;
      if (((p.result as unknown as readonly unknown[])[7] as bigint) === 0n) continue;
      donos.add(o.result as Address);
      if (donos.size >= 3) break;
    }
  }

  const ad = new UniswapV3Adapter(client as unknown as ChainReader, { config: r.cfg });
  let pool: Address | undefined;
  for (const dono of donos) {
    const t = Date.now();
    const ps = await ad.getPositions(dono);
    console.log(`3. ${ok(ps.length > 0)} carteira ${short(dono)}: ${ps.length} posição(ões) em ${Date.now() - t} ms`);
    for (const p of ps.slice(0, 2)) {
      console.log(`   · ${p.poolSymbol} #${p.positionId} inRange=${p.range?.inRange} a0=${p.amount0Raw} a1=${p.amount1Raw} taxas=${p.rewards.map((x) => `${x.raw} ${x.token.symbol}`).join(" + ") || "0"}`);
    }
    pool ??= ps[0]?.poolAddress as Address | undefined;
  }

  if (pool) {
    const s = await client.readContract({ address: pool, abi: slot0Abi, functionName: "slot0" });
    console.log(`4. ✅ slot0 com ABI da Uniswap: tick=${s[1]} feeProtocol=${s[5]}`);
  }
}

for (const r of REDES) {
  try {
    await rede(r);
  } catch (e) {
    console.log(`❌ ${r.nome}: ${(e as Error).message.slice(0, 200)}`);
  }
}
