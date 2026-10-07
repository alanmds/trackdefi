/**
 * Adapter Uniswap V4 — implementa ProtocolAdapter (Receita D do
 * privado/PLAYBOOK_EXPANSAO.md). Provado em `poc/probe-uniswap-v4*.ts` e
 * validado contra a interface oficial do Uniswap ao centavo em 10/08/2026.
 *
 * As três coisas que fazem este adapter diferir do v3:
 *
 * 1. **Enumeração pelo histórico.** O PositionManager do v4 é ERC-721 mas
 *    NÃO é enumerável (medido: `supportsInterface(0x780e9d63)` = false, sem
 *    `totalSupply`). Não existe `tokenOfOwnerByIndex`. O caminho é ler os
 *    `Transfer` com `to` = carteira e depois confirmar quem ainda é o dono.
 *    Isso exige RPC que aceite faixa larga de blocos — o da Robinhood aceita
 *    a chain inteira numa chamada; o público da Base não (por isso o v4
 *    ainda não roda lá). Sem `getLogs`, o adapter AVISA e devolve vazio, em
 *    vez de fingir que a carteira não tem posição.
 * 2. **Pool sem endereço.** Todos os pools vivem no singleton `PoolManager`,
 *    identificados por `poolId`. Estado e taxas saem do `StateView`.
 * 3. **Taxas sem `collect()` simulável.** No v3 dá para simular o collect;
 *    aqui é a matemática de `feeGrowthInside` — e ela é barata porque o
 *    `StateView.getFeeGrowthInside` já entrega o acumulado da faixa pronto.
 *
 * Uniswap não tem gauge → `staked` sempre false, sem emissões.
 */

import { erc20Abi, type Address, type Hex } from "viem";
import type { ChainReader, LpPosition, ProtocolAdapter, RewardAmount, TokenInfo, WarnSink } from "../../types";
import { amountsForLiquidity } from "../../math/liquidity";
import { getSqrtRatioAtTick } from "../../math/tickmath";
import { isInRange, tickToPrice0In1 } from "../../math/ticks";
import { chainInfo } from "../../chains";
import { cleanSymbol } from "../aerodrome/index";
import {
  NATIVE_CURRENCY,
  NO_HOOK,
  pendingFee,
  poolIdOf,
  positionIdOf,
  positionInfoMatchesPool,
  positionManagerAbi,
  stateViewAbi,
  transferEvent,
  unpackPositionInfo,
  type PoolKey,
  type V4RawPosition,
} from "./abi";
import {
  LOG_RETRIES,
  MAX_INDEX_PAGES,
  MAX_LOG_CALLS,
  MAX_V4_NFTS,
  MIN_LOG_SPAN,
  UNISWAP_V4_ROBINHOOD,
  type UniV4ChainConfig,
} from "./config";

/** corpo do `alchemy_getAssetTransfers` — só o que este adapter lê */
type IndiceResposta = {
  result?: { transfers?: Array<{ tokenId?: string }>; pageKey?: string };
  error?: { message: string };
};

export interface UniswapV4Options {
  config?: UniV4ChainConfig;
  maxNfts?: number;
  /** espera-base entre repetições de uma faixa de logs recusada (testes usam 0) */
  retryDelayMs?: number;
  onWarn?: WarnSink;
}

export class UniswapV4Adapter implements ProtocolAdapter {
  readonly protocol = "uniswap-v4";
  readonly chainId: number;

  private readonly positionManager: Address;
  private readonly stateView: Address;
  private readonly poolManager: Address;
  private readonly maxNfts: number;
  private readonly retryDelayMs: number;
  private readonly warn: WarnSink;
  /** qual fonte de NFTs a rede prefere — ver `UniV4ChainConfig.enumeration` */
  private readonly enumeration: "logs" | "index";

  constructor(
    private readonly reader: ChainReader,
    opts: UniswapV4Options = {},
  ) {
    const config = opts.config ?? UNISWAP_V4_ROBINHOOD;
    this.chainId = config.chainId;
    this.positionManager = config.positionManager;
    this.stateView = config.stateView;
    this.poolManager = config.poolManager;
    this.maxNfts = opts.maxNfts ?? MAX_V4_NFTS;
    this.retryDelayMs = opts.retryDelayMs ?? 400;
    this.warn = opts.onWarn ?? (() => {});
    this.enumeration = config.enumeration ?? "logs";
  }

  async getPositions(account: Address): Promise<LpPosition[]> {
    const raw = await this.fetchRawPositions(account);
    if (raw.length === 0) return [];

    const poolIds = [...new Set(raw.map((p) => p.poolId))];
    const [pools, fees, tokens] = await Promise.all([
      this.loadPools(poolIds),
      this.loadFees(raw),
      this.loadTokens(raw),
    ]);

    const out: LpPosition[] = [];
    for (const p of raw) {
      const pool = pools.get(p.poolId);
      if (!pool) {
        this.warn(`uniswap-v4: estado do pool ${p.poolId.slice(0, 10)}… indisponível — NFT #${p.tokenId} ignorado`);
        continue;
      }
      const token0 = tokens.get(p.key.currency0) ?? fallbackToken(p.key.currency0);
      const token1 = tokens.get(p.key.currency1) ?? fallbackToken(p.key.currency1);

      const { amount0, amount1 } = amountsForLiquidity(
        p.liquidity,
        pool.sqrtPriceX96,
        getSqrtRatioAtTick(p.tickLower),
        getSqrtRatioAtTick(p.tickUpper),
      );

      const [fee0, fee1] = fees.get(p.tokenId) ?? [0n, 0n];
      const rewards: RewardAmount[] = [];
      if (fee0 > 0n) rewards.push({ token: token0, raw: fee0, kind: "fee" });
      if (fee1 > 0n) rewards.push({ token: token1, raw: fee1, kind: "fee" });

      const feePct = (p.key.fee / 10_000).toLocaleString("en-US", { maximumFractionDigits: 3 });

      out.push({
        protocol: this.protocol,
        chainId: this.chainId,
        // no v4 o pool não tem endereço próprio — ver comentário em config.ts
        poolAddress: this.poolManager,
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
        earningInputs: {
          liquidity: p.liquidity,
          activeLiquidity: pool.activeLiquidity,
          stakedLiquidity: null,
          poolStakedLiquidity: null,
          emissionRatePerSec: null,
          emissionToken: null,
          // v4 não tem contrato de pool próprio → sem fee APR on-chain
          feeGrowthInside0LastX128: null,
        },
      });
    }
    return out;
  }

  /**
   * `Transfer(to = carteira)` na faixa inteira; se o RPC recusar (faixa larga
   * demais, resposta grande, falha passageira), parte a faixa ao meio e tenta
   * cada metade, e uma faixa já pequena é repetida com espera crescente. Um
   * pedaço que nunca responde derruba a varredura toda: lista parcial lida
   * como "é tudo que tenho" é pior que aviso.
   */
  private async getLogsAdaptive(account: Address, from: bigint, to: bigint) {
    const budget = { calls: 0 };
    const scan = async (a: bigint, b: bigint): Promise<{ args: Record<string, unknown> }[]> => {
      let lastError: unknown;
      // faixa curta: só vale repetir; faixa longa: parte ao meio já na 1ª recusa
      const attempts = b - a < MIN_LOG_SPAN ? LOG_RETRIES + 1 : 1;
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (++budget.calls > MAX_LOG_CALLS) throw new Error("varredura de histórico excedeu o limite de chamadas");
        try {
          return await this.reader.getLogs!({
            address: this.positionManager,
            event: transferEvent,
            args: { to: account },
            fromBlock: a,
            toBlock: b,
          });
        } catch (e) {
          lastError = e;
          if (attempt + 1 < attempts) await new Promise((r) => setTimeout(r, this.retryDelayMs * (attempt + 1)));
        }
      }
      if (b - a < MIN_LOG_SPAN) throw lastError;
      const mid = a + (b - a) / 2n;
      const left = await scan(a, mid);
      const right = await scan(mid + 1n, b);
      return [...left, ...right];
    };
    return scan(from, to);
  }

  /**
   * NFTs que a carteira RECEBEU — o passo que o histórico de `Transfer` fazia
   * sozinho. Duas fontes, na ordem que a rede preferir (ver
   * `UniV4ChainConfig.enumeration`), e uma serve de reserva da outra:
   *
   *  - **logs**: varredura de `Transfer(to = carteira)` do início da chain.
   *    Só onde o RPC aceita a faixa (a Robinhood aceita a chain inteira; na
   *    Base nenhum dos 8 públicos aceita, na BNB o público aceita 2.000
   *    blocos por chamada contra 126M — medido em `poc/probe-v4-bnb-varredura`).
   *  - **índice**: a API indexada do próprio RPC (Alchemy), paginada, sem
   *    varrer bloco a bloco. Mesma semântica, então o resto do caminho —
   *    `ownerOf` confirmando quem ainda é dono — é idêntico.
   *
   * Devolve `null` quando NADA funcionou: aí quem chama avisa e devolve
   * lista vazia. Lista parcial lida como "é tudo que tenho" é pior que aviso.
   */
  private async candidatos(account: Address): Promise<bigint[] | null> {
    const fontes: Array<() => Promise<{ ids: bigint[] } | { erro: string }>> =
      this.enumeration === "index"
        ? [() => this.porIndice(account), () => this.porLogs(account)]
        : [() => this.porLogs(account), () => this.porIndice(account)];

    const erros: string[] = [];
    for (const fonte of fontes) {
      const r = await fonte();
      // fonte que respondeu deu o conjunto COMPLETO de candidatos — a outra
      // falhou sem prejuízo nenhum para o usuário, então não há o que avisar
      if ("ids" in r) return r.ids;
      erros.push(r.erro);
    }
    this.warn(`uniswap-v4: ${erros.join(" · ")} — posições v4 não listadas`);
    return null;
  }

  /** Fonte "logs": varredura adaptativa de `Transfer` (getLogsAdaptive). */
  private async porLogs(account: Address): Promise<{ ids: bigint[] } | { erro: string }> {
    if (!this.reader.getLogs || !this.reader.getBlockNumber) return { erro: "RPC sem getLogs" };
    try {
      const head = await this.reader.getBlockNumber();
      const logs = await this.getLogsAdaptive(account, 0n, head);
      return { ids: [...new Set(logs.map((l) => l.args.tokenId as bigint).filter((id) => id != null))] };
    } catch (e) {
      // RPC que limita a faixa de blocos cai aqui.
      return { erro: `o RPC recusou a varredura de histórico (${(e as Error).message.split("\n")[0]})` };
    }
  }

  /**
   * Fonte "índice": `alchemy_getAssetTransfers` no MESMO endpoint do RPC —
   * devolve as transferências de ERC-721 PARA a carteira, paginado, com
   * páginação ilimitada por faixa de blocos. Requer `<REDE>_RPC_URLS` com
   * Alchemy (é o `BSC_RPC_URLS` que a DEPLOY.md já manda configurar).
   *
   * Os ids voltam em hex e são candidatos, como no caminho de logs: quem já
   * saiu da carteira é descartado pelo `ownerOf` logo adiante.
   */
  private async porIndice(account: Address): Promise<{ ids: bigint[] } | { erro: string }> {
    const env = chainInfo(this.chainId).rpcEnv;
    const url = (process.env[env] ?? "")
      .split(",")
      .map((s) => s.trim())
      .find((u) => u.includes("alchemy.com") && /\/v2\/[^/]+\/?$/.test(u.split("?")[0]));
    if (!url) return { erro: `sem API indexada (falta ${env} com Alchemy)` };

    const semQuery = url.split("?")[0];
    const base = semQuery.replace(/\/v2\/[^/]+\/?$/, "");
    const chave = semQuery.slice(base.length).replace(/^\//, "").replace(/^v2\//, "");

    const ids = new Set<bigint>();
    let pageKey: string | undefined;
    let paginas = 0;
    do {
      const r = await this.indicePagina(`${base}/v2/${chave}`, account, pageKey);
      if ("erro" in r) return { erro: r.erro };
      for (const t of r.corpo.result?.transfers ?? []) if (t.tokenId) ids.add(BigInt(t.tokenId));
      pageKey = r.corpo.result?.pageKey;
      paginas++;
    } while (pageKey && paginas < MAX_INDEX_PAGES);

    if (pageKey) {
      this.warn(
        `uniswap-v4: índice do RPC limitado a ${MAX_INDEX_PAGES} páginas (${ids.size} NFTs lidos) — candidatos antigos podem faltar`,
      );
    }
    return { ids: [...ids] };
  }

  /** uma página do índice — devolve o corpo, ou o motivo de não ter dado */
  private async indicePagina(
    endpoint: string,
    account: Address,
    pageKey: string | undefined,
  ): Promise<{ corpo: IndiceResposta } | { erro: string }> {
    let r: Response;
    try {
      r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              category: ["erc721"],
              toAddress: account,
              contractAddresses: [this.positionManager],
              withMetadata: false,
              page_size: 100,
              pageKey,
            },
          ],
        }),
      });
    } catch (e) {
      return { erro: `índice do RPC inacessível (${(e as Error).message.split("\n")[0]})` };
    }
    const corpo = (await r.json().catch(() => null)) as IndiceResposta | null;
    if (!r.ok || !corpo) return { erro: `índice do RPC respondeu HTTP ${r.status}` };
    if (corpo.error) return { erro: `índice do RPC recusou (${corpo.error.message})` };
    return { corpo };
  }

  /**
   * NFTs da carteira. Duas etapas, porque o histórico só diz o que ENTROU:
   * a fonte de enumeração da rede dá os candidatos, e `ownerOf` descarta os
   * que já saíram.
   */
  private async fetchRawPositions(account: Address): Promise<V4RawPosition[]> {
    let candidatos = await this.candidatos(account);
    if (candidatos === null || candidatos.length === 0) return [];
    if (candidatos.length > this.maxNfts) {
      this.warn(`uniswap-v4: carteira já recebeu ${candidatos.length} NFTs; conferindo só os ${this.maxNfts} mais recentes`, {
        kind: "capped",
        checked: this.maxNfts,
      });
      candidatos = candidatos.slice(-this.maxNfts);
    }

    const donos = await this.reader.multicall({
      contracts: candidatos.map((id) => ({
        address: this.positionManager,
        abi: positionManagerAbi,
        functionName: "ownerOf",
        args: [id],
      })),
      allowFailure: true,
    });
    const ids = candidatos.filter(
      (_, i) =>
        donos[i].status === "success" && (donos[i].result as Address).toLowerCase() === account.toLowerCase(),
    );
    if (ids.length === 0) return [];

    const dados = await this.reader.multicall({
      contracts: ids.flatMap((id) => [
        { address: this.positionManager, abi: positionManagerAbi, functionName: "getPoolAndPositionInfo", args: [id] },
        { address: this.positionManager, abi: positionManagerAbi, functionName: "getPositionLiquidity", args: [id] },
      ]),
      allowFailure: true,
    });

    const raw: V4RawPosition[] = [];
    ids.forEach((id, i) => {
      const info = dados[i * 2];
      const liq = dados[i * 2 + 1];
      if (info.status !== "success" || liq.status !== "success") {
        this.warn(`uniswap-v4: leitura do NFT #${id} falhou`);
        return;
      }
      const [key, packed] = info.result as [PoolKey, bigint];
      const unpacked = unpackPositionInfo(packed);
      const poolId = poolIdOf(key);
      // guarda contra layout errado: os 25 bytes altos têm de ser o poolId
      if (!positionInfoMatchesPool(unpacked, poolId)) {
        this.warn(`uniswap-v4: PositionInfo do NFT #${id} não confere com o poolId — ignorado`);
        return;
      }
      raw.push({
        tokenId: id,
        key,
        poolId,
        tickLower: unpacked.tickLower,
        tickUpper: unpacked.tickUpper,
        liquidity: liq.result as bigint,
      });
    });

    // posição fechada e sem taxas pendentes não interessa (mesma regra do v3).
    // No v4 as taxas são creditadas ao queimar, então liquidez zero = nada a
    // mostrar — e é exatamente o que a interface oficial do Uniswap esconde.
    return raw.filter((p) => p.liquidity > 0n);
  }

  /** Estado de cada pool: preço/tick e liquidez ativa (para o APR da posição). */
  private async loadPools(poolIds: Hex[]) {
    const res = await this.reader.multicall({
      contracts: poolIds.flatMap((id) => [
        { address: this.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [id] },
        { address: this.stateView, abi: stateViewAbi, functionName: "getLiquidity", args: [id] },
      ]),
      allowFailure: true,
    });

    const out = new Map<Hex, { sqrtPriceX96: bigint; tick: number; activeLiquidity: bigint | null }>();
    poolIds.forEach((id, i) => {
      const slot = res[i * 2];
      const liq = res[i * 2 + 1];
      if (slot.status !== "success") return;
      const s = slot.result as readonly unknown[];
      out.set(id, {
        sqrtPriceX96: s[0] as bigint,
        tick: Number(s[1]),
        activeLiquidity: liq.status === "success" ? (liq.result as bigint) : null,
      });
    });
    return out;
  }

  /**
   * Taxas pendentes: (feeGrowthInside atual − o do último acerto) × L / 2^128.
   *
   * ⚠️ Pool com hook: o `feeGrowthInside` do núcleo continua correto, então a
   * taxa de swap sai certa. O que este cálculo NÃO enxerga é recompensa que
   * um hook acumule POR FORA do pool. Por isso o aviso — melhor subestimar e
   * dizer, do que inventar.
   */
  private async loadFees(raw: V4RawPosition[]): Promise<Map<bigint, [bigint, bigint]>> {
    const comHook = raw.filter((p) => p.key.hooks !== NO_HOOK);
    if (comHook.length > 0) {
      this.warn(
        `uniswap-v4: ${comHook.length} posição(ões) em pool com hook — taxas do núcleo estão certas, mas recompensa própria do hook não é contabilizada`,
        { kind: "hooks", positions: comHook.length },
      );
    }

    const res = await this.reader.multicall({
      contracts: raw.flatMap((p) => [
        {
          address: this.stateView,
          abi: stateViewAbi,
          functionName: "getFeeGrowthInside",
          args: [p.poolId, p.tickLower, p.tickUpper],
        },
        {
          address: this.stateView,
          abi: stateViewAbi,
          functionName: "getPositionInfo",
          args: [p.poolId, positionIdOf(this.positionManager, p.tickLower, p.tickUpper, p.tokenId)],
        },
      ]),
      allowFailure: true,
    });

    const out = new Map<bigint, [bigint, bigint]>();
    raw.forEach((p, i) => {
      const growth = res[i * 2];
      const pos = res[i * 2 + 1];
      if (growth.status !== "success" || pos.status !== "success") {
        this.warn(`uniswap-v4: taxas pendentes do NFT #${p.tokenId} indisponíveis`);
        return;
      }
      const [gi0, gi1] = growth.result as readonly [bigint, bigint];
      const [liq, last0, last1] = pos.result as readonly [bigint, bigint, bigint];
      out.set(p.tokenId, [pendingFee(gi0, last0, liq), pendingFee(gi1, last1, liq)]);
    });
    return out;
  }

  /**
   * Símbolo/decimais dos tokens. O v4 aceita a moeda NATIVA da rede como
   * currency (endereço zero) — ela não responde a `symbol()`, então vem da
   * definição da rede.
   */
  private async loadTokens(raw: V4RawPosition[]): Promise<Map<Address, TokenInfo>> {
    const todos = [...new Set(raw.flatMap((p) => [p.key.currency0, p.key.currency1]))];
    const out = new Map<Address, TokenInfo>();

    if (todos.includes(NATIVE_CURRENCY)) {
      const nativa = chainInfo(this.chainId).chain.nativeCurrency;
      out.set(NATIVE_CURRENCY, {
        address: NATIVE_CURRENCY,
        symbol: nativa.symbol,
        decimals: nativa.decimals,
      });
    }

    const erc20s = todos.filter((a) => a !== NATIVE_CURRENCY);
    if (erc20s.length === 0) return out;

    const res = await this.reader.multicall({
      contracts: erc20s.flatMap((a) => [
        { address: a, abi: erc20Abi, functionName: "symbol" },
        { address: a, abi: erc20Abi, functionName: "decimals" },
      ]),
      allowFailure: true,
    });
    erc20s.forEach((a, i) => {
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

function fallbackToken(address: Address): TokenInfo {
  return { address, symbol: address.slice(0, 8), decimals: 18 };
}
