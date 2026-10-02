/**
 * Adapter PancakeSwap v3 — implementa ProtocolAdapter (Receita B adaptada,
 * ver `privado/PLAYBOOK_EXPANSAO.md` → "PancakeSwap v3 — achados do PoC").
 *
 * A Pancake v3 é fork da Uniswap v3 com o MESMO NFPM, então a varredura é a
 * do `UniswapV3Adapter` (herança). O que muda, e só isso vive aqui:
 * - `slot0()` com `feeProtocol` uint32;
 * - posições EM STAKE: o NFT vai para o MasterChef v3, que é enumerável por
 *   dono — somamos os NFTs de lá aos da carteira;
 * - as taxas da posição em stake saem simulando `collect()` NO MasterChef;
 * - emissões de CAKE: `pendingCake` (a receber) e os insumos do "Earning now"
 *   — CAKE/s do pool, liquidez em stake da posição (`boostLiquidity`, já com o
 *   boost do veCAKE) e liquidez em stake ativa do pool (`LMPool.lmLiquidity`).
 */

import type { Address } from "viem";
import type { ChainReader, LpPosition, WarnSink } from "../../types";
import type { UniRawPosition } from "../uniswap-v3/abi";
import { UniswapV3Adapter } from "../uniswap-v3/index";
import { lmPoolAbi, masterChefV3Abi, pancakePoolLmAbi, pancakeSlot0Abi } from "./abi";
import { CAKE_PER_SECOND_PRECISION, PANCAKE_V3_BSC, type PancakeV3ChainConfig } from "./config";

export interface PancakeV3Options {
  config?: PancakeV3ChainConfig;
  maxNfts?: number;
  onWarn?: WarnSink;
  /** relógio injetável (testes): fim do período de emissão é comparado com ele */
  nowSec?: () => number;
}

export class PancakeV3Adapter extends UniswapV3Adapter {
  private readonly masterChef: Address;
  private readonly cfg: PancakeV3ChainConfig;
  private readonly nowSec: () => number;

  constructor(reader: ChainReader, opts: PancakeV3Options = {}) {
    const config = opts.config ?? PANCAKE_V3_BSC;
    super(reader, {
      config,
      maxNfts: opts.maxNfts,
      onWarn: opts.onWarn,
      protocol: "pancakeswap-v3",
      slot0Abi: pancakeSlot0Abi,
    });
    this.cfg = config;
    this.masterChef = config.masterChef;
    this.nowSec = opts.nowSec ?? (() => Math.floor(Date.now() / 1000));
  }

  protected override async stakedTokenIds(account: Address): Promise<bigint[]> {
    return this.enumerateIds(this.masterChef, account);
  }

  protected override collectTarget(p: UniRawPosition): Address {
    return p.staked ? this.masterChef : this.nfpm;
  }

  /** CAKE a receber + insumos de emissão das posições em stake. */
  protected override async afterPositions(positions: LpPosition[]): Promise<LpPosition[]> {
    const staked = positions.filter((p) => p.staked && p.positionId !== null);
    if (staked.length === 0) return positions;

    const ids = staked.map((p) => BigInt(p.positionId!));
    const pools = [...new Set(staked.map((p) => p.poolAddress.toLowerCase()))] as Address[];

    const [porPosicao, porPool] = await Promise.all([
      this.reader.multicall({
        contracts: ids.flatMap((id) => [
          { address: this.masterChef, abi: masterChefV3Abi, functionName: "userPositionInfos", args: [id] },
          { address: this.masterChef, abi: masterChefV3Abi, functionName: "pendingCake", args: [id] },
        ]),
        allowFailure: true,
      }),
      this.reader.multicall({
        contracts: pools.flatMap((pool) => [
          { address: this.masterChef, abi: masterChefV3Abi, functionName: "getLatestPeriodInfo", args: [pool] },
          { address: pool, abi: pancakePoolLmAbi, functionName: "lmPool" },
        ]),
        allowFailure: true,
      }),
    ]);

    // LMPool de cada pool → liquidez em stake ativa
    const lmDe = new Map<string, Address>();
    pools.forEach((pool, i) => {
      const r = porPool[i * 2 + 1];
      if (r.status === "success") lmDe.set(pool, r.result as Address);
    });
    const lmList = [...lmDe.entries()];
    const lmRes = await this.reader.multicall({
      contracts: lmList.map(([, lm]) => ({ address: lm, abi: lmPoolAbi, functionName: "lmLiquidity" })),
      allowFailure: true,
    });
    const lmLiquidityDe = new Map<string, bigint>();
    lmList.forEach(([pool], i) => {
      if (lmRes[i].status === "success") lmLiquidityDe.set(pool, lmRes[i].result as bigint);
    });

    // CAKE/s do pool; período vencido (sem renovação ainda) = não paga nada agora
    const taxaDe = new Map<string, bigint>();
    pools.forEach((pool, i) => {
      const r = porPool[i * 2];
      if (r.status !== "success") return;
      const [cakePerSecond, endTime] = r.result as readonly [bigint, bigint];
      taxaDe.set(pool, Number(endTime) > this.nowSec() ? cakePerSecond / CAKE_PER_SECOND_PRECISION : 0n);
    });

    let falhas = 0;
    staked.forEach((p, i) => {
      const info = porPosicao[i * 2];
      const pend = porPosicao[i * 2 + 1];
      if (pend.status === "success" && (pend.result as bigint) > 0n) {
        p.rewards.push({ token: this.cfg.cake, raw: pend.result as bigint, kind: "emission" });
      }
      if (info.status !== "success" || pend.status !== "success") falhas++;

      const pool = p.poolAddress.toLowerCase();
      if (p.earningInputs) {
        p.earningInputs.stakedLiquidity = info.status === "success" ? (info.result as readonly unknown[])[1] as bigint : null;
        p.earningInputs.poolStakedLiquidity = lmLiquidityDe.get(pool) ?? null;
        p.earningInputs.emissionRatePerSec = taxaDe.get(pool) ?? null;
        p.earningInputs.emissionToken = this.cfg.cake;
      }
    });
    if (falhas > 0) this.warn(`${this.protocol}: leitura do MasterChef falhou em ${falhas} posição(ões) em stake — CAKE pode faltar`);

    return positions;
  }
}
