/**
 * PoC da Receita A — ecossistema Sugar nas redes "leaf" da Superchain
 * (Mode, Ink, Unichain, Soneium, Fraxtal). Rodar ANTES de tocar no site.
 *
 * Prova, por rede:
 *  1. o RPC público responde e a rede é mesmo a esperada;
 *  2. multicall3 existe no endereço canônico (o ChainReader depende dele);
 *  3. o LP_SUGAR do repo velodrome-finance/sugar tem bytecode;
 *  4. **descobre o token de emissões on-chain** — nas leaf chains ele NÃO
 *     consta no `.env` (é XVELO bridgeado). Caminho: uma pool da factory →
 *     `gauge()` → `rewardToken()` → `symbol()`. Nunca de memória (regra 1).
 *  5. o struct Position do Sugar decodifica nesta rede (a armadilha conhecida
 *     da Receita A: Sugar tem versão POR CHAIN).
 *
 *   npx tsx poc/probe-superchain.ts [nome-da-rede]
 */

export {}; // arquivo-script

import { createPublicClient, erc20Abi, fallback, http, parseAbi, type Address, type Chain } from "viem";
import { fraxtal, ink, mode, soneium, unichain } from "viem/chains";
import { sugarAbi } from "../core/adapters/aerodrome/abi";

/** Levantado dos `deployments/<chain>.env` do repo velodrome-finance/sugar
 *  em 10/08/2026. As factories são IDÊNTICAS nas cinco (deployment "leaf"
 *  da Superchain); o que muda por rede é o LP_SUGAR_ADDRESS. */
const LEAF_FACTORIES: Address[] = [
  "0x31832f2a97Fd20664D76Cc421207669b55CE4BC0",
  "0x04625B046C69577EfC40e6c0Bb83CDBAfab5a55F",
  "0x718E46d0962A66942E233760a8bd6038Ce54EdCD",
];

/** carteira de teste do próprio repo sugar (TEST_ADDRESS_*, igual nas 5) */
const TEST_WALLET: Address = "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";

const MULTICALL3: Address = "0xca11bde05977b3631167028862be2a173976ca11";

interface Candidate {
  name: string;
  chain: Chain;
  sugar: Address;
  rpcs: string[];
}

const CANDIDATES: Candidate[] = [
  {
    name: "Mode",
    chain: mode,
    sugar: "0x1A3C63c8D442948085E47f88CB377183E23EA01f",
    rpcs: ["https://mainnet.mode.network", "https://mode.drpc.org"],
  },
  {
    name: "Ink",
    chain: ink,
    sugar: "0x215cEad02e0b9E0E494DD179585C18a772048a43",
    rpcs: ["https://rpc-gel.inkonchain.com", "https://ink.drpc.org"],
  },
  {
    name: "Unichain",
    chain: unichain,
    sugar: "0xE002AF2176f604C250c6C368baB5F27e871559c2",
    rpcs: ["https://mainnet.unichain.org", "https://unichain.drpc.org"],
  },
  {
    name: "Soneium",
    chain: soneium,
    sugar: "0x7A0225110765d2A14652323733f616215c5509cf",
    rpcs: ["https://rpc.soneium.org", "https://soneium.drpc.org"],
  },
  {
    name: "Fraxtal",
    chain: fraxtal,
    sugar: "0xCAaf4556fF489521d4c722CB275510B602d6276d",
    rpcs: ["https://rpc.frax.com", "https://fraxtal.drpc.org"],
  },
];

const factoryAbi = parseAbi([
  "function allPoolsLength() view returns (uint256)",
  "function allPools(uint256) view returns (address)",
]);
const poolAbi = parseAbi(["function gauge() view returns (address)"]);
const gaugeAbi = parseAbi(["function rewardToken() view returns (address)"]);

const ok = (m: string) => console.log(`   ✅ ${m}`);
const bad = (m: string) => console.log(`   ❌ ${m}`);
const info = (m: string) => console.log(`   ℹ  ${m}`);

type Client = ReturnType<typeof createPublicClient>;

/** Descobre o token de emissões percorrendo factory → pool → gauge →
 *  rewardToken. Devolve null se nenhuma pool desta rede tiver gauge. */
async function discoverEmissionsToken(client: Client, warn: (m: string) => void) {
  for (const factory of LEAF_FACTORIES) {
    let len = 0n;
    try {
      len = (await client.readContract({ address: factory, abi: factoryAbi, functionName: "allPoolsLength" })) as bigint;
    } catch {
      continue; // factory CL não expõe allPoolsLength — tenta a próxima
    }
    if (len === 0n) continue;
    // varre algumas pools: nem toda pool tem gauge
    for (let i = 0n; i < len && i < 12n; i++) {
      try {
        const pool = (await client.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: "allPools",
          args: [i],
        })) as Address;
        const gauge = (await client.readContract({ address: pool, abi: poolAbi, functionName: "gauge" })) as Address;
        if (gauge === "0x0000000000000000000000000000000000000000") continue;
        const token = (await client.readContract({
          address: gauge,
          abi: gaugeAbi,
          functionName: "rewardToken",
        })) as Address;
        const [symbol, decimals] = await Promise.all([
          client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
          client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
        ]);
        return { token, symbol: symbol as string, decimals: decimals as number, via: { factory, pool, gauge } };
      } catch {
        /* pool sem gauge, ou de tipo que não responde a essas sondas */
      }
    }
    warn(`factory ${factory.slice(0, 10)}… tem ${len} pool(s), mas nenhuma das 12 primeiras deu gauge→rewardToken`);
  }
  return null;
}

async function probe(c: Candidate): Promise<boolean> {
  console.log(`\n━━ ${c.name} (chainId ${c.chain.id}) ━━`);
  const client = createPublicClient({
    chain: c.chain,
    transport: fallback(c.rpcs.map((u) => http(u, { timeout: 30_000 }))),
  });
  let allOk = true;

  // 1. rede viva e id correto
  try {
    const [chainId, block] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
    if (chainId === c.chain.id) ok(`RPC responde · chainId ${chainId} · bloco ${block}`);
    else {
      bad(`chainId inesperado: ${chainId} (esperado ${c.chain.id})`);
      return false;
    }
  } catch (e) {
    bad(`nenhum RPC respondeu: ${(e as Error).message.split("\n")[0]}`);
    return false;
  }

  // 2. multicall3
  const mc = await client.getCode({ address: MULTICALL3 });
  if (mc && mc !== "0x") ok(`multicall3 presente (${(mc.length - 2) / 2} bytes)`);
  else {
    bad("multicall3 NÃO encontrado — o ChainReader não funciona nesta rede");
    allOk = false;
  }

  // 3. LP_SUGAR do repo
  const sugarCode = await client.getCode({ address: c.sugar });
  if (sugarCode && sugarCode !== "0x") ok(`LP_SUGAR ${c.sugar} vivo (${(sugarCode.length - 2) / 2} bytes)`);
  else {
    bad(`LP_SUGAR ${c.sugar} SEM bytecode — endereço errado ou rede não implantada`);
    return false;
  }

  // 4. token de emissões — descoberto on-chain, nunca de memória
  const emissions = await discoverEmissionsToken(client, (m) => info(m));
  if (emissions) {
    ok(`emissionsToken = ${emissions.token} · symbol=${emissions.symbol} decimals=${emissions.decimals}`);
    info(`   descoberto via pool ${emissions.via.pool.slice(0, 10)}… → gauge ${emissions.via.gauge.slice(0, 10)}…`);
  } else {
    bad("token de emissões NÃO descoberto — sem ele a config da Receita A não fecha");
    allOk = false;
  }

  // 5. o struct Position do Sugar decodifica NESTA rede
  try {
    const raw = (await client.readContract({
      address: c.sugar,
      abi: sugarAbi,
      functionName: "positions",
      args: [200n, 0n, TEST_WALLET],
    })) as unknown[];
    ok(`struct Position decodifica · ${raw.length} posição(ões) da carteira de teste do repo`);
  } catch (e) {
    bad(`struct Position NÃO decodifica: ${(e as Error).message.split("\n")[0]}`);
    info("a versão do Sugar desta rede difere — conferir o LpSugar.vy do repo antes de seguir");
    allOk = false;
  }

  return allOk;
}

async function main() {
  const only = process.argv[2]?.toLowerCase();
  const list = only ? CANDIDATES.filter((c) => c.name.toLowerCase() === only) : CANDIDATES;
  if (list.length === 0) {
    console.error(`rede desconhecida: ${only}. Opções: ${CANDIDATES.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }

  console.log("PoC Receita A — ecossistema Sugar nas leaf chains da Superchain");
  console.log(`Carteira de teste (repo sugar): ${TEST_WALLET}`);

  const results: [string, boolean][] = [];
  for (const c of list) {
    try {
      results.push([c.name, await probe(c)]);
    } catch (e) {
      bad(`erro inesperado: ${(e as Error).message.split("\n")[0]}`);
      results.push([c.name, false]);
    }
  }

  console.log("\n━━ Resumo ━━");
  for (const [name, pass] of results) console.log(`   ${pass ? "✅" : "❌"} ${name}`);
  const green = results.filter(([, p]) => p).map(([n]) => n);
  console.log(
    green.length > 0
      ? `\n✅ ${green.length}/${results.length} rede(s) prontas para a Receita A: ${green.join(", ")}`
      : "\n❌ nenhuma rede passou — NÃO prosseguir",
  );
  if (green.length === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
