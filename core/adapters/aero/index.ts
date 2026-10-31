/**
 * Adapter Aero (Slipstream v2 da fusão Aerodrome + Velodrome) — ver
 * `config.ts` para a origem dos endereços e `poc/probe-aero.ts` para a prova.
 *
 * Herda a varredura do `UniswapV3Adapter` (NFTs da carteira → `positions()` →
 * Q96). O que muda, e só isso vive aqui:
 * - `positions()` com `tickSpacing` no lugar do `fee` e pool achado por
 *   `CLFactory.getPool(t0, t1, tickSpacing)`; nome "CL100-WETH/USDC";
 * - posições EM STAKE: não há Sugar, então percorremos os gauges dos pools da
 *   factory (`pool.gauge()`) e perguntamos `gauge.stakedValues(conta)`. A
 *   lista de gauges fica em cache por rede (muda devagar);
 * - em stake, as taxas do pool vão aos votantes: a posição não mostra taxa
 *   a receber; mostra a emissão pendente (`gauge.earned`) em xAERO.
 */

import type { Address } from "viem";
import type { ChainReader, LpPosition, WarnSink } from "../../types";
import type { UniRawPosition } from "../uniswap-v3/abi";
import { UniswapV3Adapter } from "../uniswap-v3/index";
import { aeroFactoryAbi, aeroGaugeAbi, aeroPoolAbi, aeroPositionsAbi, aeroSlot0Abi } from "./abi";
import { AERO_BASE, type AeroChainConfig } from "./config";

const ZERO = "0x0000000000000000000000000000000000000000";
/** a lista de gauges da rede muda em dias, não em minutos */
const GAUGES_TTL_MS = 10 * 60_000;
/** teto de pools varridos por rede (a Base tem ~540; folga para crescer) */
const MAX_POOLS = 3000;

interface GaugeList {
  at: number;
  /** gauge → pool */
  gauges: Map<Address, Address>;
}
const gaugeCache = new Map<number, Promise<GaugeList>>();

export interface AeroOptions {
  config?: AeroChainConfig;
  maxNfts?: number;
  onWarn?: WarnSink;
}

export class AeroAdapter extends UniswapV3Adapter {
  private readonly cfg: AeroChainConfig;
  /** NFT em stake → de quem e em qual gauge (preenchido em `stakedTokenIds`) */
  private readonly stakeInfo = new Map<string, { gauge: Address; account: Address }>();

  constructor(reader: ChainReader, opts: AeroOptions = {}) {
    const config = opts.config ?? AERO_BASE;
    super(reader, { config, maxNfts: opts.maxNfts, onWarn: opts.onWarn, protocol: "aero", slot0Abi: aeroSlot0Abi });
    this.cfg = config;
    this.positionsAbi = aeroPositionsAbi;
    /* Fora do simulador de APR por enquanto: o pool tem taxa dinâmica (hook) e o
       gauge novo não expõe o ritmo de emissão — o simulador mostraria uma taxa e
       um incentivo que não são os reais. O lookup só pergunta a quem tem
       `describePool`, então remover a herança o deixa de fora. */
    (this as { describePool?: unknown }).describePool = undefined;
  }

  // o layout do `positions()` é o da Uniswap (tickSpacing no índice 4): o parse da base serve

  protected override getPoolCall(p: UniRawPosition) {
    return { abi: aeroFactoryAbi, args: [p.token0, p.token1, p.fee] as const };
  }

  protected override poolKeyOf(_fee: number, tickSpacing: number): number {
    return tickSpacing;
  }

  protected override poolSymbol(sym0: string, sym1: string, p: UniRawPosition): string {
    return `CL${p.fee}-${sym0}/${sym1}`;
  }

  protected override feesGoToAccount(p: UniRawPosition): boolean {
    return !p.staked;
  }

  /** Gauge de cada pool CL da rede (cache por rede). */
  private gaugeList(): Promise<GaugeList> {
    const hit = gaugeCache.get(this.chainId);
    if (hit) {
      return hit.then((l) => {
        if (Date.now() - l.at < GAUGES_TTL_MS) return l;
        gaugeCache.delete(this.chainId);
        return this.gaugeList();
      });
    }
    const p = this.loadGauges().catch((e) => {
      gaugeCache.delete(this.chainId);
      throw e;
    });
    gaugeCache.set(this.chainId, p);
    return p;
  }

  private async loadGauges(): Promise<GaugeList> {
    const total = Number(
      (await this.reader.readContract({ address: this.factory, abi: aeroFactoryAbi, functionName: "allPoolsLength" })) as bigint,
    );
    const n = Math.min(total, MAX_POOLS);
    if (total > MAX_POOLS) this.warn(`${this.protocol}: ${total} pools na factory; lendo só os ${MAX_POOLS} primeiros`);
    const pools = (
      await this.reader.multicall({
        contracts: Array.from({ length: n }, (_, i) => ({
          address: this.factory,
          abi: aeroFactoryAbi,
          functionName: "allPools",
          args: [BigInt(i)],
        })),
        allowFailure: true,
        batchSize: 16_384,
      })
    )
      .filter((r) => r.status === "success")
      .map((r) => r.result as Address);
    const res = await this.reader.multicall({
      contracts: pools.map((pool) => ({ address: pool, abi: aeroPoolAbi, functionName: "gauge" })),
      allowFailure: true,
      batchSize: 16_384,
    });
    const gauges = new Map<Address, Address>();
    res.forEach((r, i) => {
      if (r.status === "success" && (r.result as string).toLowerCase() !== ZERO) gauges.set(r.result as Address, pools[i]);
    });
    return { at: Date.now(), gauges };
  }

  /** NFTs da conta guardados em gauges (sem Sugar: gauge a gauge, em multicall). */
  protected override async stakedTokenIds(account: Address): Promise<bigint[]> {
    let list: GaugeList;
    try {
      list = await this.gaugeList();
    } catch {
      this.warn(`${this.protocol}: lista de gauges ilegível — posições em stake podem faltar`);
      return [];
    }
    const gauges = [...list.gauges.keys()];
    if (gauges.length === 0) return [];
    const res = await this.reader.multicall({
      contracts: gauges.map((g) => ({ address: g, abi: aeroGaugeAbi, functionName: "stakedValues", args: [account] })),
      allowFailure: true,
      batchSize: 16_384,
    });
    const ids: bigint[] = [];
    let falhas = 0;
    res.forEach((r, i) => {
      if (r.status !== "success") return void falhas++;
      for (const id of r.result as readonly bigint[]) {
        ids.push(id);
        this.stakeInfo.set(id.toString(), { gauge: gauges[i], account });
      }
    });
    if (falhas > 0) this.warn(`${this.protocol}: ${falhas} gauge(s) não responderam — posições em stake podem faltar`);
    return ids;
  }

  /** Emissão pendente (xAERO) das posições em stake e insumos do "Earning now". */
  protected override async afterPositions(positions: LpPosition[]): Promise<LpPosition[]> {
    const staked = positions.filter((p) => p.staked && p.positionId !== null && this.stakeInfo.has(p.positionId));
    if (staked.length === 0) return positions;

    const [earned, poolStaked] = await Promise.all([
      this.reader.multicall({
        contracts: staked.map((p) => {
          const info = this.stakeInfo.get(p.positionId!)!;
          return { address: info.gauge, abi: aeroGaugeAbi, functionName: "earned", args: [info.account, [BigInt(p.positionId!)]] };
        }),
        allowFailure: true,
      }),
      this.reader.multicall({
        contracts: staked.map((p) => ({ address: p.poolAddress, abi: aeroPoolAbi, functionName: "stakedLiquidity" })),
        allowFailure: true,
      }),
    ]);

    let falhas = 0;
    staked.forEach((p, i) => {
      // em stake, a taxa do pool é dos votantes: nada a receber como taxa
      p.rewards = p.rewards.filter((r) => r.kind !== "fee");
      const e = earned[i];
      if (e.status !== "success") return void falhas++;
      if ((e.result as bigint) > 0n) p.rewards.push({ token: this.cfg.receiptToken, raw: e.result as bigint, kind: "emission" });
      if (p.earningInputs) {
        p.earningInputs.stakedLiquidity = p.earningInputs.liquidity;
        p.earningInputs.poolStakedLiquidity = poolStaked[i].status === "success" ? (poolStaked[i].result as bigint) : null;
        // ritmo por segundo: o gauge novo não o expõe (caps/ceilings no LeafVoter) — fica "—"
        p.earningInputs.emissionToken = this.cfg.receiptToken;
      }
    });
    if (falhas > 0) this.warn(`${this.protocol}: emissão pendente ilegível em ${falhas} posição(ões) em stake — xAERO pode faltar`);
    return positions;
  }
}
