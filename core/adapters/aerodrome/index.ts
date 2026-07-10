/**
 * Adapter Aerodrome (Base) — implementa ProtocolAdapter.
 *
 * Estratégia de varredura (decidida na Fase 1/2, ver PLANO_DE_TRABALHO.md):
 * - `positions()` do Sugar pagina por POOLS (~34 mil na Aerodrome) e cobre
 *   clássicas + concentradas em stake → varremos em janelas PARALELAS.
 * - `positionsUnstakedConcentrated()` pagina pelos NFTs DA CONTA (barato) e
 *   cobre concentradas fora de stake no NFPM legado → poucas chamadas.
 * - Dedupe por (pool, id) une os dois caminhos.
 * - Chamada que devolve exatamente SUGAR_MAX_POSITIONS pode ter truncado →
 *   a janela é re-varrida em metades até o resultado caber.
 */

import { erc20Abi, type Address } from "viem";
import type { ChainReader, LpPosition, PositionKind, ProtocolAdapter, TokenInfo } from "../../types";
import { isInRange, tickToPrice0In1 } from "../../math/ticks";
import { mapLimit } from "../../util";
import { factoryAbi, poolProbeAbi, sugarAbi, SUGAR_MAX_POSITIONS, type SugarPosition } from "./abi";
import { AERO, CHAIN_ID, FACTORIES, LP_SUGAR } from "./config";

const ZERO: Address = "0x0000000000000000000000000000000000000000";

export interface PoolMeta {
  kind: PositionKind;
  /** tick spacing (concentrada) — usado no símbolo composto */
  spacing: number | null;
  /** tick corrente do pool (concentrada) */
  tick: number | null;
  /** símbolo do próprio pool (clássicos são ERC20; concentrados não têm) */
  symbol: string | null;
  token0: Address;
  token1: Address;
}

export interface AerodromeOptions {
  sugarAddress?: Address;
  factories?: Address[];
  /** janelas de pools varridas em paralelo (default 8) */
  concurrency?: number;
  /** pools por janela de varredura (default 200) */
  poolWindow?: bigint;
  onWarn?: (msg: string) => void;
}

export class AerodromeAdapter implements ProtocolAdapter {
  readonly protocol = "aerodrome";
  readonly chainId = CHAIN_ID;

  private readonly sugar: Address;
  private readonly factories: Address[];
  private readonly concurrency: number;
  private readonly poolWindow: bigint;
  private readonly warn: (msg: string) => void;

  constructor(
    private readonly reader: ChainReader,
    opts: AerodromeOptions = {},
  ) {
    this.sugar = opts.sugarAddress ?? LP_SUGAR;
    this.factories = opts.factories ?? FACTORIES;
    this.concurrency = opts.concurrency ?? 8;
    this.poolWindow = opts.poolWindow ?? 200n;
    this.warn = opts.onWarn ?? (() => {});
  }

  async getPositions(account: Address): Promise<LpPosition[]> {
    return this.normalize(await this.fetchRawPositions(account));
  }

  /** Posições cruas do Sugar, deduplicadas e sem entradas vazias. */
  async fetchRawPositions(account: Address): Promise<SugarPosition[]> {
    const totalPools = await this.poolCount();
    const offsets: bigint[] = [];
    for (let o = 0n; o < totalPools; o += this.poolWindow) offsets.push(o);

    const [windows, legacy] = await Promise.all([
      mapLimit(offsets, this.concurrency, (o) => {
        const limit = o + this.poolWindow > totalPools ? totalPools - o : this.poolWindow;
        return this.scanWindow(account, o, limit);
      }),
      this.scanUnstakedConcentrated(account),
    ]);

    return dedupeRaw([...windows.flat(), ...legacy]).filter(hasSubstance);
  }

  /** Converte posições cruas no modelo normalizado (busca metadados na rede). */
  async normalize(raw: SugarPosition[]): Promise<LpPosition[]> {
    if (raw.length === 0) return [];
    const pools = await this.loadPools([...new Set(raw.map((p) => p.lp))]);
    const tokenAddrs = new Set<Address>([AERO]);
    for (const meta of pools.values()) {
      tokenAddrs.add(meta.token0);
      tokenAddrs.add(meta.token1);
    }
    const tokens = await this.loadTokens([...tokenAddrs]);
    const aero = tokens.get(AERO)!;

    const out: LpPosition[] = [];
    for (const p of raw) {
      const pool = pools.get(p.lp);
      if (!pool) {
        this.warn(`pool ${p.lp} sem metadados — posição ignorada`);
        continue;
      }
      out.push(toLpPosition(p, pool, tokens, aero));
    }
    return out;
  }

  // ------------------------------------------------------------- varredura

  private async poolCount(): Promise<bigint> {
    const res = await this.reader.multicall({
      contracts: this.factories.map((f) => ({
        address: f,
        abi: factoryAbi,
        functionName: "allPoolsLength",
      })),
      allowFailure: true,
    });
    let total = 0n;
    let ok = 0;
    res.forEach((r, i) => {
      if (r.status === "success") {
        total += r.result as bigint;
        ok++;
      } else {
        this.warn(`factory ${this.factories[i]} não respondeu allPoolsLength`);
      }
    });
    if (ok === 0) throw new Error("nenhuma factory respondeu — RPC fora do ar?");
    return total + 200n; // folga para pools criados durante a varredura
  }

  /**
   * Varre uma janela de pools via positions(). Erro de RPC (janela pesada) ou
   * possível truncamento (retorno == MAX) → divide a janela em metades.
   */
  private async scanWindow(account: Address, offset: bigint, limit: bigint): Promise<SugarPosition[]> {
    let batch: SugarPosition[] | null = null;
    try {
      batch = (await this.reader.readContract({
        address: this.sugar,
        abi: sugarAbi,
        functionName: "positions",
        args: [limit, offset, account],
      })) as SugarPosition[];
    } catch {
      batch = null;
    }
    if (batch !== null && batch.length < SUGAR_MAX_POSITIONS) return batch;

    if (limit <= 10n) {
      if (batch !== null) {
        this.warn(`janela offset=${offset} devolveu ${batch.length} posições mesmo com 10 pools — possível truncamento aceito`);
        return batch;
      }
      this.warn(`positions() falhou em offset=${offset} (janela mínima) — ${limit} pools pulados`);
      return [];
    }
    const half = limit / 2n;
    const a = await this.scanWindow(account, offset, half);
    const b = await this.scanWindow(account, offset + half, limit - half);
    return [...a, ...b];
  }

  /** CL fora de stake no NFPM legado — pagina pelos NFTs da conta. */
  private async scanUnstakedConcentrated(account: Address): Promise<SugarPosition[]> {
    const out: SugarPosition[] = [];
    let offset = 0n;
    for (let i = 0; i < 50; i++) {
      let batch: SugarPosition[];
      try {
        batch = (await this.reader.readContract({
          address: this.sugar,
          abi: sugarAbi,
          functionName: "positionsUnstakedConcentrated",
          args: [BigInt(SUGAR_MAX_POSITIONS), offset, account],
        })) as SugarPosition[];
      } catch (e) {
        this.warn(`positionsUnstakedConcentrated falhou em offset=${offset}: ${(e as Error).message.split("\n")[0]}`);
        break;
      }
      out.push(...batch);
      if (batch.length < SUGAR_MAX_POSITIONS) break;
      offset += BigInt(SUGAR_MAX_POSITIONS);
    }
    return out;
  }

  // ------------------------------------------------------------- metadados

  private async loadPools(lps: Address[]): Promise<Map<Address, PoolMeta>> {
    const PROBES = ["token0", "token1", "tickSpacing", "stable", "symbol", "slot0"] as const;
    const res = await this.reader.multicall({
      contracts: lps.flatMap((lp) =>
        PROBES.map((fn) => ({ address: lp, abi: poolProbeAbi, functionName: fn })),
      ),
      allowFailure: true,
    });

    const out = new Map<Address, PoolMeta>();
    lps.forEach((lp, i) => {
      const r = (j: number) => res[i * PROBES.length + j];
      const token0 = r(0);
      const token1 = r(1);
      if (token0.status !== "success" || token1.status !== "success") {
        this.warn(`pool ${lp} não respondeu token0/token1`);
        return;
      }
      const spacing = r(2);
      const stable = r(3);
      const symbol = r(4);
      const slot0 = r(5);

      if (spacing.status === "success") {
        out.set(lp, {
          kind: "concentrated",
          spacing: Number(spacing.result),
          tick: slot0.status === "success" ? Number((slot0.result as readonly unknown[])[1]) : null,
          symbol: null,
          token0: token0.result as Address,
          token1: token1.result as Address,
        });
      } else {
        if (stable.status !== "success") {
          this.warn(`pool ${lp} não é concentrado nem respondeu stable() — assumindo clássico volátil`);
        }
        out.set(lp, {
          kind: stable.status === "success" && (stable.result as boolean) ? "v2-stable" : "v2-volatile",
          spacing: null,
          tick: null,
          symbol: symbol.status === "success" ? (symbol.result as string) : null,
          token0: token0.result as Address,
          token1: token1.result as Address,
        });
      }
    });
    return out;
  }

  private async loadTokens(addrs: Address[]): Promise<Map<Address, TokenInfo>> {
    const res = await this.reader.multicall({
      contracts: addrs.flatMap((a) => [
        { address: a, abi: erc20Abi, functionName: "symbol" },
        { address: a, abi: erc20Abi, functionName: "decimals" },
      ]),
      allowFailure: true,
    });
    const out = new Map<Address, TokenInfo>();
    addrs.forEach((a, i) => {
      const sym = res[i * 2];
      const dec = res[i * 2 + 1];
      if (sym.status !== "success" || dec.status !== "success") {
        this.warn(`token ${a} sem symbol/decimals — usando padrão (18 casas)`);
      }
      out.set(a, {
        address: a,
        symbol: sym.status === "success" ? (sym.result as string) : a.slice(0, 8),
        decimals: dec.status === "success" ? Number(dec.result) : 18,
      });
    });
    return out;
  }
}

// -------------------------------------------------------- funções puras
// Exportadas para os testes (fixtures reais congelados na Fase 1).

export function dedupeRaw(positions: SugarPosition[]): SugarPosition[] {
  const byKey = new Map<string, SugarPosition>();
  for (const p of positions) byKey.set(`${p.lp.toLowerCase()}:${p.id}`, p);
  return [...byKey.values()];
}

export function hasSubstance(p: SugarPosition): boolean {
  return (
    p.liquidity > 0n ||
    p.staked > 0n ||
    p.amount0 > 0n ||
    p.amount1 > 0n ||
    p.staked0 > 0n ||
    p.staked1 > 0n ||
    p.unstaked_earned0 > 0n ||
    p.unstaked_earned1 > 0n ||
    p.emissions_earned > 0n
  );
}

export function toLpPosition(
  p: SugarPosition,
  pool: PoolMeta,
  tokens: Map<Address, TokenInfo>,
  aero: TokenInfo,
): LpPosition {
  const token0 = tokens.get(pool.token0) ?? fallbackToken(pool.token0);
  const token1 = tokens.get(pool.token1) ?? fallbackToken(pool.token1);
  const isCL = pool.kind === "concentrated";

  const rewards: LpPosition["rewards"] = [];
  if (p.unstaked_earned0 > 0n) rewards.push({ token: token0, raw: p.unstaked_earned0, kind: "fee" });
  if (p.unstaked_earned1 > 0n) rewards.push({ token: token1, raw: p.unstaked_earned1, kind: "fee" });
  if (p.emissions_earned > 0n) rewards.push({ token: aero, raw: p.emissions_earned, kind: "emission" });

  let range: LpPosition["range"] = null;
  if (isCL) {
    const tickCurrent = pool.tick ?? 0;
    range = {
      tickLower: p.tick_lower,
      tickUpper: p.tick_upper,
      tickCurrent,
      inRange: pool.tick !== null && isInRange(tickCurrent, p.tick_lower, p.tick_upper),
      priceLower: tickToPrice0In1(p.tick_lower, token0.decimals, token1.decimals),
      priceUpper: tickToPrice0In1(p.tick_upper, token0.decimals, token1.decimals),
      priceCurrent: tickToPrice0In1(tickCurrent, token0.decimals, token1.decimals),
    };
  }

  return {
    protocol: "aerodrome",
    chainId: CHAIN_ID,
    poolAddress: p.lp,
    poolSymbol:
      pool.symbol ??
      (isCL ? `CL${pool.spacing ?? "?"}-${token0.symbol}/${token1.symbol}` : `${token0.symbol}/${token1.symbol}`),
    kind: pool.kind,
    positionId: isCL ? p.id.toString() : null,
    staked: p.staked > 0n,
    managedByAlm: p.alm !== ZERO ? p.alm : null,
    token0,
    token1,
    amount0Raw: p.amount0 + p.staked0,
    amount1Raw: p.amount1 + p.staked1,
    rewards,
    range,
  };
}

function fallbackToken(address: Address): TokenInfo {
  return { address, symbol: address.slice(0, 8), decimals: 18 };
}
