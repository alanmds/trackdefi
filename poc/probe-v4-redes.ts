/**
 * PoC — Uniswap v4 em mais redes (passo 8 da meta de cobertura total).
 *
 * Endereços da doc OFICIAL (developers.uniswap.org → v4 → deployments, lida em
 * 28/10/2026). Para cada rede confere on-chain que:
 *  1. PositionManager responde `name()` = "Uniswap v4 Positions NFT";
 *  2. StateView e PoolManager têm código;
 *  3. a StateView lê o slot0 de um pool de verdade (o do NFT mais recente);
 *  4. a API indexada (`alchemy_getAssetTransfers`) enxerga o dono desse NFT
 *     e devolve o id — é a fonte que o adapter usa (`enumeration: "index"`).
 * Nenhuma carteira fica no arquivo (o dono sai do `ownerOf` do último NFT) e
 * a chave Alchemy vem do `.env.local`, nunca é impressa.
 *
 *   npx tsx --env-file=.env.local poc/probe-v4-redes.ts
 */

export {}; // arquivo-script

import { createPublicClient, http, type Address } from "viem";
import { positionManagerAbi, stateViewAbi, poolIdOf, unpackPositionInfo } from "../core/adapters/uniswap-v4/abi";

const base = (process.env.BASE_RPC_URLS ?? "").split(",")[0].trim();
if (!base.includes("alchemy.com")) throw new Error("precisa de BASE_RPC_URLS da Alchemy no .env.local");
const KEY = base.split("?")[0].split("/").pop()!;

interface Rede {
  nome: string;
  host: string;
  pm: Address;
  stateView: Address;
  poolManager: Address;
}

const REDES: Rede[] = [
  { nome: "Ethereum", host: "eth-mainnet", pm: "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e", stateView: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227", poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90" },
  { nome: "Base", host: "base-mainnet", pm: "0x7c5f5a4bbd8fd63184577525326123b519429bdc", stateView: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71", poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b" },
  { nome: "Optimism", host: "opt-mainnet", pm: "0x3c3ea4b57a46241e54610e5f022e5c45859a1017", stateView: "0xc18a3169788f4f75a170290584eca6395c75ecdb", poolManager: "0x9a13f98cb987694c9f086b1f5eb990eea8264ec3" },
  { nome: "Arbitrum", host: "arb-mainnet", pm: "0xd88f38f930b7952f2db2432cb002e7abbf3dd869", stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990", poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32" },
  { nome: "Unichain", host: "unichain-mainnet", pm: "0x4529a01c7a0410167c5740c487a8de60232617bf", stateView: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2", poolManager: "0x1f98400000000000000000000000000000000004" },
  { nome: "Ink", host: "ink-mainnet", pm: "0x1b35d13a2e2528f192637f14b05f0dc0e7deb566", stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990", poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32" },
  { nome: "Soneium", host: "soneium-mainnet", pm: "0x1b35d13a2e2528f192637f14b05f0dc0e7deb566", stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990", poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32" },
  { nome: "Celo", host: "celo-mainnet", pm: "0xf7965f3981e4d5bc383bfbcb61501763e9068ca9", stateView: "0xbc21f8720babf4b20d195ee5c6e99c52b76f2bfb", poolManager: "0x288dc841A52FCA2707c6947B3A777c5E56cd87BC" },
  { nome: "HyperEVM", host: "hyperliquid-mainnet", pm: "0x0d7Ab5B3db668128Aff6F70C4eBC71D7d4DA9bf9", stateView: "0x1656326235cb9E34Cb58CaDe53AE30789AB32A1A", poolManager: "0x12D4Fd9C5DeDd00ab8a0bCe2CF0167bbf94b6B1F" },
];

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function sonda(r: Rede) {
  const url = `https://${r.host}.g.alchemy.com/v2/${KEY}`;
  const c = createPublicClient({ transport: http(url, { timeout: 20_000 }) });
  const linhas: string[] = [];
  const ok = (b: boolean, t: string) => linhas.push(`   ${b ? "✅" : "❌"} ${t}`);

  const nome = await c
    .readContract({ address: r.pm, abi: [{ type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }], functionName: "name" })
    .catch((e) => `ERRO ${(e as Error).message.split("\n")[0].slice(0, 70)}`);
  ok(nome === "Uniswap v4 Positions NFT", `PositionManager name() = ${nome}`);

  for (const [rot, a] of [["StateView", r.stateView], ["PoolManager", r.poolManager]] as const) {
    const code = await c.getCode({ address: a }).catch(() => undefined);
    ok(!!code && code !== "0x", `${rot} tem código`);
  }

  // NFT mais recente: nextTokenId() - 1 (começa em 1). Tenta alguns para fugir de queimados.
  const next = await c.readContract({ address: r.pm, abi: [{ type: "function", name: "nextTokenId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }], functionName: "nextTokenId" }).catch(() => null);
  if (next === null) return [...linhas, "   ❌ nextTokenId indisponível"];
  linhas.push(`   · nextTokenId = ${next} (NFTs criados: ${(next as bigint) - 1n})`);

  let id: bigint | null = null;
  let dono: Address | null = null;
  for (let k = 1n; k <= 6n && (next as bigint) - k > 0n; k++) {
    const cand = (next as bigint) - k;
    const o = await c.readContract({ address: r.pm, abi: positionManagerAbi, functionName: "ownerOf", args: [cand] }).catch(() => null);
    if (o) { id = cand; dono = o as Address; break; }
  }
  if (id === null || !dono) return [...linhas, "   ⚠ nenhum dos 6 NFTs mais recentes tem dono (queimados) — rede quase sem uso"];

  const info = await c.readContract({ address: r.pm, abi: positionManagerAbi, functionName: "getPoolAndPositionInfo", args: [id] }).catch(() => null);
  if (!info) return [...linhas, `   ❌ getPoolAndPositionInfo(#${id}) falhou`];
  const [key, packed] = info as readonly [{ currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }, bigint];
  const poolId = poolIdOf(key);
  const un = unpackPositionInfo(packed);
  const slot = await c.readContract({ address: r.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [poolId] }).catch(() => null);
  ok(!!slot && (slot as readonly unknown[])[0] !== 0n, `StateView.getSlot0 lê o pool do NFT #${id} (ticks ${un.tickLower}…${un.tickUpper})`);

  // a fonte do adapter: índice de transferências para o dono (paginado, como no adapter)
  const ids: bigint[] = [];
  let pageKey: string | undefined;
  let erro: string | null = null;
  for (let p = 0; p < 40; p++) {
    const resp = (await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers",
        params: [{ fromBlock: "0x0", toBlock: "latest", category: ["erc721"], toAddress: dono, contractAddresses: [r.pm], withMetadata: false, pageKey }],
      }),
    }).then((x) => x.json()).catch((e) => ({ error: { message: String(e) } }))) as { result?: { transfers?: Array<{ tokenId?: string }>; pageKey?: string }; error?: { message: string } };
    if (resp.error) { erro = resp.error.message.slice(0, 90); break; }
    for (const t of resp.result?.transfers ?? []) if (t.tokenId) ids.push(BigInt(t.tokenId));
    pageKey = resp.result?.pageKey;
    if (!pageKey) break;
  }
  ok(!erro && ids.includes(id), erro ? `índice recusou: ${erro}` : `índice (alchemy_getAssetTransfers) devolve o NFT #${id} do dono ${short(dono)} (${ids.length} candidatos)`);
  return linhas;
}

async function main() {
  for (const r of REDES) {
    console.log(`━━ ${r.nome} (${r.host})`);
    try {
      console.log((await sonda(r)).join("\n"));
    } catch (e) {
      console.log(`   ❌ ${(e as Error).message.split("\n")[0]}`);
    }
  }
}
main();
