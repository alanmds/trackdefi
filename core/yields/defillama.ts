/**
 * APR dos pools via DefiLlama (Receita C) — yields.llama.fi/pools.
 *
 * ACHADOS DO PoC (14-17/07/2026, ver PLAYBOOK Receita C):
 * - O dataset NÃO expõe o endereço do pool → casamento por
 *   rede + projeto + par de tokens + tick spacing/fee (do poolMeta).
 * - O nome da rede no dataset difere do nosso label (Optimism = "OP
 *   Mainnet" lá!) → usar SEMPRE chains.yieldsLabel. Foi isso que fez a
 *   Velodrome parecer descoberta em 14/07 — ela tem 110 pools no dataset.
 * - Cobertura REAL (17/07): aerodrome na Base ✓ (415 pools); velodrome na
 *   OP ✓ (110); uniswap-v3 em Ethereum (558) e Arbitrum (206) ✓;
 *   uniswap-v3 em Base/OP ✗ (lacuna REAL do dataset — eles têm v2/v4 na
 *   Base, mas não v3). Sem cobertura → null (UI mostra "—").
 * - Pools de TVL ínfimo exibem APRs absurdos (28.350% medido!) →
 *   piso de TVL + teto de sanidade + regra de dominância.
 *
 * Política "número honesto ou —": só devolvemos APR quando o casamento é
 * inequívoco (filtro por spacing/fee; entre os restantes, o maior TVL só
 * vence se dominar por 10x) e o valor passa nos guardas.
 */

import type { Address } from "viem";
import { CHAINS } from "../chains";
import type { PositionKind } from "../types";

export interface PoolApr {
  /** % ao ano (taxas + recompensas), como reportado pela DefiLlama */
  current: number;
  base: number | null;
  reward: number | null;
  mean30d: number | null;
  tvlUsd: number;
  source: "DefiLlama";
}

/** linha crua (subconjunto) do dataset da DefiLlama */
export interface LlamaRow {
  chain: string;
  project: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  apyMean30d: number | null;
  poolMeta: string | null;
  underlyingTokens: string[] | null;
}

export interface MatchQuery {
  chainId: number;
  protocol: string;
  kind: PositionKind;
  poolSymbol: string;
  token0: Address;
  token1: Address;
  /** TVL do pool lido na rede (US$) — só a Orca usa; ver o ramo dela no match */
  poolTvlUsd?: number | null;
}

/** slug de projeto DefiLlama → nosso id de protocolo */
const PROJECT_TO_PROTOCOL: Record<string, string> = {
  "aerodrome-slipstream": "aerodrome",
  "aerodrome-v1": "aerodrome",
  "velodrome-v3": "velodrome",
  "velodrome-v2": "velodrome",
  "uniswap-v3": "uniswap-v3",
  // 20/10/2026: Ethereum, Base, Arbitrum e BSC (OP ainda não); poolMeta "0.3%"
  "sushiswap-v3": "sushiswap-v3",
  // Solana (14/10/2026): 759 pools no dataset, todos com poolMeta null
  "orca-dex": "orca",
};

export const MIN_TVL_USD = 10_000; // abaixo disto o APR não é confiável
export const MAX_SANE_APR = 1_000; // % a.a.; acima é ruído de TVL ínfimo
const DOMINANCE = 10; // com 2+ candidatos, o maior TVL precisa de 10x o 2º
const ORCA_TVL_TOLERANCE = 1.5; // TVL da DefiLlama x TVL lido nos cofres (Orca)

const CL_OURS = /^CL(\d+)-/; // nosso poolSymbol: "CL100-WETH/USDC"
const CL_META = /^CL(\d+)\b/; // poolMeta da DefiLlama: "CL100 - 0.0217%"
const FEE_OURS = /\s(\d+(?:\.\d+)?)%$/; // nosso: "WETH/USDC 0.05%"
const FEE_META = /^(\d+(?:\.\d+)?)%$/; // deles: "0.05%"
/** pools identificados pelo fee tier no poolMeta (Uniswap e forks com o mesmo formato) */
const FEE_TIER_PROTOCOLS = new Set(["uniswap-v3", "sushiswap-v3"]);

function key(chainLabel: string, protocol: string, a: string, b: string): string {
  const [lo, hi] = [a.toLowerCase(), b.toLowerCase()].sort();
  return `${chainLabel}|${protocol}|${lo}|${hi}`;
}

export class YieldsIndex {
  private buckets = new Map<string, LlamaRow[]>();

  constructor(rows: LlamaRow[]) {
    for (const row of rows) {
      const protocol = PROJECT_TO_PROTOCOL[row.project];
      const ut = row.underlyingTokens;
      if (!protocol || !ut || ut.length !== 2 || !ut[0] || !ut[1]) continue;
      const k = key(row.chain, protocol, ut[0], ut[1]);
      const bucket = this.buckets.get(k);
      if (bucket) bucket.push(row);
      else this.buckets.set(k, [row]);
    }
  }

  get size(): number {
    return this.buckets.size;
  }

  match(q: MatchQuery): PoolApr | null {
    const info = CHAINS[q.chainId];
    if (!info) return null;
    const rows = this.buckets.get(key(info.yieldsLabel, q.protocol, q.token0, q.token1));
    if (!rows) return null;

    // 1) filtra pela "forma" do pool (spacing na CL, fee na uniswap, v2 sem meta)
    let candidates: LlamaRow[];
    if (q.protocol === "orca") {
      /* O dataset da Orca não diz nem o endereço nem a taxa do pool (poolMeta
         sempre null; 9 pools SOL/USDC em 14/10/2026) — pegar o maior TVL daria
         a uma posição o APR de OUTRO pool. O que identifica o pool é o TVL:
         ficam só as linhas a até 1,5x do TVL lido nos cofres; sem esse TVL,
         "—". */
      const tvl = q.poolTvlUsd;
      if (!tvl || !(tvl > 0)) return null;
      candidates = rows.filter((r) => r.tvlUsd <= tvl * ORCA_TVL_TOLERANCE && r.tvlUsd >= tvl / ORCA_TVL_TOLERANCE);
    } else if (FEE_TIER_PROTOCOLS.has(q.protocol)) {
      const ours = q.poolSymbol.match(FEE_OURS);
      if (!ours) return null;
      const fee = parseFloat(ours[1]);
      candidates = rows.filter((r) => {
        const m = r.poolMeta?.match(FEE_META);
        return m !== null && m !== undefined && Math.abs(parseFloat(m[1]) - fee) < 1e-9;
      });
    } else if (q.kind === "concentrated") {
      const ours = q.poolSymbol.match(CL_OURS);
      if (!ours) return null;
      const spacing = ours[1];
      candidates = rows.filter((r) => r.poolMeta?.match(CL_META)?.[1] === spacing);
    } else {
      // v2 clássico: linhas sem meta de CL (estável/volátil não são
      // distinguíveis no dataset — a regra de dominância decide ou anula)
      candidates = rows.filter((r) => !r.poolMeta?.match(CL_META));
    }

    // 2) guardas de confiabilidade
    candidates = candidates.filter((r) => r.apy !== null && r.tvlUsd >= MIN_TVL_USD);
    if (candidates.length === 0) return null;

    // 3) dominância: 1 candidato ou o maior TVL com 10x o segundo; senão "—"
    candidates.sort((a, b) => b.tvlUsd - a.tvlUsd);
    const chosen = candidates[0];
    if (candidates.length > 1 && chosen.tvlUsd < DOMINANCE * candidates[1].tvlUsd) return null;

    // 4) teto de sanidade
    if ((chosen.apy as number) > MAX_SANE_APR) return null;

    return {
      current: chosen.apy as number,
      base: chosen.apyBase,
      reward: chosen.apyReward,
      mean30d: chosen.apyMean30d,
      tvlUsd: chosen.tvlUsd,
      source: "DefiLlama",
    };
  }
}

// ------------------------------------------------------- download + cache

const YIELDS_URL = "https://yields.llama.fi/pools";
const TTL_MS = 60 * 60 * 1000; // dataset atualiza ~1x/hora

/** a linha como vem do dataset, com os campos que só a descoberta de pares usa */
export interface LlamaRowFull extends LlamaRow {
  /** id do pool NA DefiLlama (uuid) — não é endereço on-chain */
  pool: string;
  symbol: string;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
}

let cachedRows: { at: number; rows: LlamaRowFull[] } | null = null;
let cached: { at: number; index: YieldsIndex } | null = null;

/**
 * Linhas do dataset nas NOSSAS redes, com cache de 1 h por instância — a
 * mesma baixada serve o APR da carteira e a descoberta de pares. Falha de
 * rede devolve as linhas velhas se houver; senão lança.
 */
export async function getYieldsRows(): Promise<LlamaRowFull[]> {
  if (cachedRows && Date.now() - cachedRows.at < TTL_MS) return cachedRows.rows;
  try {
    const res = await fetch(YIELDS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data?: LlamaRowFull[] };
    const ourChains = new Set(Object.values(CHAINS).map((c) => c.yieldsLabel));
    cachedRows = { at: Date.now(), rows: (body.data ?? []).filter((r) => ourChains.has(r.chain)) };
    return cachedRows.rows;
  } catch (e) {
    if (cachedRows) return cachedRows.rows;
    throw e;
  }
}

/**
 * Índice com cache de 1 h por instância. Falha de rede degrada com aviso:
 * devolve o índice velho se houver, senão null (UI mostra "—" nos APRs).
 */
export async function getYieldsIndex(onWarn: (msg: string) => void = () => {}): Promise<YieldsIndex | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.index;
  try {
    const rows = (await getYieldsRows()).filter((r) => PROJECT_TO_PROTOCOL[r.project] !== undefined);
    cached = { at: Date.now(), index: new YieldsIndex(rows) };
    return cached.index;
  } catch (e) {
    onWarn(`APR indisponível (DefiLlama: ${(e as Error).message.split("\n")[0]}) — mostrando "—"`);
    return cached?.index ?? null;
  }
}
