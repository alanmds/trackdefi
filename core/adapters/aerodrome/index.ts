/**
 * Adapter Aerodrome (Base) — implementa ProtocolAdapter.
 *
 * Estratégia de varredura (decidida na Fase 1/2, ver privado/PLANO_DE_TRABALHO.md):
 * - `positions()` do Sugar pagina por POOLS (~34 mil na Aerodrome) e cobre
 *   clássicas + concentradas em stake → varremos em janelas PARALELAS.
 * - `positionsUnstakedConcentrated()` pagina pelos NFTs DA CONTA (barato) e
 *   cobre concentradas fora de stake no NFPM legado → poucas chamadas.
 * - Dedupe por (pool, id) une os dois caminhos.
 * - Chamada que devolve exatamente SUGAR_MAX_POSITIONS pode ter truncado →
 *   a janela é re-varrida em metades até o resultado caber.
 */

import { erc20Abi, type Address } from "viem";
import type { ChainReader, LockPosition, LpPosition, PoolQuery, PoolSnapshot, PositionKind, ProtocolAdapter, TokenInfo, WarnSink } from "../../types";
import { isInRange, tickToPrice0In1 } from "../../math/ticks";
import { mapLimit } from "../../util";
import {
  clFactoryAbi,
  clFeeAbi,
  factoryAbi,
  gaugeAbi,
  poolProbeAbi,
  sugarAbi,
  sugarVoterAbi,
  SUGAR_MAX_POSITIONS,
  v2FactoryAbi,
  v2GaugeAbi,
  v2PoolAbi,
  voterGaugesAbi,
  type SugarPosition,
} from "./abi";
import { AERODROME_BASE, CHAIN_ID, type SugarChainConfig } from "./config";
import { buildLocks, rewardsSugarAbi, veSugarAbi, type RawLock, type RawVoteReward } from "./ve";

const ZERO: Address = "0x0000000000000000000000000000000000000000";

/**
 * Símbolos de token/pool vêm de contratos de TERCEIROS (qualquer um cria um
 * token com symbol() arbitrário): remove caracteres de controle/invisíveis
 * e limita o tamanho antes de qualquer exibição.
 */
export function cleanSymbol(raw: string, fallback: string, max = 24): string {
  const cleaned = raw
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .trim()
    .slice(0, max);
  return cleaned || fallback;
}

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
  /** pool.liquidity(): liquidez ativa no tick (CL) — p/ APR de taxas */
  activeLiquidity?: bigint | null;
  /** pool.stakedLiquidity(): liquidez em stake ativa (CL) — p/ APR de emissões */
  poolStakedLiquidity?: bigint | null;
  /** gauge do pool (CL) */
  gauge?: Address | null;
  /** gauge.rewardRate(): token de emissão por segundo (preenchido em 2º passo) */
  emissionRatePerSec?: bigint | null;
  /** gauge.periodFinish(), quando já passou: o gauge parou de pagar */
  emissionsEndedAt?: number;
}

export interface AerodromeOptions {
  /** config da rede/protocolo Sugar (default: Aerodrome na Base) */
  config?: SugarChainConfig;
  sugarAddress?: Address;
  factories?: Address[];
  /** janelas de pools varridas em paralelo (default 8) */
  concurrency?: number;
  /** pools por janela de varredura (default 200) */
  poolWindow?: bigint;
  onWarn?: WarnSink;
}

/** Adapter do ecossistema Sugar — atende Aerodrome (Base), Velodrome
 * (Optimism) e irmãs, trocando só a SugarChainConfig. */
export class AerodromeAdapter implements ProtocolAdapter {
  readonly protocol: string;
  readonly chainId: number;

  private readonly emissionsToken: Address;
  private readonly sugar: Address;
  private readonly factories: Address[];
  private readonly concurrency: number;
  private readonly poolWindow: bigint;
  private readonly warn: WarnSink;
  private readonly veSugar?: Address;
  private readonly rewardsSugar?: Address;

  constructor(
    private readonly reader: ChainReader,
    opts: AerodromeOptions = {},
  ) {
    const config = opts.config ?? AERODROME_BASE;
    this.protocol = config.protocol;
    this.chainId = config.chainId;
    this.emissionsToken = config.emissionsToken;
    this.sugar = opts.sugarAddress ?? config.sugar;
    this.factories = opts.factories ?? config.factories;
    this.concurrency = opts.concurrency ?? 8;
    this.poolWindow = opts.poolWindow ?? 200n;
    this.warn = opts.onWarn ?? (() => {});
    this.veSugar = config.veSugar;
    this.rewardsSugar = config.rewardsSugar;
  }

  async getPositions(account: Address): Promise<LpPosition[]> {
    return this.normalize(await this.fetchRawPositions(account));
  }

  /**
   * Locks veAERO/veVELO da carteira (ver `ve.ts`). Rede sem `veSugar` na
   * config (as redes-folha da Superchain) devolve vazio sem tocar na rede.
   */
  async getLocks(account: Address): Promise<LockPosition[]> {
    if (!this.veSugar) return [];
    const raw = (await this.reader.readContract({
      address: this.veSugar,
      abi: veSugarAbi,
      functionName: "byAccount",
      args: [account],
    })) as readonly RawLock[];
    if (raw.length === 0) return [];

    // recompensas de voto: um pedido por (lock, pool votado), num multicall só
    const pares = raw.flatMap((l) => l.votes.map((v) => ({ id: l.id, lp: v.lp })));
    const rewardsByLock = new Map<bigint, RawVoteReward[]>();
    if (this.rewardsSugar && pares.length > 0) {
      const res = await this.reader.multicall({
        contracts: pares.map((p) => ({
          address: this.rewardsSugar!,
          abi: rewardsSugarAbi,
          functionName: "rewardsByAddress",
          args: [p.id, p.lp],
        })),
        allowFailure: true,
      });
      let falhas = 0;
      res.forEach((r, i) => {
        if (r.status !== "success") {
          falhas++;
          return;
        }
        const lista = rewardsByLock.get(pares[i].id) ?? [];
        lista.push(...(r.result as readonly RawVoteReward[]));
        rewardsByLock.set(pares[i].id, lista);
      });
      if (falhas > 0) this.warn(`locks: recompensas de voto de ${falhas} pool(s) não responderam`);
    }

    const addrs = new Set<Address>(raw.map((l) => l.token));
    for (const lista of rewardsByLock.values()) for (const r of lista) addrs.add(r.token);
    const tokens = await this.loadTokens([...addrs]);
    const porEndereco = new Map<string, TokenInfo>();
    for (const [a, t] of tokens) porEndereco.set(a.toLowerCase(), t);

    return buildLocks(raw, rewardsByLock, porEndereco, this.protocol, this.chainId);
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
    const tokenAddrs = new Set<Address>([this.emissionsToken]);
    for (const meta of pools.values()) {
      tokenAddrs.add(meta.token0);
      tokenAddrs.add(meta.token1);
    }
    const tokens = await this.loadTokens([...tokenAddrs]);
    const aero = tokens.get(this.emissionsToken)!;

    const out: LpPosition[] = [];
    for (const p of raw) {
      const pool = pools.get(p.lp);
      if (!pool) {
        this.warn(`pool ${p.lp} sem metadados — posição ignorada`);
        continue;
      }
      out.push(toLpPosition(p, pool, tokens, aero, this.protocol, this.chainId));
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
    let firstError: Error | undefined;
    res.forEach((r, i) => {
      if (r.status === "success") {
        total += r.result as bigint;
        ok++;
      } else {
        firstError ??= r.error;
        this.warn(`factory ${this.factories[i]} não respondeu allPoolsLength: ${r.error?.message?.split("\n")[0] ?? "?"}`);
      }
    });
    if (ok === 0) {
      throw new Error(
        `nenhuma factory respondeu — RPC fora do ar? causa: ${firstError?.message?.split("\n").slice(0, 3).join(" | ") ?? "desconhecida"}`,
      );
    }
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

  /**
   * Foto de um pool CL (Slipstream) para o simulador. Prova de origem: uma
   * das factories da config devolve este endereço para o par e o tick
   * spacing. Pool clássico (v2) não responde `tickSpacing()` → null.
   */
  async describePool(pool: Address): Promise<PoolSnapshot | null> {
    const FNS = ["token0", "token1", "tickSpacing", "slot0", "liquidity", "stakedLiquidity", "gauge"] as const;
    const res = await this.reader.multicall({
      contracts: [
        ...FNS.map((fn) => ({ address: pool, abi: poolProbeAbi, functionName: fn })),
        { address: pool, abi: clFeeAbi, functionName: "fee" },
      ],
      allowFailure: true,
    });
    if (res[0].status !== "success" || res[1].status !== "success") return null;
    // sem tickSpacing/slot0 = pool clássico (v2), ou nem é pool nosso
    if (res.slice(2, 5).some((r) => r.status !== "success")) {
      return this.describeClassicPool(pool, res[0].result as Address, res[1].result as Address);
    }
    const token0 = res[0].result as Address;
    const token1 = res[1].result as Address;
    const tickSpacing = Number(res[2].result);
    const slot0 = res[3].result as readonly unknown[];

    const prova = await this.reader.multicall({
      contracts: this.factories.map((f) => ({
        address: f,
        abi: clFactoryAbi,
        functionName: "getPool",
        args: [token0, token1, tickSpacing],
      })),
      allowFailure: true,
    });
    if (!prova.some((r) => r.status === "success" && (r.result as string).toLowerCase() === pool.toLowerCase())) return null;

    const gaugeRes = res[6];
    const gauge = gaugeRes.status === "success" && gaugeRes.result !== ZERO ? (gaugeRes.result as Address) : null;
    const [tokens, bal, rates] = await Promise.all([
      this.loadTokens([token0, token1, ...(gauge ? [this.emissionsToken] : [])]),
      this.reader.multicall({
        contracts: [token0, token1].map((t) => ({ address: t, abi: erc20Abi, functionName: "balanceOf", args: [pool] })),
        allowFailure: true,
      }),
      gauge
        ? this.reader.multicall({
            contracts: (["rewardRate", "periodFinish"] as const).map((fn) => ({ address: gauge, abi: gaugeAbi, functionName: fn })),
            allowFailure: true,
          })
        : Promise.resolve(null),
    ]);
    const t0 = tokens.get(token0)!;
    const t1 = tokens.get(token1)!;

    let emission: PoolSnapshot["emission"] = null;
    const staked = res[5];
    if (gauge && rates && rates.every((r) => r.status === "success") && staked.status === "success") {
      // mesma regra da carteira: depois do periodFinish o gauge não paga
      const end = Number(rates[1].result as bigint);
      const ended = end <= Math.floor(Date.now() / 1000);
      emission = {
        token: tokens.get(this.emissionsToken)!,
        ratePerSec: ended ? 0n : (rates[0].result as bigint),
        sharedLiquidity: staked.result as bigint,
        requiresStake: true,
        ...(ended ? { endedAt: end } : {}),
      };
    }

    return {
      protocol: this.protocol,
      chainId: this.chainId,
      poolAddress: pool,
      poolSymbol: `CL${tickSpacing}-${t0.symbol}/${t1.symbol}`,
      token0: t0,
      token1: t1,
      feePips: res[7].status === "success" ? Number(res[7].result) : null,
      tickSpacing,
      tick: Number(slot0[1]),
      sqrtPriceX96: slot0[0] as bigint,
      activeLiquidity: res[4].result as bigint,
      reserves:
        bal[0].status === "success" && bal[1].status === "success"
          ? { amount0Raw: bal[0].result as bigint, amount1Raw: bal[1].result as bigint }
          : null,
      emission,
    };
  }

  /**
   * Foto de um pool CLÁSSICO (v2): sem faixa, a liquidez é o LP token. Prova
   * de origem: a factory clássica devolve o endereço para o par e o
   * stable/volatile. Gauge pelo Voter que a própria Sugar informa — só a
   * liquidez EM STAKE recebe emissões, e as taxas dela vão aos votantes.
   */
  private async describeClassicPool(pool: Address, token0: Address, token1: Address): Promise<PoolSnapshot | null> {
    const res = await this.reader.multicall({
      contracts: [
        { address: pool, abi: poolProbeAbi, functionName: "stable" },
        { address: pool, abi: v2PoolAbi, functionName: "totalSupply" },
        { address: pool, abi: v2PoolAbi, functionName: "index0" },
        { address: this.sugar, abi: sugarVoterAbi, functionName: "voter" },
      ],
      allowFailure: true,
    });
    if (res.slice(0, 3).some((r) => r.status !== "success")) return null;
    const stable = res[0].result as boolean;
    const totalSupply = res[1].result as bigint;

    const prova = await this.reader.multicall({
      contracts: this.factories.map((f) => ({
        address: f,
        abi: v2FactoryAbi,
        functionName: "getPool",
        args: [token0, token1, stable],
      })),
      allowFailure: true,
    });
    if (!prova.some((r) => r.status === "success" && (r.result as string).toLowerCase() === pool.toLowerCase())) return null;

    const voter = res[3].status === "success" ? (res[3].result as Address) : null;
    const gauge =
      voter && voter !== ZERO
        ? ((await this.reader
            .readContract({ address: voter, abi: voterGaugesAbi, functionName: "gauges", args: [pool] })
            .catch(() => null)) as Address | null)
        : null;
    const comGauge = gauge && gauge !== ZERO ? gauge : null;

    const [tokens, bal, g] = await Promise.all([
      this.loadTokens([token0, token1, ...(comGauge ? [this.emissionsToken] : [])]),
      this.reader.multicall({
        contracts: [token0, token1].map((t) => ({ address: t, abi: erc20Abi, functionName: "balanceOf", args: [pool] })),
        allowFailure: true,
      }),
      comGauge
        ? this.reader.multicall({
            contracts: [
              { address: comGauge, abi: gaugeAbi, functionName: "rewardRate" },
              { address: comGauge, abi: gaugeAbi, functionName: "periodFinish" },
              { address: comGauge, abi: v2GaugeAbi, functionName: "totalSupply" },
            ],
            allowFailure: true,
          })
        : Promise.resolve(null),
    ]);
    const t0 = tokens.get(token0)!;
    const t1 = tokens.get(token1)!;

    let emission: PoolSnapshot["emission"] = null;
    if (comGauge && g && g.every((r) => r.status === "success")) {
      const end = Number(g[1].result as bigint);
      const ended = end <= Math.floor(Date.now() / 1000);
      emission = {
        token: tokens.get(this.emissionsToken)!,
        ratePerSec: ended ? 0n : (g[0].result as bigint),
        sharedLiquidity: g[2].result as bigint,
        requiresStake: true,
        ...(ended ? { endedAt: end } : {}),
      };
    }

    return {
      protocol: this.protocol,
      chainId: this.chainId,
      poolAddress: pool,
      // o formato do symbol() dos próprios pools clássicos ("vAMM-USDC/AERO")
      poolSymbol: `${stable ? "sAMM" : "vAMM"}-${t0.symbol}/${t1.symbol}`,
      token0: t0,
      token1: t1,
      feePips: null,
      tickSpacing: 0,
      tick: 0,
      sqrtPriceX96: 0n,
      activeLiquidity: 0n,
      reserves:
        bal[0].status === "success" && bal[1].status === "success"
          ? { amount0Raw: bal[0].result as bigint, amount1Raw: bal[1].result as bigint }
          : null,
      emission,
      classic: { stable, totalSupply },
    };
  }

  /**
   * Endereços CL pelas factories da config (descoberta de pares → simulador).
   * A factory clássica tem outro `getPool` e só falha; o primeiro endereço
   * não-zero vence.
   */
  async findPools(queries: PoolQuery[]): Promise<(Address | null)[]> {
    // CL pelo tick spacing; clássico (v2) pelo stable/volatile
    const validas = queries
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => (q.tickSpacing !== null && q.tickSpacing > 0) || typeof q.stable === "boolean");
    if (validas.length === 0) return queries.map(() => null);
    const res = await this.reader.multicall({
      contracts: validas.flatMap(({ q }) =>
        this.factories.map((f) =>
          typeof q.stable === "boolean"
            ? { address: f, abi: v2FactoryAbi, functionName: "getPool", args: [q.token0, q.token1, q.stable] }
            : { address: f, abi: clFactoryAbi, functionName: "getPool", args: [q.token0, q.token1, q.tickSpacing] },
        ),
      ),
      allowFailure: true,
      batchSize: 16_384,
    });
    const out: (Address | null)[] = queries.map(() => null);
    validas.forEach(({ i }, k) => {
      for (let j = 0; j < this.factories.length; j++) {
        const r = res[k * this.factories.length + j];
        if (r.status === "success" && r.result !== ZERO) {
          out[i] = r.result as Address;
          break;
        }
      }
    });
    return out;
  }

  // ------------------------------------------------------------- metadados

  private async loadPools(lps: Address[]): Promise<Map<Address, PoolMeta>> {
    // multicall de METADADOS (inalterada: quem falha aqui perde a posição, então
    // NÃO a engrossamos com sondas de APR — essas vão numa 2ª chamada isolada)
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
          this.warn(`pool ${lp} não é concentrado nem respondeu stable() — assumindo clássico volátil`, null);
        }
        out.set(lp, {
          kind: stable.status === "success" && (stable.result as boolean) ? "v2-stable" : "v2-volatile",
          spacing: null,
          tick: null,
          symbol: symbol.status === "success" ? cleanSymbol(symbol.result as string, "", 40) || null : null,
          token0: token0.result as Address,
          token1: token1.result as Address,
        });
      }
    });

    await this.loadAprInputs(out);
    return out;
  }

  /**
   * 2ª chamada ISOLADA (só pools CL): liquidez ativa, liquidez em stake e gauge
   * → depois rewardRate(). Insumos do APR "rendendo agora" (Receita C2). Falha
   * aqui degrada só o APR (vira "—"), NUNCA derruba a posição.
   */
  private async loadAprInputs(pools: Map<Address, PoolMeta>): Promise<void> {
    const ZERO_ADDR: Address = "0x0000000000000000000000000000000000000000";
    const cl = [...pools.entries()].filter(([, m]) => m.kind === "concentrated");
    if (cl.length === 0) return;

    const FNS = ["liquidity", "stakedLiquidity", "gauge"] as const;
    const res = await this.reader.multicall({
      contracts: cl.flatMap(([lp]) => FNS.map((fn) => ({ address: lp, abi: poolProbeAbi, functionName: fn }))),
      allowFailure: true,
    });
    cl.forEach(([, m], i) => {
      const liquidity = res[i * FNS.length];
      const stakedLiquidity = res[i * FNS.length + 1];
      const gauge = res[i * FNS.length + 2];
      m.activeLiquidity = liquidity.status === "success" ? (liquidity.result as bigint) : null;
      m.poolStakedLiquidity = stakedLiquidity.status === "success" ? (stakedLiquidity.result as bigint) : null;
      const g = gauge.status === "success" ? (gauge.result as Address) : null;
      m.gauge = g && g !== ZERO_ADDR ? g : null;
    });

    /* rewardRate() e periodFinish() dos gauges (só pools CL com gauge). Gauge
       desligado — o lançamento do Aero em 22/10/2026 desligou todos os da
       Aerodrome e da Velodrome — continua respondendo o rewardRate da última
       semana paga; só o periodFinish diz que acabou. */
    const withGauge = cl.map(([, m]) => m).filter((m) => m.gauge != null);
    if (withGauge.length === 0) return;
    const GFNS = ["rewardRate", "periodFinish"] as const;
    const rates = await this.reader.multicall({
      contracts: withGauge.flatMap((m) =>
        GFNS.map((fn) => ({ address: m.gauge as Address, abi: gaugeAbi, functionName: fn })),
      ),
      allowFailure: true,
    });
    const nowSec = Math.floor(Date.now() / 1000);
    withGauge.forEach((m, i) => {
      const rate = rates[i * GFNS.length];
      const finish = rates[i * GFNS.length + 1];
      // sem saber se o período acabou, o ritmo não prova nada → "—"
      if (rate.status !== "success" || finish.status !== "success") return;
      const end = Number(finish.result as bigint);
      if (end <= nowSec) {
        m.emissionRatePerSec = 0n;
        m.emissionsEndedAt = end;
      } else {
        m.emissionRatePerSec = rate.result as bigint;
      }
    });
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
        this.warn(`token ${a} sem symbol/decimals — usando padrão (18 casas)`, null);
      }
      out.set(a, {
        address: a,
        symbol: sym.status === "success" ? cleanSymbol(sym.result as string, a.slice(0, 8)) : a.slice(0, 8),
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
  protocol = "aerodrome",
  chainId: number = CHAIN_ID,
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
      ...(pool.tick === null ? { currentKnown: false } : {}),
    };
  }

  // insumos do APR "rendendo agora" (Receita C2) — só CL
  const earningInputs = isCL
    ? {
        // L da posição p/ taxas = total ativo (stake não impede o LP de ganhar fees)
        liquidity: p.liquidity + p.staked,
        activeLiquidity: pool.activeLiquidity ?? null,
        stakedLiquidity: p.staked,
        poolStakedLiquidity: pool.poolStakedLiquidity ?? null,
        emissionRatePerSec: pool.emissionRatePerSec ?? null,
        ...(pool.emissionsEndedAt !== undefined ? { emissionsEndedAt: pool.emissionsEndedAt } : {}),
        emissionToken: pool.gauge ? aero : null,
        // o Sugar não devolve feeGrowthInside da posição → janela não validada
        feeGrowthInside0LastX128: null,
      }
    : undefined;

  return {
    protocol,
    chainId,
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
    earningInputs,
  };
}

function fallbackToken(address: Address): TokenInfo {
  return { address, symbol: address.slice(0, 8), decimals: 18 };
}
