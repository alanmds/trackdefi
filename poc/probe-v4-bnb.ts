/**
 * Uniswap v4 NA BNB CHAIN — rede que ainda NÃO está no nosso registry (só a
 * Robinhood está; ver core/adapters/uniswap-v4/config.ts).
 *
 * Confirmado na doc oficial (developers.uniswap.org → docs/protocols/v4/
 * deployments, BNB Smart Chain: 56) em 06/10/2026:
 *   PositionManager 0x7a4a5c919ae2541aed11041a1aeee68f1287f95b  (= o contrato
 *   que a auditoria da carteira achou com 6 NFTs nossos)
 *   StateView       0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4
 *   PoolManager     0x28e2ea090877bf75740558f6bfb36a5ffee9e9df
 *
 * Lê cada NFT com a MESMA ABI do adapter (core/adapters/uniswap-v4/abi.ts) —
 * `positions()` não existe no v4, quem responde é `getPoolAndPositionInfo` +
 * `getPositionLiquidity`. Responde "esta carteira tem posição v4 com liquidez?".
 *
 *   npx tsx --env-file=.env.local poc/probe-v4-bnb.ts 0xCARTEIRA [tokenId …]
 */

export {}; // arquivo-script

import { createPublicClient, fallback, http, type Address } from "viem";
import { bsc } from "viem/chains";
import { erc20Abi } from "viem";
import { positionManagerAbi, stateViewAbi, NATIVE_CURRENCY, unpackPositionInfo, poolIdOf } from "../core/adapters/uniswap-v4/abi";

const PM = "0x7a4a5c919ae2541aed11041a1aeee68f1287f95b" as Address;
const STATE_VIEW = "0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4" as Address;

const RPCS = (process.env.BSC_RPC_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const c = createPublicClient({
  chain: bsc,
  transport: fallback([...RPCS, "https://bsc-dataseed.bnbchain.org", "https://bsc-rpc.publicnode.com"].map((u) => http(u, { timeout: 30_000 }))),
});

async function moeda(addr: Address): Promise<string> {
  if (addr === NATIVE_CURRENCY) return "BNB";
  const s = await c.readContract({ address: addr, abi: erc20Abi, functionName: "symbol" }).catch(() => addr.slice(0, 6));
  return s;
}

async function main() {
  const [conta, ...idsArg] = process.argv.slice(2);
  if (!conta) throw new Error("uso: npx tsx --env-file=.env.local poc/probe-v4-bnb.ts 0xCARTEIRA [tokenId …]");

  const nome = await c.readContract({ address: PM, abi: positionManagerAbi, functionName: "balanceOf", args: [conta as Address] }).catch(() => null);
  console.log(`Uniswap v4 PositionManager (BNB Chain) ${PM}`);
  console.log(`balanceOf = ${nome ?? "?"} posição(ões) desta carteira\n`);

  const ids = idsArg.length ? idsArg.map(BigInt) : [];
  for (const id of ids) {
    const info = await c
      .readContract({ address: PM, abi: positionManagerAbi, functionName: "getPoolAndPositionInfo", args: [id] })
      .catch((e) => {
        console.log(`  #${id}: getPoolAndPositionInfo ERRO ${(e as Error).message.split("\n")[0].slice(0, 100)}`);
        return null;
      });
    if (!info) continue;

    const [key, packed] = info as readonly [{ currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }, bigint];
    const { tickLower, tickUpper } = unpackPositionInfo(packed);
    const liq = (await c.readContract({ address: PM, abi: positionManagerAbi, functionName: "getPositionLiquidity", args: [id] }).catch(() => 0n)) as bigint;

    const [m0, m1] = await Promise.all([moeda(key.currency0), moeda(key.currency1)]);

    // o poolId correto é o keccak da PoolKey (o `packed` guarda só 25 bytes dela)
    const poolId = poolIdOf(key);
    const s = await c.readContract({ address: STATE_VIEW, abi: stateViewAbi, functionName: "getSlot0", args: [poolId] }).catch(() => null);
    const tickAtual = s ? Number((s as readonly [bigint, number, number, number])[1]) : null;
    const emFaixa = tickAtual !== null && tickAtual >= tickLower && tickAtual < tickUpper;

    const status = liq > 0n ? (emFaixa ? "COM LIQUIDEZ · NA FAIXA" : tickAtual !== null ? "COM LIQUIDEZ · FORA DA FAIXA" : "COM LIQUIDEZ") : "fechada (0)";
    const hooks = key.hooks === "0x0000000000000000000000000000000000000000" ? "sem hook" : `hook ${key.hooks.slice(0, 10)}`;
    console.log(
      `  #${id}: ${m0}/${m1} fee ${key.fee / 10_000}% ts ${key.tickSpacing} ${hooks} · ticks ${tickLower}..${tickUpper}` +
        `${tickAtual !== null ? ` · atual ${tickAtual}` : ""} · liq=${liq} → ${status}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
