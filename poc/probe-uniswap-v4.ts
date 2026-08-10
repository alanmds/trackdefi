/**
 * PoC da Receita D — Uniswap v4, PASSO 0: **enumerar as posições**.
 *
 * Por que este é o passo 0 e não a matemática: no v3 o NFPM é
 * ERC721Enumerable e basta perguntar ao contrato quais NFTs a carteira tem.
 * O PositionManager do v4 NÃO é (medido em 10/08/2026:
 * `supportsInterface(0x780e9d63)` = false, sem `totalSupply()`). Sem resolver
 * isto, nenhuma conta de amounts ou fees serve para nada — não há como saber
 * *de quais* posições falar.
 *
 * Compara os caminhos possíveis contra um gabarito on-chain (`balanceOf`):
 *   A. API de NFTs por dono do Blockscout da rede;
 *   B. getLogs do evento Transfer do PositionManager.
 *
 * Endereços da doc OFICIAL (developers.uniswap.org → v4 → deployments),
 * lidos em 10/08/2026.
 *
 *   npx tsx poc/probe-uniswap-v4.ts [0xCARTEIRA]
 */

export {}; // arquivo-script

import { createPublicClient, fallback, http, parseAbi, parseAbiItem, type Address, type Chain } from "viem";
import { base, robinhood } from "viem/chains";
import { chainInfo } from "../core/chains";

/** carteira do Alan — tem posições v4 nas duas redes (conferido em 10/08) */
const DEFAULT_WALLET: Address = "0x05963CdCc69CD5B1A06353b2d1098C447E1D75aC";

interface V4Chain {
  name: string;
  chain: Chain;
  chainId: number;
  positionManager: Address;
  stateView: Address;
  /** API do Blockscout da rede, sem barra no fim; null = a rede não tem */
  blockscout: string | null;
}

const V4_CHAINS: V4Chain[] = [
  {
    name: "Robinhood",
    chain: robinhood,
    chainId: 4663,
    positionManager: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
    stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
    blockscout: "https://robinhoodchain.blockscout.com",
  },
  {
    name: "Base",
    chain: base,
    chainId: 8453,
    positionManager: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
    stateView: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
    blockscout: "https://base.blockscout.com",
  },
];

const erc721Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
]);
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");

const ok = (m: string) => console.log(`   ✅ ${m}`);
const bad = (m: string) => console.log(`   ❌ ${m}`);
const info = (m: string) => console.log(`   ℹ  ${m}`);

type Client = ReturnType<typeof createPublicClient>;

/** Caminho A — Blockscout: /api/v2/addresses/{addr}/nft, paginado. */
async function viaBlockscout(c: V4Chain, wallet: Address): Promise<bigint[] | null> {
  if (!c.blockscout) return null;
  const ids: bigint[] = [];
  let url: string | null = `${c.blockscout}/api/v2/addresses/${wallet}/nft?type=ERC-721`;
  for (let page = 0; url && page < 20; page++) {
    const r: Response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as {
      items?: { id?: string; token?: { address?: string; address_hash?: string } }[];
      next_page_params?: Record<string, string | number> | null;
    };
    for (const it of j.items ?? []) {
      const addr = (it.token?.address ?? it.token?.address_hash ?? "").toLowerCase();
      if (addr === c.positionManager.toLowerCase() && it.id != null) ids.push(BigInt(it.id));
    }
    const next = j.next_page_params;
    url = next ? `${c.blockscout}/api/v2/addresses/${wallet}/nft?type=ERC-721&${new URLSearchParams(next as Record<string, string>)}` : null;
  }
  return ids;
}

/** Caminho B — getLogs do Transfer, em janelas. Devolve null se o RPC recusar. */
async function viaLogs(client: Client, c: V4Chain, wallet: Address, head: bigint): Promise<bigint[] | null> {
  const recebidos = new Set<bigint>();
  // tenta de uma vez; se o RPC recusar a faixa, cai para janelas
  for (const janela of [head, 500_000n, 100_000n, 10_000n]) {
    recebidos.clear();
    let chamadas = 0;
    try {
      for (let to = head; to > 0n; to -= janela + 1n) {
        const from = to > janela ? to - janela : 0n;
        const logs = await client.getLogs({
          address: c.positionManager,
          event: transferEvent,
          args: { to: wallet },
          fromBlock: from,
          toBlock: to,
        });
        chamadas++;
        for (const l of logs) if (l.args.tokenId != null) recebidos.add(l.args.tokenId);
        if (from === 0n) break;
        if (chamadas > 40) {
          info(`getLogs: abortado em ${chamadas} chamadas com janela de ${janela} blocos — inviável nesta rede`);
          return null;
        }
      }
      info(`getLogs funcionou com janela de ${janela} blocos · ${chamadas} chamada(s)`);
      return [...recebidos];
    } catch (e) {
      const msg = (e as Error).message.split("\n")[0].slice(0, 70);
      info(`janela de ${janela} recusada (${msg}) — tentando menor`);
    }
  }
  return null;
}

/** confere quais dos ids ainda pertencem à carteira (NFT pode ter saído) */
async function aindaDoDono(client: Client, c: V4Chain, ids: bigint[], wallet: Address) {
  const donos = await Promise.all(
    ids.map((id) =>
      client
        .readContract({ address: c.positionManager, abi: erc721Abi, functionName: "ownerOf", args: [id] })
        .catch(() => null),
    ),
  );
  return ids.filter((_, i) => (donos[i] as Address | null)?.toLowerCase() === wallet.toLowerCase());
}

async function probe(c: V4Chain, wallet: Address) {
  console.log(`\n━━ ${c.name} (chainId ${c.chainId}) ━━`);
  const rpcs = chainInfo(c.chainId).defaultRpcs;
  const client = createPublicClient({
    chain: c.chain,
    transport: fallback(rpcs.map((u) => http(u, { timeout: 30_000 }))),
  });

  const head = await client.getBlockNumber();

  // gabarito: quantas posições a carteira REALMENTE tem
  const esperado = (await client.readContract({
    address: c.positionManager,
    abi: erc721Abi,
    functionName: "balanceOf",
    args: [wallet],
  })) as bigint;
  info(`bloco ${head} · balanceOf = ${esperado} posição(ões) — este é o gabarito`);
  if (esperado === 0n) {
    info("carteira sem posições v4 nesta rede — nada a comparar");
    return;
  }

  // A. Blockscout
  const tA = Date.now();
  try {
    const ids = await viaBlockscout(c, wallet);
    const dt = ((Date.now() - tA) / 1000).toFixed(1);
    if (ids === null) info("Blockscout: rede sem instância conhecida");
    else if (BigInt(ids.length) === esperado) ok(`Blockscout: ${ids.length}/${esperado} em ${dt} s — CONFERE`);
    else bad(`Blockscout: ${ids.length}/${esperado} em ${dt} s — NÃO confere`);
    if (ids?.length) info(`   ids: ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? " …" : ""}`);
  } catch (e) {
    bad(`Blockscout falhou: ${(e as Error).message.split("\n")[0]}`);
  }

  // B. getLogs
  const tB = Date.now();
  const recebidos = await viaLogs(client, c, wallet, head);
  if (recebidos === null) {
    bad("getLogs: nenhum tamanho de janela funcionou");
  } else {
    const vivos = await aindaDoDono(client, c, recebidos, wallet);
    const dt = ((Date.now() - tB) / 1000).toFixed(1);
    if (BigInt(vivos.length) === esperado) ok(`getLogs: ${vivos.length}/${esperado} em ${dt} s — CONFERE`);
    else bad(`getLogs: ${vivos.length}/${esperado} em ${dt} s (${recebidos.length} recebidos algum dia) — NÃO confere`);
  }
}

async function main() {
  const wallet = (process.argv[2] as Address) ?? DEFAULT_WALLET;
  console.log("PoC Receita D — Uniswap v4, passo 0: enumerar posições");
  console.log(`Carteira: ${wallet}`);
  for (const c of V4_CHAINS) {
    try {
      await probe(c, wallet);
    } catch (e) {
      bad(`erro inesperado: ${(e as Error).message.split("\n")[0]}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
