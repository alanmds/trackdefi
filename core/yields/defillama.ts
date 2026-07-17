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
}

/** slug de projeto DefiLlama → nosso id de protocolo */
const PROJECT_TO_PROTOCOL: Record<string, string> = {
  "aerodrome-slipstream": "aerodrome",
  "aerodrome-v1": "aerodrome",
  "velodrome-v3": "velodrome",
  "velodrome-v2": "velodrome",
  "uniswap-v3": "uniswap-v3",
};

export const MIN_TVL_USD = 10_000; // abaixo disto o APR não é confiável
export const MAX_SANE_APR = 1_000; // % a.a.; acima é ruído de TVL ínfimo
const DOMINANCE = 10; // com 2+ candidatos, o maior TVL precisa de 10x o 2º

const CL_OURS = /^CL(\d+)-/; // nosso poolSymbol: "CL100-WETH/USDC"
const CL_META = /^CL(\d+)\b/; // poolMeta da DefiLlama: "CL100 - 0.0217%"
const FEE_OURS = /\s(\d+(?:\.\d+)?)%$/; // nosso: "WETH/USDC 0.05%"
const FEE_META = /^(\d+(?:\.\d+)?)%$/; // deles: "0.05%"

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
    if (q.protocol === "uniswap-v3") {
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

let cached: { at: number; index: YieldsIndex } | null = null;

/**
 * Índice com cache de 1 h por instância. Falha de rede degrada com aviso:
 * devolve o índice velho se houver, senão null (UI mostra "—" nos APRs).
 */
export async function getYieldsIndex(onWarn: (msg: string) => void = () => {}): Promise<YieldsIndex | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.index;
  try {
    const res = await fetch(YIELDS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data?: LlamaRow[] };
    const ourChains = new Set(Object.values(CHAINS).map((c) => c.yieldsLabel));
    const rows = (body.data ?? []).filter(
      (r) => ourChains.has(r.chain) && PROJECT_TO_PROTOCOL[r.project] !== undefined,
    );
    cached = { at: Date.now(), index: new YieldsIndex(rows) };
    return cached.index;
  } catch (e) {
    onWarn(`APR indisponível (DefiLlama: ${(e as Error).message.split("\n")[0]}) — mostrando "—"`);
    return cached?.index ?? null;
  }
}
