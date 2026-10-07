/**
 * Auditoria INDEPENDENTE de uma carteira: o que ela realmente tem na chain,
 * sem passar pelo nosso `ProtocolAdapter`. Serve para responder "o rastreador
 * X mostra N posições e nós mostramos N-1 — qual é a que falta?".
 *
 * Caminho: Alchemy (chave do `.env.local`, mesma do `probe-alchemy-indexers.ts`)
 *   1. NFT API  — TODOS os ERC-721 da carteira (sem filtro de contrato):
 *      é o gabarito de posições concentradas/gauge de qualquer protocolo,
 *      inclusive os que ainda não supportamos.
 *   2. Token API — TODOS os ERC-20 com saldo: é o gabarito de pools clássicos
 *      (par v2 é ERC-20 de LP, não NFT).
 *
 * Nada aqui entra em produção: é diagnóstico. Nenhuma chave é impressa.
 *
 *   npx tsx --env-file=.env.local poc/probe-audita-carteira.ts 0xCARTEIRA
 */

export {}; // arquivo-script

import type { Address } from "viem";

const KEY = (process.env.BASE_RPC_URLS ?? "").split(",")[0].trim().split("/").pop();
if (!KEY) throw new Error("precisa de BASE_RPC_URLS (Alchemy) no .env.local");

/** env var da rede → nome de rede na Alchemy (só entram as que têm chave Alchemy) */
/** nomes de rede da Alchemy NÃO são iguais aos nossos slugs (opt/arb/bnb) */
const NETS: Array<{ label: string; env: string; net: string }> = [
  { label: "Base", env: "BASE_RPC_URLS", net: "base-mainnet" },
  { label: "Optimism", env: "OPTIMISM_RPC_URLS", net: "opt-mainnet" },
  { label: "Ethereum", env: "ETHEREUM_RPC_URLS", net: "eth-mainnet" },
  { label: "Arbitrum", env: "ARBITRUM_RPC_URLS", net: "arb-mainnet" },
  { label: "Robinhood", env: "ROBINHOOD_RPC_URLS", net: "robinhood-mainnet" },
  { label: "BNB Chain", env: "BSC_RPC_URLS", net: "bnb-mainnet" },
];

const temChave = (env: string) => (process.env[env] ?? "").includes("alchemy.com");
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-4)}`;

type NftResp = {
  ownedNfts?: Array<Record<string, unknown>>;
  pageKey?: string;
  error?: unknown;
  message?: string;
};

/** 1. todos os ERC-721 da carteira (paginado) */
async function nftsDoDono(net: string, owner: Address) {
  const ids: Array<{ contract: string; name: string; symbol: string; tokenId: string; cru: string }> = [];
  let pageKey = "", paginas = 0, erro = "";
  do {
    const u =
      `https://${net}.g.alchemy.com/nft/v3/${KEY}/getNFTsForOwner?owner=${owner}&withMetadata=false&pageSize=100` +
      (pageKey ? `&pageKey=${pageKey}` : "");
    const r = await fetch(u);
    const j = (await r.json().catch(() => ({}))) as NftResp;
    if (r.status !== 200 || j.error || j.message) {
      erro = `HTTP ${r.status} ${JSON.stringify(j.error ?? j.message ?? "").slice(0, 120)}`;
      break;
    }
    for (const raw of j.ownedNfts ?? []) {
      const c = (raw.contract ?? {}) as Record<string, unknown>;
      const addr =
        (typeof raw.tokenAddress === "string" && raw.tokenAddress) ||
        (typeof c.address === "string" && c.address) ||
        (typeof c.contractAddress === "string" && c.contractAddress) ||
        (typeof raw.address === "string" && raw.address) ||
        "";
      ids.push({
        contract: addr,
        name: String(c.name ?? raw.name ?? "?"),
        symbol: String(c.symbol ?? raw.symbol ?? "?"),
        tokenId: String(raw.tokenId ?? raw.id ?? "?"),
        cru: JSON.stringify(raw).slice(0, 400),
      });
    }
    pageKey = j.pageKey ?? "";
    paginas++;
  } while (pageKey && paginas < 20);
  return { ids, paginas, erro };
}

type BalResp = {
  result?: { tokenBalances: Array<{ contractAddress: string; tokenBalance: string | null }>; pageKey?: string };
  error?: { message: string };
};

/** 2. todos os ERC-20 com saldo (paginado) */
async function erc20DoDono(net: string, owner: Address) {
  const brutas: Array<{ contract: string; balance: string }> = [];
  let pageKey: string | undefined, paginas = 0, erro = "";
  do {
    const r = await fetch(`https://${net}.g.alchemy.com/v2/${KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        params: [owner, "erc20", ...(pageKey ? [{ pageKey }] : [])],
      }),
    });
    const j = (await r.json().catch(() => ({}))) as BalResp;
    if (j.error) { erro = j.error.message; break; }
    for (const b of j.result?.tokenBalances ?? [])
      if (b.tokenBalance && !/^0x0*$/.test(b.tokenBalance)) brutas.push({ contract: b.contractAddress, balance: b.tokenBalance });
    pageKey = j.result?.pageKey;
    paginas++;
  } while (pageKey && paginas < 30);
  return { brutas, paginas, erro };
}

type MetaResp = { result?: { name?: string; symbol?: string; decimals?: number }; error?: { message: string } };

async function meta(net: string, contract: string) {
  const r = await fetch(`https://${net}.g.alchemy.com/v2/${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getTokenMetadata", params: [contract] }),
  });
  const j = (await r.json().catch(() => ({}))) as MetaResp;
  return { name: j.result?.name ?? "?", symbol: j.result?.symbol ?? "?", decimals: j.result?.decimals ?? 18, erro: j.error?.message };
}

/** heurística de "isto é um LP": símbolo/nome com cara de par ou de LP */
const caraDeLp = (s: string) => /(^|\s|-)(LP|V2|V3)(\s|$)|\//.test(s) || /liquidity|pair|farm|slipstream|gauge/i.test(s);

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("uso: npx tsx --env-file=.env.local poc/probe-audita-carteira.ts 0xCARTEIRA");
  const owner = input as Address;

  console.log("Auditoria independente da carteira (Alchemy — fora do caminho de produção)");
  console.log(`Carteira: ${owner}\n`);

  for (const { label, env, net } of NETS) {
    if (!temChave(env)) { console.log(`── ${label}: sem chave Alchemy (${env}) — pulado`); continue; }
    const t = Date.now();
    const [nfts, erc20] = await Promise.all([nftsDoDono(net, owner), erc20DoDono(net, owner)]).catch((e) => [
      { ids: [], paginas: 0, erro: (e as Error).message.split("\n")[0].slice(0, 120) },
      { brutas: [], paginas: 0, erro: (e as Error).message.split("\n")[0].slice(0, 120) },
    ] as const);
    console.log(`── ${label} (${net}) — ${((Date.now() - t) / 1000).toFixed(1)} s`);

    if (nfts.erro) console.log(`   NFTs: ERRO ${nfts.erro}`);
    else console.log(`   NFTs (${nfts.ids.length} em ${nfts.paginas} página(s)):`);
    for (const n of nfts.ids)
      console.log(`     · ${n.name} [${n.symbol}] #${n.tokenId} @${n.contract ? short(n.contract) : `SEM-ENDERECO ${n.cru}`}`);

    if (erc20.erro) console.log(`   ERC-20: ERRO ${erc20.erro}`);
    else {
      console.log(`   ERC-20 com saldo (${erc20.brutas.length} em ${erc20.paginas} página(s)):`);
      // metadados só nos que parecem LP (spam de airdrop não interessa)
      for (const b of erc20.brutas) {
        const m = await meta(net, b.contract).catch(() => null);
        const nome = m ? `${m.name} (${m.symbol})` : "?";
        const marca = m && caraDeLp(`${m.name} ${m.symbol}`) ? "  ← LP?" : "";
        const dec = m?.decimals ?? 18;
        const val = Number(BigInt(b.balance)) / 10 ** dec;
        console.log(`     · ${nome} @${short(b.contract)} saldo=${val}${marca}`);
      }
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
