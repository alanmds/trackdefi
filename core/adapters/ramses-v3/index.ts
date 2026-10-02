/**
 * Adapter Ramses V3 — implementa ProtocolAdapter (Receita B adaptada, ver
 * `privado/PLAYBOOK_EXPANSAO.md` → "Ramses V3 — achados do PoC").
 *
 * Fork da Uniswap v3: a varredura é a do `UniswapV3Adapter` (herança), com
 * três trocas de formato e um jeito diferente de pagar emissões:
 * - `positions()` com 10 campos e `tickSpacing` no lugar do fee;
 * - `factory.getPool(token0, token1, tickSpacing)`; a fee é dinâmica, então o
 *   nome do pool usa o tickSpacing ("CL50-WETH/USDC"), como na Aerodrome;
 * - `slot0()` com feeProtocol uint24;
 * - SEM stake: o NFT fica na carteira, e o gauge do pool (`Voter.gaugeForPool`)
 *   paga direto a ele. Recompensa a receber = `GaugeV3.earned(token, nfpm, id)`;
 *   ritmo = `rewardRate(token) × L da posição ÷ pool.liquidity()` dentro da
 *   faixa (provado no PoC: razão 0,964 entre previsto e medido).
 */

import { erc20Abi, type Address } from "viem";
import type { ChainReader, LpPosition, TokenInfo, WarnSink } from "../../types";
import type { UniRawPosition } from "../uniswap-v3/abi";
import { UniswapV3Adapter } from "../uniswap-v3/index";
import { cleanSymbol } from "../aerodrome/index";
import { feeCollectorAbi, gaugeV3Abi, ramsesFactoryAbi, ramsesPositionsAbi, ramsesSlot0Abi, ramsesVoterAbi } from "./abi";
import { RAMSES_V3_ROBINHOOD, type RamsesV3ChainConfig } from "./config";

const ZERO = "0x0000000000000000000000000000000000000000";

export interface RamsesV3Options {
  config?: RamsesV3ChainConfig;
  maxNfts?: number;
  onWarn?: WarnSink;
}

export class RamsesV3Adapter extends UniswapV3Adapter {
  private readonly feeCollector: Address;

  constructor(reader: ChainReader, opts: RamsesV3Options = {}) {
    const config = opts.config ?? RAMSES_V3_ROBINHOOD;
    super(reader, {
      config,
      maxNfts: opts.maxNfts,
      onWarn: opts.onWarn,
      protocol: "ramses-v3",
      slot0Abi: ramsesSlot0Abi,
    });
    this.feeCollector = config.feeCollector;
    this.positionsAbi = ramsesPositionsAbi;
  }

  protected override parsePosition(v: readonly unknown[]): Omit<UniRawPosition, "tokenId" | "staked"> {
    return {
      token0: v[0] as Address,
      token1: v[1] as Address,
      fee: Number(v[2]), // tickSpacing — ver UniRawPosition.fee
      tickLower: Number(v[3]),
      tickUpper: Number(v[4]),
      liquidity: v[5] as bigint,
      feeGrowthInside0LastX128: v[6] as bigint,
      tokensOwed0: v[8] as bigint,
      tokensOwed1: v[9] as bigint,
    };
  }

  protected override getPoolCall(p: UniRawPosition) {
    return { abi: ramsesFactoryAbi, args: [p.token0, p.token1, p.fee] as const };
  }

  protected override poolSymbol(sym0: string, sym1: string, p: UniRawPosition): string {
    return `CL${p.fee}-${sym0}/${sym1}`;
  }

  /** Recompensas do gauge (a receber) e insumos do "Earning now" de emissões. */
  protected override async afterPositions(positions: LpPosition[]): Promise<LpPosition[]> {
    const concentradas = positions.filter((p) => p.positionId !== null);
    if (concentradas.length === 0) return positions;

    let voter: Address;
    try {
      voter = (await this.reader.readContract({ address: this.feeCollector, abi: feeCollectorAbi, functionName: "voter" })) as Address;
    } catch {
      this.warn(`${this.protocol}: Voter ilegível — recompensas do gauge podem faltar`);
      return positions;
    }
    if (voter.toLowerCase() === ZERO) return positions; // rede sem gauges: só taxas

    const pools = [...new Set(concentradas.map((p) => p.poolAddress.toLowerCase()))] as Address[];
    const gRes = await this.reader.multicall({
      contracts: pools.map((pool) => ({ address: voter, abi: ramsesVoterAbi, functionName: "gaugeForPool", args: [pool] })),
      allowFailure: true,
    });
    const gaugeDe = new Map<string, Address>();
    pools.forEach((pool, i) => {
      const r = gRes[i];
      if (r.status === "success" && (r.result as string).toLowerCase() !== ZERO) gaugeDe.set(pool, r.result as Address);
    });
    const gauges = [...new Set(gaugeDe.values())];
    if (gauges.length === 0) return positions;

    // tokens de recompensa de cada gauge, e o ritmo de cada um
    const tRes = await this.reader.multicall({
      contracts: gauges.map((g) => ({ address: g, abi: gaugeV3Abi, functionName: "getRewardTokens" })),
      allowFailure: true,
    });
    const tokensDe = new Map<Address, Address[]>();
    gauges.forEach((g, i) => {
      if (tRes[i].status === "success") tokensDe.set(g, [...(tRes[i].result as Address[])]);
    });
    const pares = gauges.flatMap((g) => (tokensDe.get(g) ?? []).map((t) => [g, t] as const));
    const [rRes, meta] = await Promise.all([
      this.reader.multicall({
        contracts: pares.map(([g, t]) => ({ address: g, abi: gaugeV3Abi, functionName: "rewardRate", args: [t] })),
        allowFailure: true,
      }),
      this.loadRewardTokens([...new Set(pares.map(([, t]) => t))]),
    ]);
    const ritmo = new Map<string, bigint>();
    pares.forEach(([g, t], i) => {
      if (rRes[i].status === "success") ritmo.set(`${g}|${t}`.toLowerCase(), rRes[i].result as bigint);
    });

    // a receber, por posição e token
    const alvos = concentradas.flatMap((p) => {
      const g = gaugeDe.get(p.poolAddress.toLowerCase());
      return g ? (tokensDe.get(g) ?? []).map((t) => ({ p, g, t })) : [];
    });
    const eRes = await this.reader.multicall({
      contracts: alvos.map(({ g, t, p }) => ({
        address: g,
        abi: gaugeV3Abi,
        functionName: "earned",
        args: [t, this.nfpm, BigInt(p.positionId!)],
      })),
      allowFailure: true,
    });
    let falhas = 0;
    alvos.forEach(({ p, t }, i) => {
      const r = eRes[i];
      if (r.status !== "success") return void falhas++;
      const raw = r.result as bigint;
      if (raw > 0n) p.rewards.push({ token: meta.get(t.toLowerCase())!, raw, kind: "emission" });
    });
    if (falhas > 0) this.warn(`${this.protocol}: recompensa do gauge ilegível em ${falhas} leitura(s) — pode faltar`);

    /* "Earning now" de emissões: o token que o gauge paga MAIS rápido (hoje,
       o RAM; os outros vêm com ritmo 0). O cálculo do service aceita um token
       só — se um dia dois pagarem juntos, o número fica por baixo, não inflado. */
    for (const p of concentradas) {
      const g = gaugeDe.get(p.poolAddress.toLowerCase());
      if (!g || !p.earningInputs) continue;
      let melhor: { t: Address; r: bigint } | null = null;
      for (const t of tokensDe.get(g) ?? []) {
        const r = ritmo.get(`${g}|${t}`.toLowerCase()) ?? 0n;
        if (!melhor || r > melhor.r) melhor = { t, r };
      }
      if (!melhor) continue;
      p.earningInputs.emissionsWithoutStake = true;
      p.earningInputs.stakedLiquidity = p.earningInputs.liquidity;
      p.earningInputs.poolStakedLiquidity = p.earningInputs.activeLiquidity;
      p.earningInputs.emissionRatePerSec = melhor.r;
      p.earningInputs.emissionToken = meta.get(melhor.t.toLowerCase()) ?? null;
    }
    return positions;
  }

  private async loadRewardTokens(addrs: Address[]): Promise<Map<string, TokenInfo>> {
    const res = await this.reader.multicall({
      contracts: addrs.flatMap((a) => [
        { address: a, abi: erc20Abi, functionName: "symbol" },
        { address: a, abi: erc20Abi, functionName: "decimals" },
      ]),
      allowFailure: true,
    });
    const out = new Map<string, TokenInfo>();
    addrs.forEach((a, i) => {
      const sym = res[i * 2];
      const dec = res[i * 2 + 1];
      out.set(a.toLowerCase(), {
        address: a,
        symbol: sym.status === "success" ? cleanSymbol(sym.result as string, a.slice(0, 8)) : a.slice(0, 8),
        decimals: dec.status === "success" ? Number(dec.result) : 18,
      });
    });
    return out;
  }
}
