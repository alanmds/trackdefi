/**
 * PoC — as APIs indexadas da Alchemy destravam as expansões "difíceis"?
 * (02/10/2026, plano de cobertura total — `privado/PLAYBOOK_EXPANSAO.md`).
 *
 * Dois bloqueios conhecidos, e a hipótese de cada um:
 *  1. Uniswap v4 (e forks singleton: PancakeSwap Infinity, Ekubo): o NFT de
 *     posição NÃO é enumerável, e hoje descobrimos as posições varrendo o
 *     histórico de `Transfer` — que nenhum RPC grátis aceita fora da Robinhood
 *     (a Alchemy grátis limita `eth_getLogs` a 10 blocos).
 *     HIPÓTESE: a NFT API (`getNFTsForOwner` filtrada pelo PositionManager)
 *     devolve os NFTs da carteira direto, sem varrer nada.
 *  2. Pools clássicos (Uniswap/PancakeSwap/SushiSwap v2…): a posição é um
 *     token ERC-20 de LP, e não há lista "LPs desta carteira".
 *     HIPÓTESE: a Token API (`alchemy_getTokenBalances`) devolve todos os
 *     ERC-20 com saldo, LPs inclusive.
 *
 * Para cada teste, acha uma carteira on-chain (dono de um NFT recente / quem
 * recebeu LP há pouco) e confere se a API a enxerga. Nenhuma carteira fica no
 * arquivo; a chave sai do `.env.local` e nunca é impressa.
 *
 *   npx tsx --env-file=.env.local poc/probe-alchemy-indexers.ts
 */

export {}; // arquivo-script

import { createPublicClient, http, parseAbi, parseAbiItem, type Address } from "viem";

const base = (process.env.BASE_RPC_URLS ?? "").split(",")[0].trim();
if (!base.includes("alchemy.com")) throw new Error("precisa de BASE_RPC_URLS da Alchemy no .env.local");
const KEY = base.split("/").pop()!;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** PositionManager do Uniswap v4 por rede da Alchemy — doc oficial
 *  (developers.uniswap.org → v4 → deployments); Base e Robinhood já
 *  confirmados no `core/adapters/uniswap-v4/config.ts`. */
const V4: Array<{ net: string; pm: Address }> = [
  { net: "base-mainnet", pm: "0x7c5f5a4bbd8fd63184577525326123b519429bdc" },
  { net: "robinhood-mainnet", pm: "0x58daec3116aae6d93017baaea7749052e8a04fa7" },
];

const pmAbi = parseAbi([
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
]);

async function nftApi(net: string, owner: string, contract: string) {
  const u = `https://${net}.g.alchemy.com/nft/v3/${KEY}/getNFTsForOwner?owner=${owner}&contractAddresses[]=${contract}&withMetadata=false&pageSize=100`;
  const r = await fetch(u);
  const j = (await r.json().catch(() => ({}))) as { ownedNfts?: Array<{ tokenId: string }>; totalCount?: number; error?: unknown; message?: string };
  return { status: r.status, ids: (j.ownedNfts ?? []).map((n) => BigInt(n.tokenId)), total: j.totalCount, erro: j.error ?? j.message };
}

async function testeV4() {
  console.log("━━ 1. NFT API × Uniswap v4 (posições não enumeráveis)");
  for (const { net, pm } of V4) {
    const c = createPublicClient({ transport: http(`https://${net}.g.alchemy.com/v2/${KEY}`) });
    try {
      const next = await c.readContract({ address: pm, abi: pmAbi, functionName: "nextTokenId" });
      // um NFT recente que ainda exista
      let id = next - 1n, dono: Address | null = null;
      for (let k = 0; k < 30 && !dono; k++, id--) {
        dono = await c.readContract({ address: pm, abi: pmAbi, functionName: "ownerOf", args: [id] }).catch(() => null);
      }
      if (!dono) { console.log(`   ${net}: nenhum NFT recente encontrado`); continue; }
      const naCadeia = await c.readContract({ address: pm, abi: pmAbi, functionName: "balanceOf", args: [dono] });
      const t = Date.now();
      const api = await nftApi(net, dono, pm);
      const achou = api.ids.includes(id + 1n) || api.ids.includes(id);
      console.log(`   ${net}: dono ${short(dono)} tem ${naCadeia} NFT(s) na cadeia · API HTTP ${api.status} devolveu ${api.ids.length}${api.total !== undefined ? ` (total ${api.total})` : ""} em ${Date.now() - t} ms · NFT recente presente: ${achou ? "✅" : "❌"}${api.erro ? ` · erro: ${JSON.stringify(api.erro).slice(0, 120)}` : ""}`);
    } catch (e) {
      console.log(`   ${net}: ❌ ${(e as Error).message.split("\n")[0].slice(0, 140)}`);
    }
  }
}

async function testeV2() {
  console.log("\n━━ 2. Token API × pool clássico (LP ERC-20) — Uniswap v2 USDC/WETH na Ethereum");
  const net = "eth-mainnet";
  const PAIR = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc" as Address; // Uniswap v2 USDC/WETH (par mais antigo e conhecido)
  const c = createPublicClient({ transport: http(`https://${net}.g.alchemy.com/v2/${KEY}`) });
  const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
  const head = await c.getBlockNumber();
  let quem: Address | null = null;
  // janelas de 10 blocos (o máximo da Alchemy grátis), voltando até achar quem recebeu LP
  for (let k = 0n; k < 60n && !quem; k++) {
    const to = head - k * 10n, from = to - 9n;
    const logs = await c.getLogs({ address: PAIR, event: transfer, fromBlock: from, toBlock: to }).catch(() => []);
    const r = logs.find((l) => l.args.to && !/^0x0+$/.test(l.args.to) && l.args.to.toLowerCase() !== PAIR.toLowerCase());
    if (r) quem = r.args.to!;
  }
  if (!quem) return console.log("   nenhuma transferência de LP nas últimas ~600 janelas de blocos — sem carteira para testar");
  const bal = await c.readContract({ address: PAIR, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [quem] });
  // todas as páginas (100 tokens cada) — carteira ativa costuma ter centenas,
  // a maioria spam de airdrop
  type Resp = { result?: { tokenBalances: Array<{ contractAddress: string; tokenBalance: string }>; pageKey?: string }; error?: { message: string } };
  const lista: Array<{ contractAddress: string }> = [];
  let pageKey: string | undefined, paginas = 0, erro = "";
  const t = Date.now();
  do {
    const r = await fetch(`https://${net}.g.alchemy.com/v2/${KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getTokenBalances", params: [quem, "erc20", ...(pageKey ? [{ pageKey }] : [])] }),
    });
    const j = (await r.json()) as Resp;
    if (j.error) { erro = j.error.message; break; }
    lista.push(...(j.result?.tokenBalances ?? []));
    pageKey = j.result?.pageKey;
    paginas++;
  } while (pageKey && paginas < 30);
  const lp = lista.find((x) => x.contractAddress.toLowerCase() === PAIR.toLowerCase());
  console.log(`   carteira ${short(quem)}: saldo de LP na cadeia ${bal} · API devolveu ${lista.length} token(s) em ${paginas} página(s), ${Date.now() - t} ms${pageKey ? " (parou no teto de 30 páginas)" : ""} · LP presente: ${lp ? "✅" : bal === 0n ? "— (já saiu do LP)" : "❌"}${erro ? ` · erro: ${erro}` : ""}`);

  // variante dirigida: perguntar só por contratos conhecidos (lista de pares do protocolo)
  const r2 = await fetch(`https://${net}.g.alchemy.com/v2/${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getTokenBalances", params: [quem, [PAIR]] }),
  });
  const j2 = (await r2.json()) as Resp;
  const b2 = j2.result?.tokenBalances?.[0]?.tokenBalance;
  console.log(`   variante "só estes contratos": saldo devolvido ${b2 ? BigInt(b2) : "—"} ${b2 && BigInt(b2) === bal ? "✅ bate" : ""}${j2.error ? ` · erro: ${j2.error.message}` : ""}`);
}

await testeV4();
await testeV2();
