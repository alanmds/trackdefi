/**
 * Descoberta de LP tokens v2 de uma carteira pela Token API da Alchemy.
 *
 * Posição clássica é um token ERC-20 de LP — sem NFT e sem enumeração —, então
 * a única lista possível é a dos tokens da carteira (`alchemy_getTokenBalances`,
 * 100 por página). Cada token com saldo é perguntado por `factory()`; os que
 * respondem uma factory conhecida da rede são candidatos, e o adapter confirma
 * com `getPair(token0, token1) == token` (um contrato de spam pode mentir no
 * `factory()`, mas não está na lista de pares da factory).
 *
 * A varredura é COMPARTILHADA: Uniswap v2, SushiSwap v2 e PancakeSwap v2 de
 * uma mesma rede pedem a mesma lista, e o cache por (rede, carteira) faz uma
 * única viagem à Alchemy. PoC: `poc/probe-v2-classicos.ts`.
 */

import { parseAbi, type Address } from "viem";
import { rpcUrls } from "../../chain";
import type { ChainReader } from "../../types";
import { factoriesOn, MAX_TOKEN_PAGES } from "./config";

const factoryProbeAbi = parseAbi(["function factory() view returns (address)"]);

export interface V2Holding {
  token: Address;
  balance: bigint;
  /** factory que o próprio token declara (já dentro das conhecidas da rede) */
  factory: Address;
}

export interface V2Scan {
  holdings: V2Holding[];
  /** tokens com saldo que foram perguntados por `factory()` */
  tokensChecked: number;
  /** true = sobraram páginas além do teto */
  truncated: boolean;
}

/** URL da Alchemy da rede, se houver — sem ela não há Token API */
export function alchemyUrl(chainId: number): string | null {
  return rpcUrls(chainId).find((u) => /\.alchemy\.com\//.test(u)) ?? null;
}

type Page = { tokenBalances?: Array<{ contractAddress: string; tokenBalance: string }>; pageKey?: string };

async function fetchPage(url: string, account: string, pageKey: string | undefined): Promise<Page> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getTokenBalances",
          params: [account, "erc20", ...(pageKey ? [{ pageKey }] : [])],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (r.status === 429) throw new Error("Alchemy limitou os pedidos (429)");
      const j = (await r.json()) as { result?: Page; error?: { message: string } };
      if (j.error) throw new Error(j.error.message);
      return j.result ?? {};
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("Token API da Alchemy indisponível");
}

async function scan(chainId: number, reader: ChainReader, account: Address): Promise<V2Scan> {
  const url = alchemyUrl(chainId)!;
  const known = new Set(factoriesOn(chainId).map((f) => f.toLowerCase()));
  const tokens: Array<{ token: Address; balance: bigint }> = [];
  let pageKey: string | undefined;
  let pages = 0;
  do {
    const page = await fetchPage(url, account, pageKey);
    for (const t of page.tokenBalances ?? []) {
      // saldo 0x0… = já saiu do token; a API devolve esses também
      let balance = 0n;
      try {
        balance = BigInt(t.tokenBalance);
      } catch {
        continue;
      }
      if (balance > 0n) tokens.push({ token: t.contractAddress as Address, balance });
    }
    pageKey = page.pageKey;
    pages++;
  } while (pageKey && pages < MAX_TOKEN_PAGES);

  const probes = await reader.multicall({
    contracts: tokens.map((t) => ({ address: t.token, abi: factoryProbeAbi, functionName: "factory" })),
    allowFailure: true,
    batchSize: 16_384,
  });
  const holdings: V2Holding[] = [];
  tokens.forEach((t, i) => {
    const r = probes[i];
    if (r.status === "success" && known.has((r.result as string).toLowerCase())) {
      holdings.push({ ...t, factory: r.result as Address });
    }
  });
  return { holdings, tokensChecked: tokens.length, truncated: Boolean(pageKey) };
}

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; p: Promise<V2Scan> }>();

/** uma viagem por (rede, carteira) a cada minuto, compartilhada entre os protocolos */
export function scanClassicHoldings(chainId: number, reader: ChainReader, account: Address): Promise<V2Scan> {
  const key = `${chainId}:${account.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.p;
  const p = scan(chainId, reader, account);
  cache.set(key, { at: Date.now(), p });
  // falha não fica em cache: o próximo pedido tenta de novo
  p.catch(() => {
    if (cache.get(key)?.p === p) cache.delete(key);
  });
  // cache limitado: descarta o mais antigo
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return p;
}
