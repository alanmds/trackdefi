/**
 * Descoberta de pares (/tools/pairs) — v1, decidida pelo Alan em 26/10/2026:
 * APR MÉDIO DO POOL como a DefiLlama reporta (com aviso na tela, porque não é
 * medido no contrato como o resto do site) e market cap do token MENOR do par.
 *
 * Só entram os pares (protocolo × rede) que o trackdefi lê — a lista sai do
 * registry de adapters, não de memória. O dataset grátis da DefiLlama NÃO traz
 * o endereço do pool (ver `core/yields/defillama.ts`), então o link de cada
 * linha é a página do pool na própria DefiLlama.
 *
 * PoC: `poc/probe-descoberta.ts` (26/10/2026) — ~3.100 linhas nos nossos
 * pares; 2.103 de 2.247 com volume; mcaps em lotes de 100.
 */

import { parseAbi, type Address } from "viem";
import { buildAdapters } from "../adapters/registry";
import { cleanSymbol } from "../adapters/aerodrome/index";
import { CHAINS } from "../chains";
import { createReader } from "../chain";
import { fetchMarketCaps, fetchUsdPrices } from "../prices/defillama";
import type { PoolQuery, ProtocolAdapter } from "../types";
import { getYieldsRows, MAX_SANE_APR, type LlamaRowFull } from "../yields/defillama";

/**
 * slug de projeto da DefiLlama → nosso protocolo. Diferente do mapa do APR da
 * carteira: aqui entram Pancake v3 e Uniswap v4, que lá não precisam (a
 * carteira mede on-chain). FORA de propósito: os v2 da Uniswap/Sushi/Pancake
 * (o site não lê) e o `ramses-cl-v2` (não está provado que é a Ramses V3 que
 * o site lê — conferir antes de pôr).
 */
export const DISCOVERY_PROJECTS: Record<string, string> = {
  "aerodrome-slipstream": "aerodrome",
  "aerodrome-v1": "aerodrome",
  "velodrome-v3": "velodrome",
  "velodrome-v2": "velodrome",
  "uniswap-v3": "uniswap-v3",
  "uniswap-v4": "uniswap-v4",
  "pancakeswap-amm-v3": "pancakeswap-v3",
  "sushiswap-v3": "sushiswap-v3",
  "orca-dex": "orca",
};

/** Uma linha da tabela — o que vai ao navegador (enxuto: são ~3 mil). */
export interface PairDTO {
  /** id do pool na DefiLlama (para o link) */
  id: string;
  chainId: number;
  protocol: string;
  /** "WETH-USDC" como a DefiLlama escreve */
  symbol: string;
  /** "0.05%", "CL100 - 0.0217%"… ou null */
  meta: string | null;
  tvlUsd: number;
  /** % a.a. total (taxas + recompensas); null = sem dado ou acima do teto */
  apr: number | null;
  aprBase: number | null;
  aprReward: number | null;
  volume1d: number | null;
  volume7d: number | null;
  /** market cap do token MENOR do par; null se faltar o de qualquer um */
  mcapMin: number | null;
  /** endereço on-chain do pool (para o botão "Simular"); null = o simulador
   *  não atende o pool, ou a factory não confirmou */
  pool: string | null;
}

export interface PairsDTO {
  pairs: PairDTO[];
  /** unix (s) da leitura */
  readAt: number;
}

/**
 * Nativo embrulhado → market cap do ATIVO, não do contrato. Medido em
 * 26/10/2026: a DefiLlama dá ao WETH da Ethereum o market cap do "WETH" como
 * moeda própria (US$ 5 bi) e ao da Arbitrum o do WETH de lá (US$ 276 mi),
 * contra US$ 284 bi do ETH — o filtro de market cap esconderia WETH/USDC
 * como se fosse token pequeno. O endereço 0x000… é o nativo puro (Uniswap v4).
 */
const ZERO = "0x0000000000000000000000000000000000000000";
const OP_WETH = "0x4200000000000000000000000000000000000006";
const NATIVE_BY_SYMBOL: Record<string, string> = { ETH: "coingecko:ethereum", BNB: "coingecko:binancecoin" };
const WRAPPED: Record<string, string> = {
  "1:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "coingecko:ethereum",
  "42161:0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "coingecko:ethereum",
  "56:0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "coingecko:binancecoin",
  "792703809:so11111111111111111111111111111111111111112": "coingecko:solana",
};

/** a chave de market cap de um token: a do ativo nativo, se for um; senão a dele */
export function mcapKey(chainId: number, token: string): string {
  const t = token.toLowerCase();
  const info = CHAINS[chainId];
  const wrapped = WRAPPED[`${chainId}:${t}`];
  if (wrapped) return wrapped;
  if (t === OP_WETH && info.opStackWeth) return "coingecko:ethereum";
  if (t === ZERO) {
    const native = NATIVE_BY_SYMBOL[info.chain?.nativeCurrency.symbol ?? ""];
    if (native) return native;
  }
  return `${info.priceSlug}:${token}`.toLowerCase();
}

/** o id vira parte de um link para a DefiLlama: só passa no formato uuid */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
/* arredondado na origem: são ~3 mil linhas, e casas que a tela não mostra
   só engordam o que o navegador baixa (770 KB → ~1/3) */
const pct2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
const usd0 = (v: number | null) => (v === null ? null : Math.round(v));

/**
 * PURA: linhas do dataset + market caps → tabela. `covered` = "protocolo@rede"
 * que o site lê. Linha sem dois tokens fica de fora (não é par).
 */
export function buildPairs(
  rows: LlamaRowFull[],
  covered: Set<string>,
  mcaps: Map<string, number>,
  /** id da DefiLlama → endereço do pool, achado pela factory */
  addresses: Map<string, string> = new Map(),
): PairDTO[] {
  const porLabel = new Map(Object.entries(CHAINS).map(([id, c]) => [c.yieldsLabel, Number(id)]));
  const out: PairDTO[] = [];
  for (const r of rows) {
    const protocol = DISCOVERY_PROJECTS[r.project];
    const chainId = porLabel.get(r.chain);
    if (!protocol || chainId === undefined || !covered.has(`${protocol}@${chainId}`)) continue;
    const ut = r.underlyingTokens;
    if (!ut || ut.length !== 2 || !ut[0] || !ut[1] || !UUID.test(r.pool)) continue;

    const caps = ut.map((t) => mcaps.get(mcapKey(chainId, t)));
    const apr = num(r.apy);
    out.push({
      id: r.pool,
      chainId,
      protocol,
      // texto de terceiro: limpo e curto antes de ir à tela
      symbol: cleanSymbol(r.symbol ?? "", "?", 40),
      meta: r.poolMeta ? cleanSymbol(r.poolMeta, "", 30) || null : null,
      tvlUsd: Math.round(r.tvlUsd),
      // mesmo teto do APR da carteira: acima de 1.000% é ruído de TVL ínfimo
      apr: apr !== null && apr >= 0 && apr <= MAX_SANE_APR ? pct2(apr) : null,
      aprBase: pct2(num(r.apyBase)),
      aprReward: pct2(num(r.apyReward)),
      volume1d: usd0(num(r.volumeUsd1d)),
      volume7d: usd0(num(r.volumeUsd7d)),
      mcapMin: caps.every((c) => c !== undefined) ? Math.round(Math.min(...(caps as number[]))) : null,
      pool: addresses.get(r.pool) ?? null,
    });
  }
  return out;
}

// ------------------------------------------- endereço do pool (botão Simular)

const FEE_META = /^(\d+(?:\.\d+)?)%$/; // "0.05%" — Uniswap, Sushi, Pancake
const CL_META = /^CL(\d+)\b/; // "CL100 - 0.0217%" — Aerodrome/Velodrome CL
const V2_META = /^(stable|volatile)\b/; // "stable - 0.05%" — Velodrome v2

/**
 * PURA: a "forma" do pool tirada do poolMeta da DefiLlama, nos projetos que o
 * simulador atende. Devolve as CANDIDATAS: normalmente uma; duas no clássico
 * da Aerodrome, cujo poolMeta é sempre null (não diz stable nem volatile —
 * conferido em 27/10/2026, 130 de 130 linhas). Formatos conferidos no
 * dataset: Uniswap/Sushi/Pancake v3 "N%"; CL da Aerodrome/Velodrome
 * "CLN - N%"; clássico da Velodrome "stable - N%" / "volatile - N%".
 * Uniswap v4 e Orca → nenhuma (o simulador ainda não atende).
 */
export function poolQueryOf(project: string, meta: string | null, tokens: string[]): PoolQuery[] {
  if (tokens.length !== 2) return [];
  const [token0, token1] = tokens as [Address, Address];
  const base = { token0, token1, fee: null, tickSpacing: null };
  if (project === "uniswap-v3" || project === "sushiswap-v3" || project === "pancakeswap-amm-v3") {
    const m = meta?.match(FEE_META);
    return m ? [{ ...base, fee: Math.round(parseFloat(m[1]) * 10_000) }] : [];
  }
  if (project === "aerodrome-slipstream" || project === "velodrome-v3") {
    const m = meta?.match(CL_META);
    return m ? [{ ...base, tickSpacing: Number(m[1]) }] : [];
  }
  if (project === "aerodrome-v1" || project === "velodrome-v2") {
    const m = meta?.match(V2_META);
    if (m) return [{ ...base, stable: m[1] === "stable" }];
    return [
      { ...base, stable: true },
      { ...base, stable: false },
    ];
  }
  return [];
}

/** quanto o TVL lido na rede pode diferir do da DefiLlama e ainda ser o mesmo pool */
const TVL_TOLERANCE = 1.5;

/**
 * PURA: entre candidatos ao mesmo par (stable E volatile existem), fica o
 * ÚNICO cujo TVL lido na rede bate com o da DefiLlama. Os dois batendo, ou
 * nenhum, = null: melhor sem botão do que apontar para o pool errado.
 */
export function pickByTvl(tvlUsd: number, candidatos: { addr: string; tvl: number | null }[]): string | null {
  const batem = candidatos.filter((c) => c.tvl !== null && c.tvl <= tvlUsd * TVL_TOLERANCE && c.tvl >= tvlUsd / TVL_TOLERANCE);
  return batem.length === 1 ? batem[0].addr : null;
}

/** Endereço não muda: guarda por 24 h, e só o pool novo vai à rede. */
const ADDR_TTL_MS = 24 * 60 * 60 * 1000;
let enderecos: { at: number; map: Map<string, string | null> } = { at: 0, map: new Map() };

const erc20BalanceAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const erc20DecimalsAbi = parseAbi(["function decimals() view returns (uint8)"]);

/** TVL na rede (saldo dos dois tokens × preço) de cada pool candidato. Genérico: ERC-20 puro. */
async function tvlsOnchain(
  chainId: number,
  pools: { addr: string; token0: Address; token1: Address }[],
  onWarn: (msg: string) => void,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (pools.length === 0) return out;
  const reader = createReader(chainId);
  const tokens = [...new Set(pools.flatMap((p) => [p.token0, p.token1]))];
  const [saldos, casas, precos] = await Promise.all([
    reader.multicall({
      contracts: pools.flatMap((p) =>
        [p.token0, p.token1].map((t) => ({ address: t, abi: erc20BalanceAbi, functionName: "balanceOf", args: [p.addr] })),
      ),
      allowFailure: true,
      batchSize: 16_384,
    }),
    reader.multicall({
      contracts: tokens.map((t) => ({ address: t, abi: erc20DecimalsAbi, functionName: "decimals" })),
      allowFailure: true,
    }),
    fetchUsdPrices(CHAINS[chainId].priceSlug, tokens, onWarn),
  ]);
  const casaDe = new Map(tokens.map((t, i) => [t.toLowerCase(), casas[i].status === "success" ? Number(casas[i].result) : null]));
  pools.forEach((p, i) => {
    const lado = (t: Address, r: (typeof saldos)[number]) => {
      const c = casaDe.get(t.toLowerCase());
      const preco = precos.get(t.toLowerCase());
      if (r.status !== "success" || c === null || c === undefined || preco === undefined) return null;
      return (Number(r.result as bigint) / 10 ** c) * preco;
    };
    const a = lado(p.token0, saldos[i * 2]);
    const b = lado(p.token1, saldos[i * 2 + 1]);
    if (a !== null && b !== null) out.set(p.addr.toLowerCase(), a + b);
  });
  return out;
}

/**
 * id da DefiLlama → endereço, perguntando à factory de cada protocolo (um
 * multicall grande por adapter). Pool clássico é conferido pelo TVL — que
 * também desempata stable × volatile na Aerodrome. Falha numa rede só deixa aquelas linhas
 * sem botão — nunca derruba a tabela.
 */
async function resolveAddresses(
  rows: LlamaRowFull[],
  adapters: ProtocolAdapter[],
  onWarn: (msg: string) => void,
): Promise<Map<string, string>> {
  if (Date.now() - enderecos.at > ADDR_TTL_MS) enderecos = { at: Date.now(), map: new Map() };
  const porLabel = new Map(Object.entries(CHAINS).map(([id, c]) => [c.yieldsLabel, Number(id)]));
  type Pedido = { row: LlamaRowFull; qs: PoolQuery[] };
  const porAdapter = new Map<ProtocolAdapter, Pedido[]>();
  for (const r of rows) {
    if (enderecos.map.has(r.pool)) continue;
    const protocol = DISCOVERY_PROJECTS[r.project];
    const chainId = porLabel.get(r.chain);
    const qs = poolQueryOf(r.project, r.poolMeta, r.underlyingTokens ?? []);
    if (!protocol || chainId === undefined || qs.length === 0) continue;
    const a = adapters.find((x) => x.protocol === protocol && x.chainId === chainId && x.findPools);
    if (!a) continue;
    const lista = porAdapter.get(a) ?? [];
    lista.push({ row: r, qs });
    porAdapter.set(a, lista);
  }
  await Promise.all(
    [...porAdapter.entries()].map(async ([a, lista]) => {
      try {
        const achados = await a.findPools!(lista.flatMap((x) => x.qs));
        let k = 0;
        const empates: { row: LlamaRowFull; cands: { addr: string; token0: Address; token1: Address }[] }[] = [];
        for (const x of lista) {
          const cands = [...new Set(x.qs.map(() => achados[k++]).filter((v): v is Address => v !== null))];
          /* clássico passa SEMPRE pela conferência de TVL, mesmo com um
             candidato só: visto em 27/10/2026, o sAMM-USDC/sUSD da Velodrome
             tinha US$ 3,2 mi na DefiLlama e ~US$ 30 no contrato — o botão
             levaria a um pool que não é o da linha. */
          const classico = x.qs.some((q) => typeof q.stable === "boolean");
          if (cands.length === 0 || (cands.length === 1 && !classico)) enderecos.map.set(x.row.pool, cands[0] ?? null);
          else empates.push({ row: x.row, cands: cands.map((addr) => ({ addr, token0: x.qs[0].token0, token1: x.qs[0].token1 })) });
        }
        if (empates.length === 0) return;
        const tvls = await tvlsOnchain(a.chainId, empates.flatMap((e) => e.cands), onWarn);
        for (const e of empates) {
          const escolhido = pickByTvl(
            e.row.tvlUsd,
            e.cands.map((c) => ({ addr: c.addr, tvl: tvls.get(c.addr.toLowerCase()) ?? null })),
          );
          enderecos.map.set(e.row.pool, escolhido);
        }
      } catch (e) {
        onWarn(`endereços de ${a.protocol}@${a.chainId} indisponíveis: ${(e as Error).message.split("\n")[0].slice(0, 60)}`);
      }
    }),
  );
  const out = new Map<string, string>();
  for (const [id, addr] of enderecos.map) if (addr) out.set(id, addr);
  return out;
}

/** Servidor: baixa (com o cache de 1 h das linhas) e monta a tabela. */
export async function loadPairs(onWarn: (msg: string) => void = () => {}): Promise<PairsDTO> {
  const adapters = buildAdapters();
  const covered = new Set(adapters.map((a) => `${a.protocol}@${a.chainId}`));
  const rows = await getYieldsRows();
  const porLabel = new Map(Object.entries(CHAINS).map(([id, c]) => [c.yieldsLabel, Number(id)]));
  const keys: string[] = [];
  for (const r of rows) {
    const protocol = DISCOVERY_PROJECTS[r.project];
    const chainId = porLabel.get(r.chain);
    if (!protocol || chainId === undefined || !covered.has(`${protocol}@${chainId}`)) continue;
    for (const t of r.underlyingTokens ?? []) if (t) keys.push(mcapKey(chainId, t));
  }
  const [mcaps, addresses] = await Promise.all([fetchMarketCaps(keys, onWarn), resolveAddresses(rows, adapters, onWarn)]);
  return { pairs: buildPairs(rows, covered, mcaps, addresses), readAt: Math.floor(Date.now() / 1000) };
}
