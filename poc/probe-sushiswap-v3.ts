/**
 * PoC — SushiSwap v3 na Ethereum, Optimism, BNB Chain, Base e Arbitrum: passo 4
 * da meta de cobertura total. Rodar ANTES de tocar no site (convenção nº 3).
 *
 * Endereços do repositório OFICIAL da Sushi, lidos em 20/10/2026:
 *   github.com/sushi-labs/sushi → src/evm/config/features/sushiswap-v3.ts
 *   (SUSHISWAP_V3_FACTORY_ADDRESS, SUSHISWAP_V3_POSITION_MANAGER,
 *   SUSHISWAP_V3_INIT_CODE_HASH) — é de lá que a doc (docs.sushi.com) tira as
 *   tabelas de endereço.
 *
 * Prova, por rede:
 *  1. o RPC responde e a rede é a certa;
 *  2. NFPM.factory() bate com o repositório;
 *  3. o init code hash do repositório reproduz (CREATE2) o endereço que a
 *     factory devolve em getPool — prova de que a factory é a da Sushi v3;
 *  4. garimpa nos mints recentes carteiras com liquidez e varre com o
 *     UniswapV3Adapter (só config — nenhum código novo): `positions()` com os
 *     12 campos da Uniswap, taxas por collect() simulado;
 *  5. o slot0 do pool decodifica com o ABI da Uniswap (feeProtocol uint8).
 *
 * Nenhuma carteira fica neste arquivo: são achadas on-chain e impressas
 * abreviadas (a inteira só com POC_FULL=1, para rodar `npm run poc` nela).
 *
 *   npx tsx --env-file=.env.local poc/probe-sushiswap-v3.ts
 */

export {}; // arquivo-script

import {
  createPublicClient,
  encodeAbiParameters,
  fallback,
  getCreate2Address,
  http,
  keccak256,
  parseAbi,
  type Address,
} from "viem";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import { SUSHISWAP_V3_CHAINS } from "../core/adapters/sushiswap-v3/config";
import type { UniV3ChainConfig } from "../core/adapters/uniswap-v3/config";
import { CHAINS } from "../core/chains";
import { rpcUrls } from "../core/chain";
import type { ChainReader } from "../core/types";

/** SUSHISWAP_V3_INIT_CODE_HASH — o mesmo nas cinco redes, segundo o repositório */
const INIT_CODE_HASH = "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54";

const nfpmAbi = parseAbi([
  "function factory() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);
const factoryAbi = parseAbi(["function getPool(address, address, uint24) view returns (address)"]);
const slot0Abi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

const ok = (b: boolean) => (b ? "✅" : "❌");
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const short = (a: string) => (process.env.POC_FULL ? a : `${a.slice(0, 6)}…${a.slice(-4)}`);

async function rede(cfg: UniV3ChainConfig) {
  const info = CHAINS[cfg.chainId];
  const client = createPublicClient({
    chain: info.chain,
    transport: fallback(rpcUrls(cfg.chainId).map((u) => http(u, { timeout: 30_000 }))),
  });
  console.log(`\n=== ${info.label} (${cfg.chainId}) — ${process.env[info.rpcEnv] ? `${info.rpcEnv} + públicos` : "só públicos"}`);

  const id = await client.getChainId();
  console.log(`1. ${ok(id === cfg.chainId)} chainId ${id}`);
  const f = await client.readContract({ address: cfg.nfpm, abi: nfpmAbi, functionName: "factory" });
  console.log(`2. ${ok(eq(f, cfg.factory))} NFPM.factory() = repositório`);

  const total = await client.readContract({ address: cfg.nfpm, abi: nfpmAbi, functionName: "totalSupply" });
  console.log(`   NFPM.totalSupply = ${total}`);
  const donos = new Set<Address>();
  let amostra: { token0: Address; token1: Address; fee: number } | undefined;
  for (let k = 1n; k <= 2000n && donos.size < 3; k += 50n) {
    const idxs = Array.from({ length: 50 }, (_, i) => total - k - BigInt(i)).filter((i) => i >= 0n);
    const ids = await client.multicall({
      contracts: idxs.map((i) => ({ address: cfg.nfpm, abi: nfpmAbi, functionName: "tokenByIndex" as const, args: [i] as const })),
      allowFailure: true,
    });
    const tokenIds = ids.filter((x) => x.status === "success").map((x) => x.result as bigint);
    const res = await client.multicall({
      contracts: tokenIds.flatMap((t) => [
        { address: cfg.nfpm, abi: nfpmAbi, functionName: "ownerOf" as const, args: [t] as const },
        { address: cfg.nfpm, abi: nfpmAbi, functionName: "positions" as const, args: [t] as const },
      ]),
      allowFailure: true,
    });
    for (const i of tokenIds.keys()) {
      const o = res[i * 2];
      const p = res[i * 2 + 1];
      if (o.status !== "success" || p.status !== "success") continue;
      const v = p.result as unknown as readonly unknown[];
      if ((v[7] as bigint) === 0n) continue;
      amostra ??= { token0: v[2] as Address, token1: v[3] as Address, fee: Number(v[4]) };
      // contrato (cofre/gestor) também é dono de NFT — queremos carteira de gente
      const code = await client.getCode({ address: o.result as Address });
      if (code && code !== "0x") continue;
      donos.add(o.result as Address);
      if (donos.size >= 3) break;
    }
  }

  if (amostra) {
    const doFactory = await client.readContract({
      address: cfg.factory,
      abi: factoryAbi,
      functionName: "getPool",
      args: [amostra.token0, amostra.token1, amostra.fee],
    });
    const salt = keccak256(
      encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "uint24" }], [amostra.token0, amostra.token1, amostra.fee]),
    );
    const calculado = getCreate2Address({ from: cfg.factory, salt, bytecodeHash: INIT_CODE_HASH });
    console.log(`3. ${ok(eq(doFactory, calculado))} CREATE2(init code hash) = factory.getPool (fee ${amostra.fee})`);
  }

  const ad = new UniswapV3Adapter(client as unknown as ChainReader, { config: cfg, protocol: "sushiswap-v3" });
  let pool: Address | undefined;
  for (const dono of donos) {
    const t = Date.now();
    const ps = await ad.getPositions(dono);
    console.log(`4. ${ok(ps.length > 0)} carteira ${short(dono)}: ${ps.length} posição(ões) em ${Date.now() - t} ms`);
    for (const p of ps.slice(0, 2)) {
      console.log(
        `   · ${p.poolSymbol} #${p.positionId} inRange=${p.range?.inRange} a0=${p.amount0Raw} a1=${p.amount1Raw} taxas=${p.rewards.map((x) => `${x.raw} ${x.token.symbol}`).join(" + ") || "0"}`,
      );
    }
    pool ??= ps[0]?.poolAddress as Address | undefined;
  }

  if (pool) {
    const s = await client.readContract({ address: pool, abi: slot0Abi, functionName: "slot0" });
    console.log(`5. ✅ slot0 com ABI da Uniswap: tick=${s[1]} feeProtocol=${s[5]}`);
  }
}

for (const cfg of SUSHISWAP_V3_CHAINS) {
  try {
    await rede(cfg);
  } catch (e) {
    console.log(`❌ ${CHAINS[cfg.chainId]?.label ?? cfg.chainId}: ${(e as Error).message.slice(0, 200)}`);
  }
}
