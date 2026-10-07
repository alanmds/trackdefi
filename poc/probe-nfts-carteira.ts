/**
 * Por que o rastreador mostra MENOS posições do que a carteira tem NFTs?
 * Enumera, NFPM por NFPM, todos os NFTs que a carteira detém e imprime o que
 * cada um tem HOJE on-chain: liquidez, faixa, tokensOwed. É o gabarito para
 * responder "a posição X existe mesmo?" fora do caminho de produção.
 *
 * Também identifica contratos NFT desconhecidos que a carteira tenha
 * (Alchemy devolve endereço, não nome) — `name()` + `ownerOf` + o que o
 * contrato responde.
 *
 *   npx tsx --env-file=.env.local poc/probe-nfts-carteira.ts 0xCARTEIRA
 */

export {}; // arquivo-script

import { createPublicClient, fallback, http, parseAbi, type Address } from "viem";
import { CHAINS, chainInfo } from "../core/chains";
import { UNISWAP_V3_CHAINS } from "../core/adapters/uniswap-v3/config";
import { RAMSES_V3_CHAINS } from "../core/adapters/ramses-v3/config";
import { PANCAKE_V3_CHAINS } from "../core/adapters/pancake-v3/config";
import { UNISWAP_V4_CHAINS } from "../core/adapters/uniswap-v4/config";
import { ramsesPositionsAbi } from "../core/adapters/ramses-v3/abi";

const erc721 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function name() view returns (string)",
]);

/** layout da Uniswap (12 campos) */
const nfpm = parseAbi(["function positions(uint256) view returns (uint256 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"]);
/** a Ramses tem ABI própria (10 campos, sem nonce/operator, tickSpacing no
 *  lugar do fee) — mesmo índice vira erro de decode, por isso o par aqui */
const ramses = ramsesPositionsAbi;

const erc20 = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

function readerFor(chainId: number) {
  const info = chainInfo(chainId);
  const env = process.env[info.rpcEnv]?.split(",")[0]?.trim();
  const rpcs = env ? [env, ...info.defaultRpcs] : info.defaultRpcs;
  return createPublicClient({ chain: info.chain, transport: fallback(rpcs.map((u) => http(u, { timeout: 30_000 }))) });
}

type Alvo = { chainId: number; rotulo: string; nfpm: Address };

async function enumera(c: ReturnType<typeof createPublicClient>, nfpm: Address, conta: Address): Promise<bigint[]> {
  const bal = (await c.readContract({ address: nfpm, abi: erc721, functionName: "balanceOf", args: [conta] }).catch(() => 0n)) as bigint;
  if (bal === 0n) return [];
  const idx = await Promise.all(
    Array.from({ length: Number(bal > 50n ? 50n : bal) }, (_, i) =>
      c.readContract({ address: nfpm, abi: erc721, functionName: "tokenOfOwnerByIndex", args: [conta, bal - 1n - BigInt(i)] }).catch(() => null),
    ),
  );
  return idx.filter((x): x is bigint => x !== null);
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("uso: npx tsx --env-file=.env.local poc/probe-nfts-carteira.ts 0xCARTEIRA");
  const conta = input as Address;

  const alvos: Alvo[] = [
    ...UNISWAP_V3_CHAINS.map((x) => ({ chainId: x.chainId, rotulo: "uniswap-v3", nfpm: x.nfpm })),
    ...UNISWAP_V4_CHAINS.map((x) => ({ chainId: x.chainId, rotulo: "uniswap-v4", nfpm: x.positionManager })),
    ...PANCAKE_V3_CHAINS.map((x) => ({ chainId: x.chainId, rotulo: "pancakeswap-v3", nfpm: x.nfpm })),
    ...RAMSES_V3_CHAINS.map((x) => ({ chainId: x.chainId, rotulo: "ramses-v3", nfpm: x.nfpm })),
  ];
  // contratos NFT que a auditoria (Alchemy) achou e que NÃO estão no registry
  const desconhecidos: Alvo[] = [
    { chainId: 56, rotulo: "NFT-desconhecido@bnb", nfpm: "0x7A4a5c919aE2541AeD11041A1AEeE68f1287f95b" },
  ];

  console.log("NFTs de posição da carteira, NFPM por NFPM (gabarito on-chain)");
  console.log(`Carteira: ${conta}\n`);

  for (const { chainId, rotulo, nfpm: contrato } of [...alvos, ...desconhecidos]) {
    const c = readerFor(chainId);
    const rede = CHAINS[chainId]?.label ?? chainId;
    let ids: bigint[] = [];
    try {
      ids = await enumera(c, contrato, conta);
    } catch (e) {
      console.log(`── ${rotulo} · ${rede}: falhou ao enumerar — ${(e as Error).message.split("\n")[0].slice(0, 80)}`);
      continue;
    }
    if (ids.length === 0) continue;

    console.log(`── ${rotulo} · ${rede} — ${ids.length} NFT(s) @${contrato}`);
    const nome = await c.readContract({ address: contrato, abi: erc721, functionName: "name" }).catch(() => "?");
    console.log(`   contrato name(): ${nome}`);

    for (const id of ids) {
      const ehRamses = rotulo === "ramses-v3";
      const p = (await c
        .readContract({ address: contrato, abi: ehRamses ? ramses : nfpm, functionName: "positions", args: [id] })
        .catch(() => null)) as readonly unknown[] | null;
      if (!p) {
        // não responde a positions() → não é NFPM; tenta dono só para registrar
        console.log(`   #${id}: positions() indisponível (não é NFPM de posição)`);
        continue;
      }
      const t0 = (ehRamses ? p[0] : p[2]) as Address;
      const t1 = (ehRamses ? p[1] : p[3]) as Address;
      const tickLower = Number(ehRamses ? p[3] : p[5]);
      const tickUpper = Number(ehRamses ? p[4] : p[6]);
      const liq = (ehRamses ? p[5] : p[7]) as bigint;
      const ow0 = (ehRamses ? p[8] : p[10]) as bigint;
      const ow1 = (ehRamses ? p[9] : p[11]) as bigint;
      const [s0, s1] = await Promise.all([
        c.readContract({ address: t0, abi: erc20, functionName: "symbol" }).catch(() => t0.slice(0, 6)),
        c.readContract({ address: t1, abi: erc20, functionName: "symbol" }).catch(() => t1.slice(0, 6)),
      ]);
      const status = liq > 0n ? "COM LIQUIDEZ" : ow0 > 0n || ow1 > 0n ? "sem liquidez, mas COM TAXAS" : "fechada (0 e 0)";
      console.log(`   #${id}: ${s0}/${s1} · liq=${liq} · owed=${ow0}/${ow1} · ticks ${tickLower}..${tickUpper} → ${status}`);
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
