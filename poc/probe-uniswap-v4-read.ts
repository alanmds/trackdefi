/**
 * PoC da Receita D — Uniswap v4, PASSO 1: **ler a posição**.
 *
 * O passo 0 (`poc/probe-uniswap-v4.ts`) resolveu QUAIS NFTs a carteira tem na
 * Robinhood Chain. Este resolve o que CADA um é: par, faixa, liquidez e
 * quantidades. Ainda sem taxas pendentes — essa é a parte cara e vem depois.
 *
 * O que é novo em relação ao v3 (e por isso merece PoC próprio):
 *  - o pool não é um contrato: é uma chave (`PoolKey`) dentro do singleton
 *    `PoolManager`, identificada por `poolId = keccak256(abi.encode(PoolKey))`;
 *  - o estado do pool sai do `StateView`, não do pool;
 *  - faixa e poolId vêm EMPACOTADOS num uint256 (`PositionInfo`), que este
 *    PoC desempacota e **confere** de duas formas independentes.
 *
 * A matemática de amounts é a que já temos (`core/math/`), sem uma linha nova.
 *
 *   npx tsx poc/probe-uniswap-v4-read.ts [0xCARTEIRA]
 */

export {}; // arquivo-script

import {
  createPublicClient,
  encodeAbiParameters,
  erc20Abi,
  fallback,
  formatUnits,
  http,
  keccak256,
  parseAbi,
  parseAbiItem,
  type Address,
} from "viem";
import { robinhood } from "viem/chains";
import { chainInfo } from "../core/chains";
import { amountsForLiquidity } from "../core/math/liquidity";
import { getSqrtRatioAtTick } from "../core/math/tickmath";
import { isInRange, tickToPrice0In1 } from "../core/math/ticks";

const CHAIN_ID = 4663;
const POSITION_MANAGER: Address = "0x58daec3116aae6d93017baaea7749052e8a04fa7";
const STATE_VIEW: Address = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
const DEFAULT_WALLET: Address = "0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC";

/** endereço zero = moeda nativa da rede (o v4 trata ETH nativo como currency) */
const NATIVE: Address = "0x0000000000000000000000000000000000000000";

const pmAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "function getPoolAndPositionInfo(uint256 tokenId) view returns (PoolKey memory, uint256)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128)",
  "function ownerOf(uint256) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
]);

const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");

/**
 * Desempacota o `PositionInfo` (uint256) do v4.
 *
 * Layout do `PositionInfoLibrary` do contrato:
 *   [bits 255..56] poolId truncado em 25 bytes · [55..32] tickUpper (int24)
 *   [31..8] tickLower (int24) · [7..0] flag de subscriber
 *
 * Este PoC NÃO confia nesse layout de cabeça: ele confere o poolId
 * desempacotado contra o `keccak256(abi.encode(PoolKey))` calculado à parte.
 * Se os 25 bytes não baterem, o layout está errado e o PoC falha alto.
 */
function unpackPositionInfo(info: bigint) {
  const toInt24 = (v: bigint) => {
    const x = Number(v & 0xffffffn);
    return x >= 0x800000 ? x - 0x1000000 : x;
  };
  return {
    tickUpper: toInt24(info >> 32n),
    tickLower: toInt24(info >> 8n),
    hasSubscriber: (info & 0xffn) !== 0n,
    /** os 25 bytes altos do poolId, para conferência */
    poolIdTruncado: info >> 56n,
  };
}

function poolIdOf(key: {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}) {
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "currency0", type: "address" },
            { name: "currency1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "tickSpacing", type: "int24" },
            { name: "hooks", type: "address" },
          ],
        },
      ],
      [key],
    ),
  );
}

const ok = (m: string) => console.log(`   ✅ ${m}`);
const bad = (m: string) => console.log(`   ❌ ${m}`);

async function main() {
  const wallet = (process.argv[2] as Address) ?? DEFAULT_WALLET;
  const client = createPublicClient({
    chain: robinhood,
    transport: fallback(chainInfo(CHAIN_ID).defaultRpcs.map((u) => http(u, { timeout: 30_000 }))),
  });

  console.log("PoC Receita D — Uniswap v4, passo 1: ler a posição (Robinhood Chain)");
  console.log(`Carteira: ${wallet}\n`);

  // 1. enumerar (caminho provado no passo 0: getLogs numa chamada só)
  const head = await client.getBlockNumber();
  const logs = await client.getLogs({
    address: POSITION_MANAGER,
    event: transferEvent,
    args: { to: wallet },
    fromBlock: 0n,
    toBlock: head,
  });
  const candidatos = [...new Set(logs.map((l) => l.args.tokenId!))];
  const donos = await Promise.all(
    candidatos.map((id) =>
      client.readContract({ address: POSITION_MANAGER, abi: pmAbi, functionName: "ownerOf", args: [id] }).catch(() => null),
    ),
  );
  const ids = candidatos.filter((_, i) => (donos[i] as Address | null)?.toLowerCase() === wallet.toLowerCase());

  const esperado = (await client.readContract({
    address: POSITION_MANAGER,
    abi: pmAbi,
    functionName: "balanceOf",
    args: [wallet],
  })) as bigint;
  if (BigInt(ids.length) === esperado) ok(`enumeração: ${ids.length}/${esperado} posições`);
  else {
    bad(`enumeração: ${ids.length}/${esperado} — divergiu do balanceOf`);
    process.exit(1);
  }

  // 2. ler cada posição
  let layoutOk = 0;
  const simbolos = new Map<Address, { symbol: string; decimals: number }>();
  const meta = async (a: Address) => {
    if (a === NATIVE) return { symbol: chainInfo(CHAIN_ID).chain.nativeCurrency.symbol, decimals: 18 };
    if (!simbolos.has(a)) {
      const [symbol, decimals] = await Promise.all([
        client.readContract({ address: a, abi: erc20Abi, functionName: "symbol" }).catch(() => "?"),
        client.readContract({ address: a, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
      ]);
      simbolos.set(a, { symbol: symbol as string, decimals: decimals as number });
    }
    return simbolos.get(a)!;
  };

  for (const id of ids) {
    const [keyRaw, info] = (await client.readContract({
      address: POSITION_MANAGER,
      abi: pmAbi,
      functionName: "getPoolAndPositionInfo",
      args: [id],
    })) as [{ currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }, bigint];

    const liquidity = (await client.readContract({
      address: POSITION_MANAGER,
      abi: pmAbi,
      functionName: "getPositionLiquidity",
      args: [id],
    })) as bigint;

    const { tickLower, tickUpper, hasSubscriber, poolIdTruncado } = unpackPositionInfo(info);
    const poolId = poolIdOf(keyRaw);

    // conferência do layout: os 25 bytes altos do info têm de ser o poolId
    const confere = BigInt(poolId) >> 56n === poolIdTruncado;
    if (confere) layoutOk++;

    const [t0, t1] = await Promise.all([meta(keyRaw.currency0), meta(keyRaw.currency1)]);
    const [sqrtPriceX96, tickAtual] = (await client.readContract({
      address: STATE_VIEW,
      abi: stateViewAbi,
      functionName: "getSlot0",
      args: [poolId],
    })) as [bigint, number, number, number];

    const { amount0, amount1 } = amountsForLiquidity(
      liquidity,
      sqrtPriceX96,
      getSqrtRatioAtTick(tickLower),
      getSqrtRatioAtTick(tickUpper),
    );

    const fmt = (v: bigint, d: number) =>
      Number(formatUnits(v, d)).toLocaleString("pt-BR", { maximumFractionDigits: 6 });
    const naFaixa = isInRange(tickAtual, tickLower, tickUpper);
    const pLow = tickToPrice0In1(tickLower, t0.decimals, t1.decimals);
    const pHigh = tickToPrice0In1(tickUpper, t0.decimals, t1.decimals);
    const semHook = keyRaw.hooks === NATIVE;

    console.log(`\n── NFT #${id} · ${t0.symbol}/${t1.symbol} · fee ${keyRaw.fee / 10_000}%`);
    console.log(`   ${t0.symbol}: ${fmt(amount0, t0.decimals)}   ${t1.symbol}: ${fmt(amount1, t1.decimals)}`);
    console.log(
      `   Faixa: ${pLow.toLocaleString("pt-BR", { maximumSignificantDigits: 6 })} – ${pHigh.toLocaleString("pt-BR", { maximumSignificantDigits: 6 })} ${t1.symbol}/${t0.symbol} → ${naFaixa ? "✅ NA FAIXA" : "⚠️ FORA DA FAIXA"}`,
    );
    console.log(
      `   liquidez ${liquidity} · tickSpacing ${keyRaw.tickSpacing} · hook ${semHook ? "nenhum (padrão)" : keyRaw.hooks}${hasSubscriber ? " · COM subscriber" : ""}`,
    );
    console.log(`   poolId ${poolId.slice(0, 18)}… ${confere ? "✅ layout do PositionInfo confere" : "❌ layout NÃO confere"}`);
  }

  console.log("\n━━ Resumo ━━");
  if (layoutOk === ids.length) ok(`PositionInfo desempacotado corretamente em ${layoutOk}/${ids.length} posições`);
  else {
    bad(`layout do PositionInfo falhou em ${ids.length - layoutOk} de ${ids.length}`);
    process.exit(1);
  }
  console.log("\n✅ Passo 1 OK — par, faixa, liquidez e quantidades lidos. Falta: taxas pendentes.");
}

main().catch((e) => {
  console.error(`\n❌ PoC falhou: ${(e as Error).message.split("\n")[0]}`);
  process.exit(1);
});
