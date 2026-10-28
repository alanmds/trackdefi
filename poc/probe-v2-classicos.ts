/**
 * PoC — pools clássicos (v2): factories e descoberta pela Token API da Alchemy
 * (passo 10 da meta de cobertura total, 27/10/2026).
 *
 * Provas, por fábrica × rede:
 *  A. a factory existe on-chain e o par WETH/USDC (ou WBNB/USDT) que ela devolve
 *     responde `factory()` com ela mesma, `getReserves()` e `totalSupply()`;
 *  B. quem recebeu LP desse par (alchemy_getAssetTransfers, sem limite de blocos)
 *     é achado pela Token API (`alchemy_getTokenBalances`) e o saldo bate com o
 *     `balanceOf`, e o filtro por `factory()` + `getPair()` reconhece o LP.
 *
 * Endereços das factories: Uniswap = developers.uniswap.org (v2 → deployments);
 * Pancake e Sushi = repositório oficial sushi-labs/sushi → src/evm/config/features
 * (pancakeswap-v2.ts, sushiswap-v2.ts), lido em 27/10/2026. A carteira usada é
 * achada on-chain e nunca é gravada aqui; a chave sai do `.env.local`.
 *
 *   npx tsx --env-file=.env.local poc/probe-v2-classicos.ts
 */

export {}; // arquivo-script

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";

const base = (process.env.BASE_RPC_URLS ?? "").split(",")[0].trim();
if (!base.includes("alchemy.com")) throw new Error("precisa de BASE_RPC_URLS da Alchemy no .env.local");
const KEY = base.split("/").pop()!;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const factoryAbi = parseAbi([
  "function allPairsLength() view returns (uint256)",
  "function getPair(address,address) view returns (address)",
]);
const pairAbi = parseAbi([
  "function factory() view returns (address)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
]);

interface Alvo { chainId: number; alchemy: string; nome: string; a: Address; b: Address; factories: Array<{ protocolo: string; factory: Address }> }

const ALVOS: Alvo[] = [
  {
    chainId: 1, alchemy: "eth-mainnet", nome: "Ethereum",
    a: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", b: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    factories: [
      { protocolo: "uniswap-v2", factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" },
      { protocolo: "sushiswap-v2", factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac" },
      { protocolo: "pancakeswap-v2", factory: "0x1097053Fd2ea711dad45caCcc45EfF7548fCB362" },
    ],
  },
  {
    chainId: 8453, alchemy: "base-mainnet", nome: "Base",
    a: "0x4200000000000000000000000000000000000006", b: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    factories: [
      { protocolo: "uniswap-v2", factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6" },
      { protocolo: "sushiswap-v2", factory: "0x71524B4f93c58fcbF659783284E38825f0622859" },
      { protocolo: "pancakeswap-v2", factory: "0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E" },
    ],
  },
  {
    chainId: 56, alchemy: "bnb-mainnet", nome: "BNB Chain",
    a: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", b: "0x55d398326f99059fF775485246999027B3197955",
    factories: [
      { protocolo: "uniswap-v2", factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6" },
      { protocolo: "sushiswap-v2", factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4" },
      { protocolo: "pancakeswap-v2", factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" },
    ],
  },
];

type Bal = { contractAddress: string; tokenBalance: string };

async function rpc(alchemy: string, method: string, params: unknown[]) {
  const r = await fetch(`https://${alchemy}.g.alchemy.com/v2/${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await r.json()) as { result?: any; error?: { message: string } };
}

for (const alvo of ALVOS) {
  console.log(`\n━━ ${alvo.nome}`);
  const reader = createReader(alvo.chainId);
  const tokensConhecidos = new Map<string, { factory: Address; protocolo: string }>();

  for (const { protocolo, factory } of alvo.factories) {
    try {
      const [len, pair] = await Promise.all([
        reader.readContract({ address: factory, abi: factoryAbi, functionName: "allPairsLength" }) as Promise<bigint>,
        reader.readContract({ address: factory, abi: factoryAbi, functionName: "getPair", args: [alvo.a, alvo.b] }) as Promise<Address>,
      ]);
      if (/^0x0+$/.test(pair)) { console.log(`   ${protocolo}: ${len} pares · sem par ${short(alvo.a)}/${short(alvo.b)}`); continue; }
      const r = await reader.multicall({
        contracts: (["factory", "token0", "token1", "getReserves", "totalSupply", "symbol"] as const).map((fn) => ({ address: pair, abi: pairAbi, functionName: fn })),
        allowFailure: true,
      });
      const ok = r.every((x) => x.status === "success");
      const fac = r[0].result as Address | undefined;
      console.log(`   ${protocolo}: ${len} pares · par ${short(pair)} símbolo ${r[5].result ?? "?"} · factory() ${fac && fac.toLowerCase() === factory.toLowerCase() ? "✅ bate" : "❌ " + fac} · leitura completa ${ok ? "✅" : "❌"}`);
      if (ok) tokensConhecidos.set(pair.toLowerCase(), { factory, protocolo });

      // B. quem recebeu LP desse par
      const tr = await rpc(alvo.alchemy, "alchemy_getAssetTransfers", [{ category: ["erc20"], contractAddresses: [pair], order: "desc", maxCount: "0x1e", withMetadata: false, toBlock: "latest" }]);
      const dono = (tr.result?.transfers ?? []).map((t: { to: string }) => t.to).find((t: string) => t && !/^0x0+$/.test(t) && t.toLowerCase() !== pair.toLowerCase());
      if (!dono) { console.log(`      sem destinatário recente (${tr.error?.message ?? "nenhuma transferência"})`); continue; }
      const cadeia = (await reader.readContract({ address: pair, abi: pairAbi, functionName: "balanceOf", args: [dono] })) as bigint;

      // lista completa de tokens da carteira (teto de 30 páginas)
      const lista: Bal[] = [];
      let pageKey: string | undefined, paginas = 0, erro = "";
      const t0 = Date.now();
      do {
        const j = await rpc(alvo.alchemy, "alchemy_getTokenBalances", [dono, "erc20", ...(pageKey ? [{ pageKey }] : [])]);
        if (j.error) { erro = j.error.message; break; }
        lista.push(...(j.result?.tokenBalances ?? []));
        pageKey = j.result?.pageKey;
        paginas++;
      } while (pageKey && paginas < 30);
      const naLista = lista.find((x) => x.contractAddress.toLowerCase() === pair.toLowerCase());
      const ms = Date.now() - t0;
      console.log(`      carteira ${short(dono)}: LP na cadeia ${cadeia} · Token API ${lista.length} token(s) em ${paginas} pág., ${ms} ms${pageKey ? " (TETO)" : ""} · LP na lista: ${naLista ? (BigInt(naLista.tokenBalance) === cadeia ? "✅ saldo bate" : "⚠️ saldo difere") : cadeia === 0n ? "— (já saiu)" : "❌"}${erro ? " · erro " + erro : ""}`);

      // C. reconhecer LPs por factory(): testa os candidatos (saldo > 0) em lote
      const candidatos = lista.filter((x) => BigInt(x.tokenBalance) > 0n).slice(0, 400).map((x) => x.contractAddress as Address);
      const f = await reader.multicall({ contracts: candidatos.map((c) => ({ address: c, abi: pairAbi, functionName: "factory" })), allowFailure: true, batchSize: 16_384 });
      const reconhecidos = candidatos.filter((_, i) => f[i].status === "success" && alvo.factories.some((x) => x.factory.toLowerCase() === (f[i].result as string).toLowerCase()));
      console.log(`      de ${candidatos.length} tokens com saldo, ${reconhecidos.length} respondem factory() de uma factory conhecida`);
    } catch (e) {
      console.log(`   ${protocolo}: ❌ ${(e as Error).message.split("\n")[0].slice(0, 140)}`);
    }
  }
}

// ── D. demais redes: a factory responde e o primeiro par volta a apontar para ela
const OUTRAS: Array<{ chainId: number; nome: string; factories: Array<{ protocolo: string; factory: Address }> }> = [
  { chainId: 42161, nome: "Arbitrum", factories: [
    { protocolo: "uniswap-v2", factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9" },
    { protocolo: "sushiswap-v2", factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4" },
    { protocolo: "pancakeswap-v2", factory: "0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E" } ] },
  { chainId: 10, nome: "Optimism", factories: [
    { protocolo: "uniswap-v2", factory: "0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf" },
    { protocolo: "sushiswap-v2", factory: "0xFbc12984689e5f15626Bad03Ad60160Fe98B303C" } ] },
  { chainId: 4663, nome: "Robinhood", factories: [
    { protocolo: "uniswap-v2", factory: "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f" },
    { protocolo: "sushiswap-v2", factory: "0xe52abd50ad151ecdf56427effd715e703696a6b1" },
    { protocolo: "pancakeswap-v2", factory: "0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E" } ] },
  { chainId: 130, nome: "Unichain", factories: [
    { protocolo: "uniswap-v2", factory: "0x1f98400000000000000000000000000000000002" } ] },
];
const allPairs = parseAbi(["function allPairs(uint256) view returns (address)", "function allPairsLength() view returns (uint256)"]);
console.log("\n━━ Demais redes (factory + primeiro par)");
for (const o of OUTRAS) {
  const reader = createReader(o.chainId);
  for (const { protocolo, factory } of o.factories) {
    try {
      const len = (await reader.readContract({ address: factory, abi: allPairs, functionName: "allPairsLength" })) as bigint;
      if (len === 0n) { console.log(`   ${o.nome} ${protocolo}: 0 pares`); continue; }
      const p0 = (await reader.readContract({ address: factory, abi: allPairs, functionName: "allPairs", args: [len - 1n] })) as Address;
      const f = (await reader.readContract({ address: p0, abi: pairAbi, functionName: "factory" })) as Address;
      console.log(`   ${o.nome} ${protocolo}: ${len} pares · último par ${short(p0)} · factory() ${f.toLowerCase() === factory.toLowerCase() ? "✅ bate" : "❌ " + f}`);
    } catch (e) {
      console.log(`   ${o.nome} ${protocolo}: ❌ ${(e as Error).message.split("\n")[0].slice(0, 120)}`);
    }
  }
}
