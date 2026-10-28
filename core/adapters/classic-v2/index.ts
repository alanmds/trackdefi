/**
 * Adapter dos pools clássicos (v2) — Uniswap v2, SushiSwap v2 e PancakeSwap v2
 * (passo 10 da meta de cobertura total; ver `privado/PLAYBOOK_EXPANSAO.md`).
 *
 * A posição é um LP token ERC-20 na carteira. Quem o acha é a Token API da
 * Alchemy (`./scan.ts`), e este adapter só confere e mede:
 *  - o token declara `factory()` desta factory E a factory devolve este mesmo
 *    endereço para `getPair(token0, token1)` — contrato de spam que copia o
 *    `factory()` não passa;
 *  - quantidade = saldo ÷ totalSupply × reservas. As taxas de swap já estão
 *    dentro das reservas (não há "a receber", nem faixa, nem emissão).
 *
 * LP depositado numa fazenda (MasterChef v2 etc.) não está na carteira e fica
 * de fora — mesma regra que o resto do plano (ver PLAYBOOK, passo 10).
 */

import { erc20Abi, parseAbi, type Address } from "viem";
import type { ChainReader, LpPosition, ProtocolAdapter, TokenInfo, WarnSink } from "../../types";
import { cleanSymbol } from "../aerodrome/index";
import { MAX_PAIRS, type ClassicV2ChainConfig } from "./config";
import { alchemyUrl, scanClassicHoldings } from "./scan";

const pairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function getReserves() view returns (uint112,uint112,uint32)",
]);
const factoryAbi = parseAbi(["function getPair(address,address) view returns (address)"]);

export interface ClassicV2Options {
  config: ClassicV2ChainConfig;
  protocol: string;
  onWarn?: WarnSink;
  /**
   * Quem avisa que a lista de tokens da carteira passou do teto. A varredura é
   * uma só por rede; sem isto o mesmo aviso sairia uma vez por protocolo.
   */
  reportsCap?: boolean;
}

export class ClassicV2Adapter implements ProtocolAdapter {
  readonly protocol: string;
  readonly chainId: number;
  private readonly factory: Address;
  private readonly warn: WarnSink;
  private readonly reportsCap: boolean;

  constructor(
    private readonly reader: ChainReader,
    opts: ClassicV2Options,
  ) {
    this.chainId = opts.config.chainId;
    this.factory = opts.config.factory;
    this.protocol = opts.protocol;
    this.warn = opts.onWarn ?? (() => {});
    this.reportsCap = opts.reportsCap ?? false;
  }

  async getPositions(account: string): Promise<LpPosition[]> {
    if (!alchemyUrl(this.chainId)) {
      // sem a Token API não há lista de tokens da carteira: falha de configuração
      // do servidor (a env da rede sem a Alchemy), não algo que o visitante resolva
      this.warn(`${this.protocol}: sem RPC da Alchemy nesta rede — pools clássicos não lidos`, null);
      return [];
    }
    const scan = await scanClassicHoldings(this.chainId, this.reader, account as Address);
    if (scan.truncated && this.reportsCap) {
      this.warn(`${this.protocol}: carteira com tokens demais; só ${scan.tokensChecked} verificados`, {
        kind: "tokensCapped",
        checked: scan.tokensChecked,
      });
    }
    let mine = scan.holdings.filter((h) => h.factory.toLowerCase() === this.factory.toLowerCase());
    if (mine.length === 0) return [];
    if (mine.length > MAX_PAIRS) {
      this.warn(`${this.protocol}: ${mine.length} LPs na carteira; lendo os ${MAX_PAIRS} primeiros`, {
        kind: "pairsCapped",
        checked: MAX_PAIRS,
      });
      mine = mine.slice(0, MAX_PAIRS);
    }

    const FNS = ["token0", "token1", "totalSupply", "getReserves"] as const;
    const res = await this.reader.multicall({
      contracts: mine.flatMap((h) => FNS.map((fn) => ({ address: h.token, abi: pairAbi, functionName: fn }))),
      allowFailure: true,
      batchSize: 16_384,
    });
    interface Pair {
      lp: Address;
      balance: bigint;
      t0: Address;
      t1: Address;
      supply: bigint;
      r0: bigint;
      r1: bigint;
    }
    const pairs: Pair[] = [];
    mine.forEach((h, i) => {
      const [t0, t1, supply, reserves] = FNS.map((_, j) => res[i * FNS.length + j]);
      if (![t0, t1, supply, reserves].every((r) => r.status === "success")) return;
      const rv = reserves.result as readonly [bigint, bigint, number];
      pairs.push({
        lp: h.token,
        balance: h.balance,
        t0: t0.result as Address,
        t1: t1.result as Address,
        supply: supply.result as bigint,
        r0: rv[0],
        r1: rv[1],
      });
    });
    if (pairs.length === 0) return [];

    // a prova: a factory devolve ESTE endereço para o par declarado
    const proof = await this.reader.multicall({
      contracts: pairs.map((p) => ({ address: this.factory, abi: factoryAbi, functionName: "getPair", args: [p.t0, p.t1] })),
      allowFailure: true,
      batchSize: 16_384,
    });
    const genuine = pairs.filter(
      (p, i) => proof[i].status === "success" && (proof[i].result as string).toLowerCase() === p.lp.toLowerCase() && p.supply > 0n,
    );
    if (genuine.length === 0) return [];

    const tokens = await this.loadTokens(genuine.flatMap((p) => [p.t0, p.t1]));
    return genuine.map((p): LpPosition => {
      const token0 = tokens.get(p.t0)!;
      const token1 = tokens.get(p.t1)!;
      return {
        protocol: this.protocol,
        chainId: this.chainId,
        poolAddress: p.lp,
        poolSymbol: `${token0.symbol}/${token1.symbol}`,
        kind: "v2-volatile",
        positionId: null,
        staked: false,
        managedByAlm: null,
        token0,
        token1,
        amount0Raw: (p.balance * p.r0) / p.supply,
        amount1Raw: (p.balance * p.r1) / p.supply,
        rewards: [],
        range: null,
      };
    });
  }

  private async loadTokens(addrs: Address[]): Promise<Map<Address, TokenInfo>> {
    const unique = [...new Set(addrs)];
    const res = await this.reader.multicall({
      contracts: unique.flatMap((a) => [
        { address: a, abi: erc20Abi, functionName: "symbol" },
        { address: a, abi: erc20Abi, functionName: "decimals" },
      ]),
      allowFailure: true,
      batchSize: 16_384,
    });
    const out = new Map<Address, TokenInfo>();
    unique.forEach((a, i) => {
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
