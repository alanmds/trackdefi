/**
 * PoC — Receita B na Robinhood Chain (chainId 4663, Arbitrum Orbit L2).
 *
 * Rodar ANTES de tocar no site (regra nº 3 do projeto). Prova, na ordem:
 *  1. o RPC público responde e a rede é mesmo a 4663;
 *  2. multicall3 existe no endereço canônico (o adapter depende disso);
 *  3. coerência de endereços: NFPM.factory() DEVE bater com a factory da doc
 *     oficial — a própria doc da Uniswap avisa que os endereços NÃO são os
 *     canônicos nesta rede;
 *  4. a factory tem pools de verdade (rede viva, não deployment vazio);
 *  5. garimpa uma carteira com posição nos mints recentes e varre com o
 *     adapter parametrizado, sem tocar em nada de produção.
 *
 *   npx tsx poc/probe-robinhood.ts
 */

export {}; // arquivo-script

import { createPublicClient, fallback, http, parseAbi, parseAbiItem, type Address } from "viem";
import { robinhood } from "viem/chains";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import type { UniV3ChainConfig } from "../core/adapters/uniswap-v3/config";
import type { ChainReader } from "../core/types";

/** Endereços da doc OFICIAL (developers.uniswap.org → v3 → Robinhood Chain
 *  Deployments), lidos em 27/07/2026. NÃO são os canônicos de ETH/ARB/OP. */
const ROBINHOOD_UNI_V3: UniV3ChainConfig = {
  chainId: 4663,
  factory: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
  nfpm: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
};

const MULTICALL3: Address = "0xca11bde05977b3631167028862be2a173976ca11";

const nfpmAbi = parseAbi(["function factory() view returns (address)"]);
const factoryAbi = parseAbi(["function owner() view returns (address)"]);
const poolCreated = parseAbiItem(
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
);
const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");

const ok = (m: string) => console.log(`   ✅ ${m}`);
const bad = (m: string) => console.log(`   ❌ ${m}`);

async function main() {
  console.log(`PoC Robinhood Chain — Uniswap v3 (chainId ${ROBINHOOD_UNI_V3.chainId})\n`);
  /* O RPC oficial que o viem traz (`rpc.mainnet.chain.robinhood.com`) não
     resolve NESTE computador — bloqueio de DNS do ambiente local; no DNS
     público ele resolve, então em produção funciona. Por isso a lista começa
     pelos públicos alternativos, ambos confirmados em 27/07/2026 devolvendo
     chainId 0x1237 (4663). O publicnode é o mesmo provedor já usado nas
     outras quatro redes do projeto. */
  const rpcs = [
    "https://robinhood-rpc.publicnode.com",
    "https://robinhood.drpc.org",
    ...robinhood.rpcUrls.default.http,
  ];
  console.log(`RPC(s) tentados: ${rpcs.join(", ")}\n`);

  const client = createPublicClient({
    chain: robinhood,
    transport: fallback(rpcs.map((u) => http(u, { timeout: 30_000 }))),
  });
  let allOk = true;

  // 1. rede viva e id correto
  const [chainId, block] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
  if (chainId === 4663) ok(`RPC responde · chainId ${chainId} · bloco ${block}`);
  else {
    bad(`chainId inesperado: ${chainId} (esperado 4663)`);
    allOk = false;
  }

  // 2. multicall3 (o ChainReader do projeto depende dele)
  const mc = await client.getCode({ address: MULTICALL3 });
  if (mc && mc !== "0x") ok(`multicall3 presente em ${MULTICALL3} (${(mc.length - 2) / 2} bytes)`);
  else {
    bad("multicall3 NÃO encontrado no endereço canônico — adapter não funciona");
    allOk = false;
  }

  // 3. coerência NFPM ↔ factory
  const fromNfpm = (await client.readContract({
    address: ROBINHOOD_UNI_V3.nfpm,
    abi: nfpmAbi,
    functionName: "factory",
  })) as Address;
  if (fromNfpm.toLowerCase() === ROBINHOOD_UNI_V3.factory.toLowerCase()) {
    ok(`NFPM.factory() = ${fromNfpm} — bate com a doc oficial`);
  } else {
    bad(`NFPM.factory() = ${fromNfpm} DIVERGE da config (${ROBINHOOD_UNI_V3.factory})`);
    allOk = false;
  }

  // 4. a factory existe e a rede tem pools
  const code = await client.getCode({ address: ROBINHOOD_UNI_V3.factory });
  if (!code || code === "0x") {
    bad("factory sem bytecode — endereço errado");
    allOk = false;
  } else {
    try {
      const owner = await client.readContract({ address: ROBINHOOD_UNI_V3.factory, abi: factoryAbi, functionName: "owner" });
      ok(`factory viva · owner ${owner}`);
    } catch {
      ok("factory tem bytecode (owner() não respondeu — não é bloqueante)");
    }
  }

  let pools = 0;
  for (const span of [50_000n, 10_000n, 2_000n, 500n]) {
    try {
      const logs = await client.getLogs({
        address: ROBINHOOD_UNI_V3.factory,
        event: poolCreated,
        fromBlock: block > span ? block - span : 0n,
        toBlock: block,
      });
      pools = logs.length;
      console.log(`   ℹ ${pools} pool(s) criado(s) nos últimos ${span} blocos`);
      break;
    } catch {
      /* faixa recusada pelo RPC — tenta menor */
    }
  }

  /* 5. carteira real. NÃO usar getLogs de "mints recentes" como nas outras
     redes: a Robinhood Chain tem blocos de 100 ms, então 50 mil blocos são
     ~1,4 h e quase nunca pegam um mint. O caminho estável é o próprio
     ERC-721: totalSupply() + tokenByIndex() + ownerOf(). */
  let wallet: Address | null = null;
  const enumAbi = parseAbi([
    "function totalSupply() view returns (uint256)",
    "function tokenByIndex(uint256) view returns (uint256)",
    "function ownerOf(uint256) view returns (address)",
  ]);
  try {
    const total = (await client.readContract({
      address: ROBINHOOD_UNI_V3.nfpm,
      abi: enumAbi,
      functionName: "totalSupply",
    })) as bigint;
    console.log(`   ℹ ${total} posição(ões) já emitida(s) no NFPM desta rede`);
    for (let i = 1n; i <= 6n && i <= total && !wallet; i++) {
      const id = (await client.readContract({
        address: ROBINHOOD_UNI_V3.nfpm,
        abi: enumAbi,
        functionName: "tokenByIndex",
        args: [total - i],
      })) as bigint;
      const owner = (await client.readContract({
        address: ROBINHOOD_UNI_V3.nfpm,
        abi: enumAbi,
        functionName: "ownerOf",
        args: [id],
      })) as Address;
      if (owner !== "0x0000000000000000000000000000000000000000") wallet = owner;
    }
  } catch (e) {
    console.log(`   ⚠ enumeração ERC-721 falhou: ${(e as Error).message.split("\n")[0]}`);
  }

  if (!wallet) {
    console.log("   ⚠ nenhum mint recente encontrado — varredura de carteira não pôde ser feita");
  } else {
    /* o próprio client do viem JÁ é o ChainReader do projeto (é o que o
       createReader devolve) — passar um objeto reduzido esconderia o
       simulateContract e faria as taxas caírem no fallback tokensOwed */
    const reader = client as unknown as ChainReader;
    const warnings: string[] = [];
    const adapter = new UniswapV3Adapter(reader, { config: ROBINHOOD_UNI_V3, onWarn: (m) => warnings.push(m) });
    const t0 = Date.now();
    const positions = await adapter.getPositions(wallet);
    console.log(
      `   ℹ carteira ${wallet.slice(0, 10)}…: ${positions.length} posição(ões) em ${((Date.now() - t0) / 1000).toFixed(1)} s · ${warnings.length} aviso(s)`,
    );
    for (const p of positions.slice(0, 5)) {
      console.log(
        `     • ${p.poolSymbol}${p.range ? (p.range.inRange ? " [NA FAIXA]" : " [FORA DA FAIXA]") : ""} · ${p.token0.symbol}/${p.token1.symbol}`,
      );
    }
    for (const w of warnings.slice(0, 3)) console.log(`     ⚠ ${w}`);
  }

  console.log(`\n${allOk ? "✅ PoC OK — a Receita B se aplica nesta rede" : "❌ PoC com falhas — NÃO prosseguir"}`);
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
