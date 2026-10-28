/**
 * PoC — simulador e descoberta para Uniswap v4 (27/10/2026).
 *
 * No v4 o pool não tem endereço: é um id (bytes32) dentro do PoolManager.
 * 1. De onde vem o id? (DexScreener / GeckoTerminal — ver abaixo)
 * 2. StateView: getSlot0 / getLiquidity / getFeeGrowthGlobals pelo id; Δ em
 *    24 h e 15 min num bloco passado provado?
 * 3. PositionManager.poolKeys(bytes25(id)) devolve a PoolKey (tokens, fee,
 *    tickSpacing, hooks)?
 * 4. A DefiLlama tem preço e histórico para o nativo (0x000…) na BNB?
 *
 *   npx tsx --env-file=.env.local poc/probe-v4-simulador.ts 0xID_DO_POOL
 */

import { parseAbi, type Hex } from "viem";
import { createReader } from "../core/chain";
import { UNISWAP_V4_BSC } from "../core/adapters/uniswap-v4/config";

const sv = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128)",
  "function getFeeGrowthGlobals(bytes32 poolId) view returns (uint256 feeGrowthGlobal0, uint256 feeGrowthGlobal1)",
]);
const pm = parseAbi([
  "function poolKeys(bytes25 poolId) view returns (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)",
]);
const tsAbi = parseAbi(["function getCurrentBlockTimestamp() view returns (uint256)"]);


// 1. DexScreener NÃO indexa a v4 na BNB (testado: só pares de 40 hex); a
//    GeckoTerminal indexa, mas o plano grátis bloqueia depois de 2 páginas.
//    O id vem por argumento (copiado da GeckoTerminal ou do app da Uniswap).
const id = (process.argv[2] ?? "") as Hex;
if (!/^0x[0-9a-fA-F]{64}$/.test(id)) throw new Error("passe o id do pool v4 (0x + 64 hex)");

// 2. StateView
const r = createReader(56);
const head = await r.getBlockNumber!();
const ler = async (bn?: bigint) =>
  (
    await r.multicall({
      contracts: [
        { address: UNISWAP_V4_BSC.stateView, abi: sv, functionName: "getSlot0", args: [id] },
        { address: UNISWAP_V4_BSC.stateView, abi: sv, functionName: "getLiquidity", args: [id] },
        { address: UNISWAP_V4_BSC.stateView, abi: sv, functionName: "getFeeGrowthGlobals", args: [id] },
        { address: "0xcA11bde05977b3631167028862bE2a173976CA11", abi: tsAbi, functionName: "getCurrentBlockTimestamp" },
      ],
      allowFailure: true,
      ...(bn === undefined ? {} : { blockNumber: bn }),
    })
  ).map((x) => (x.status === "success" ? x.result : `ERRO ${x.error?.message.slice(0, 60)}`));
const agora = await ler();
console.log(`2. id ${id}\n   slot0 ${String(agora[0])} · L ${agora[1]} · feeGrowthGlobals ${String(agora[2])}`);
for (const horas of [24, 0.25]) {
  try {
    const antes = await ler(head - BigInt(Math.round((horas * 3600) / 0.45)));
    const g0 = (agora[2] as readonly bigint[])[0] - (antes[2] as readonly bigint[])[0];
    const g1 = (agora[2] as readonly bigint[])[1] - (antes[2] as readonly bigint[])[1];
    console.log(`   janela ${horas} h: ${Number((agora[3] as bigint) - (antes[3] as bigint))}s provados · Δfg0 ${g0} Δfg1 ${g1}`);
  } catch (e) {
    console.log(`   janela ${horas} h: ❌ ${(e as Error).message.split("\n")[0].slice(0, 80)}`);
  }
}

// 3. PoolKey
const key = await r
  .readContract({ address: UNISWAP_V4_BSC.positionManager, abi: pm, functionName: "poolKeys", args: [id.slice(0, 52) as Hex] })
  .catch((e) => `ERRO ${(e as Error).message.slice(0, 60)}`);
console.log(`3. poolKeys: ${String(key)}`);

// 4. nativo na DefiLlama
const nat = await (await fetch("https://coins.llama.fi/prices/current/bsc:0x0000000000000000000000000000000000000000")).json();
const start = Math.floor(Date.now() / 1000) - 7 * 86400;
const hist = (await (
  await fetch(`https://coins.llama.fi/chart/bsc:0x0000000000000000000000000000000000000000?start=${start}&span=169&period=1h`)
).json()) as { coins: Record<string, { prices: unknown[] }> };
console.log(`4. preço do nativo: ${JSON.stringify(nat.coins)} · histórico: ${Object.values(hist.coins ?? {})[0]?.prices.length ?? 0} pontos`);
