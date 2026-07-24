/**
 * Adapter Uniswap V3 (Base) — implementa ProtocolAdapter (Receita B do
 * PLAYBOOK_EXPANSAO.md).
 *
 * Estratégia:
 * - Enumeração BARATA pelos NFTs da conta (balanceOf → tokenOfOwnerByIndex →
 *   positions), tudo em multicall — sem varrer pools.
 * - Amounts pela NOSSA matemática Q96 (core/math/liquidity + tickmath),
 *   validada com contraprova na Fase 5.
 * - Taxas pendentes por simulação de collect() via eth_call (100% leitura,
 *   nenhuma transação); fallback: tokensOwed do NFPM + aviso.
 * - Uniswap não tem gauges → staked sempre false, sem emissões.
 */

import { erc20Abi, type Address } from "viem";
import type { ChainReader, LpPosition, ProtocolAdapter, TokenInfo } from "../../types";
import { amountsForLiquidity } from "../../math/liquidity";
import { getSqrtRatioAtTick } from "../../math/tickmath";
import { isInRange, tickToPrice0In1 } from "../../math/ticks";
import { mapLimit } from "../../util";
import { cleanSymbol } from "../aerodrome/index";
import { MAX_UINT128, nfpmAbi, uniFactoryAbi, uniPoolAbi, type UniRawPosition } from "./abi";
import { MAX_NFTS, UNISWAP_V3_BASE, type UniV3ChainConfig } from "./config";

export interface UniswapV3Options {
  /** config da rede (default: Uniswap V3 na Base) */
  config?: UniV3ChainConfig;
  nfpm?: Address;
  factory?: Address;
  maxNfts?: number;
  onWarn?: (msg: string) => void;
}

export class UniswapV3Adapter implements ProtocolAdapter {
  readonly protocol = "uniswap-v3";
  readonly chainId: number;

  private readonly nfpm: Address;
  private readonly factory: Address;
  private readonly maxNfts: number;
  private readonly warn: (msg: string) => void;

  constructor(
    private readonly reader: ChainReader,
    opts: UniswapV3Options = {},
  ) {
    const config = opts.config ?? UNISWAP_V3_BASE;
    this.chainId = config.chainId;
    this.nfpm = opts.nfpm ?? config.nfpm;
    this.factory = opts.factory ?? config.factory;
    this.maxNfts = opts.maxNfts ?? MAX_NFTS;
    this.warn = opts.onWarn ?? (() => {});
  }

  async getPositions(account: Address): Promise<LpPosition[]> {
    const raw = await this.fetchRawPositions(account);
    if (raw.length === 0) return [];

    const fees = await this.simulateFees(account, raw);
    const pools = await this.loadPools(raw);
    const tokens = await this.loadTokens(raw);

    const out: LpPosition[] = [];
    for (const p of raw) {
      const pool = pools.get(poolKey(p));
      if (!pool) {
        this.warn(`uniswap: pool de ${p.token0}/${p.token1} fee ${p.fee} sem metadados — NFT #${p.tokenId} ignorado`);
        continue;
      }
      const token0 = tokens.get(p.token0) ?? fallbackToken(p.token0);
      const token1 = tokens.get(p.token1) ?? fallbackToken(p.token1);

      const sqrtLower = getSqrtRatioAtTick(p.tickLower);
      const sqrtUpper = getSqrtRatioAtTick(p.tickUpper);
      const { amount0, amount1 } = amountsForLiquidity(p.liquidity, pool.sqrtPriceX96, sqrtLower, sqrtUpper);

      const [fee0, fee1] = fees.get(p.tokenId) ?? [p.tokensOwed0, p.tokensOwed1];
      const rewards: LpPosition["rewards"] = [];
      if (fee0 > 0n) rewards.push({ token: token0, raw: fee0, kind: "fee" });
      if (fee1 > 0n) rewards.push({ token: token1, raw: fee1, kind: "fee" });

      const feePct = (p.fee / 10_000).toLocaleString("en-US", { maximumFractionDigits: 2 });

      out.push({
        protocol: this.protocol,
        chainId: this.chainId,
        poolAddress: pool.address,
        poolSymbol: `${token0.symbol}/${token1.symbol} ${feePct}%`,
        kind: "concentrated",
        positionId: p.tokenId.toString(),
        staked: false,
        managedByAlm: null,
        token0,
        token1,
        amount0Raw: amount0,
        amount1Raw: amount1,
        rewards,
        range: {
          tickLower: p.tickLower,
          tickUpper: p.tickUpper,
          tickCurrent: pool.tick,
          inRange: isInRange(pool.tick, p.tickLower, p.tickUpper),
          priceLower: tickToPrice0In1(p.tickLower, token0.decimals, token1.decimals),
          priceUpper: tickToPrice0In1(p.tickUpper, token0.decimals, token1.decimals),
          priceCurrent: tickToPrice0In1(pool.tick, token0.decimals, token1.decimals),
        },
        // Uniswap não tem gauge → só taxas (emissões nulas)
        earningInputs: {
          liquidity: p.liquidity,
          activeLiquidity: pool.activeLiquidity,
          stakedLiquidity: null,
          poolStakedLiquidity: null,
          emissionRatePerSec: null,
          emissionToken: null,
        },
      });
    }
    return out;
  }

  /** NFTs da conta → posições cruas com liquidez ou taxas a receber. */
  private async fetchRawPositions(account: Address): Promise<UniRawPosition[]> {
    const balance = (await this.reader.readContract({
      address: this.nfpm,
      abi: nfpmAbi,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;
    if (balance === 0n) return [];

    const count = Number(balance > BigInt(this.maxNfts) ? BigInt(this.maxNfts) : balance);
    if (balance > BigInt(this.maxNfts)) {
      this.warn(`uniswap: carteira tem ${balance} NFTs de posição; enumerando só os primeiros ${this.maxNfts}`);
    }

    const idResults = await this.reader.multicall({
      contracts: Array.from({ length: count }, (_, i) => ({
        address: this.nfpm,
        abi: nfpmAbi,
        functionName: "tokenOfOwnerByIndex",
        args: [account, BigInt(i)],
      })),
      allowFailure: true,
    });
    const ids = idResults.filter((r) => r.status === "success").map((r) => r.result as bigint);
    if (ids.length < count) this.warn(`uniswap: ${count - ids.length} índice(s) de NFT não responderam`);

    const posResults = await this.reader.multicall({
      contracts: ids.map((id) => ({ address: this.nfpm, abi: nfpmAbi, functionName: "positions", args: [id] })),
      allowFailure: true,
    });

    const raw: UniRawPosition[] = [];
    posResults.forEach((r, i) => {
      if (r.status !== "success") {
        this.warn(`uniswap: positions(${ids[i]}) falhou`);
        return;
      }
      const v = r.result as readonly unknown[];
      raw.push({
        tokenId: ids[i],
        token0: v[2] as Address,
        token1: v[3] as Address,
        fee: Number(v[4]),
        tickLower: Number(v[5]),
        tickUpper: Number(v[6]),
        liquidity: v[7] as bigint,
        tokensOwed0: v[10] as bigint,
        tokensOwed1: v[11] as bigint,
      });
    });

    // posição fechada e sem taxas pendentes não interessa
    return raw.filter((p) => p.liquidity > 0n || p.tokensOwed0 > 0n || p.tokensOwed1 > 0n);
  }

  /** Taxas pendentes reais via collect() simulado (inclui as ainda não "poked"). */
  private async simulateFees(account: Address, raw: UniRawPosition[]): Promise<Map<bigint, [bigint, bigint]>> {
    const out = new Map<bigint, [bigint, bigint]>();
    if (!this.reader.simulateContract) {
      this.warn("uniswap: simulateContract indisponível — taxas pendentes podem estar subestimadas (tokensOwed)");
      return out;
    }
    let failures = 0;
    await mapLimit(raw, 5, async (p) => {
      try {
        const sim = await this.reader.simulateContract!({
          address: this.nfpm,
          abi: nfpmAbi,
          functionName: "collect",
          args: [{ tokenId: p.tokenId, recipient: account, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
          account,
        });
        const [a0, a1] = sim.result as readonly [bigint, bigint];
        out.set(p.tokenId, [a0, a1]);
      } catch {
        failures++;
      }
    });
    if (failures > 0) {
      this.warn(`uniswap: simulação de taxas falhou em ${failures} posição(ões) — usando tokensOwed (pode subestimar)`);
    }
    return out;
  }

  private async loadPools(raw: UniRawPosition[]) {
    const keys = new Map<string, UniRawPosition>();
    for (const p of raw) if (!keys.has(poolKey(p))) keys.set(poolKey(p), p);
    const entries = [...keys.entries()];

    const addrResults = await this.reader.multicall({
      contracts: entries.map(([, p]) => ({
        address: this.factory,
        abi: uniFactoryAbi,
        functionName: "getPool",
        args: [p.token0, p.token1, p.fee],
      })),
      allowFailure: true,
    });

    const found: Array<{ key: string; address: Address }> = [];
    addrResults.forEach((r, i) => {
      if (r.status === "success" && (r.result as Address) !== "0x0000000000000000000000000000000000000000") {
        found.push({ key: entries[i][0], address: r.result as Address });
      }
    });

    const poolResults = await this.reader.multicall({
      contracts: found.flatMap((f) => [
        { address: f.address, abi: uniPoolAbi, functionName: "slot0" },
        { address: f.address, abi: uniPoolAbi, functionName: "liquidity" },
      ]),
      allowFailure: true,
    });

    const out = new Map<string, { address: Address; sqrtPriceX96: bigint; tick: number; activeLiquidity: bigint | null }>();
    found.forEach((f, i) => {
      const slot = poolResults[i * 2];
      const liq = poolResults[i * 2 + 1];
      if (slot.status !== "success") return;
      const s = slot.result as readonly unknown[];
      out.set(f.key, {
        address: f.address,
        sqrtPriceX96: s[0] as bigint,
        tick: Number(s[1]),
        activeLiquidity: liq.status === "success" ? (liq.result as bigint) : null,
      });
    });
    return out;
  }

  private async loadTokens(raw: UniRawPosition[]): Promise<Map<Address, TokenInfo>> {
    const addrs = [...new Set(raw.flatMap((p) => [p.token0, p.token1]))];
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
      out.set(a, {
        address: a,
        symbol: sym.status === "success" ? cleanSymbol(sym.result as string, a.slice(0, 8)) : a.slice(0, 8),
        decimals: dec.status === "success" ? Number(dec.result) : 18,
      });
    });
    return out;
  }
}

function poolKey(p: UniRawPosition): string {
  return `${p.token0}-${p.token1}-${p.fee}`.toLowerCase();
}

function fallbackToken(address: Address): TokenInfo {
  return { address, symbol: address.slice(0, 8), decimals: 18 };
}
