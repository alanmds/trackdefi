/**
 * Camada de serviço: compõe adapter + preços e entrega um DTO pronto para a
 * UI e para a API — valores em US$ já calculados no servidor, nada de bigint
 * (tudo serializável em JSON; quantidades cruas vão como string).
 *
 * Regra de preço (igual à validada pelo Alan na CLI): o valor de uma posição
 * só existe se AMBOS os tokens têm preço; senão é null e conta como
 * "posição sem preço" — nunca estimamos.
 */

import { formatUnits, type Address } from "viem";
import type { AdapterNotice, LockPosition, LpPosition, PositionKind, ProtocolAdapter } from "./types";
import { buildAdapters } from "./adapters/registry";
import { chainInfo } from "./chains";
import { defillamaPrices } from "./prices/defillama";
import type { PriceProvider } from "./prices/types";
import { getYieldsIndex, type YieldsIndex } from "./yields/defillama";
import { computeEarning } from "./yields/positionApr";
import {
  computeOnchainFeeApr,
  poolLayout,
  readPositionFeeWindows,
  type FeeWindowsResult,
  type FeeWindowTarget,
} from "./yields/onchain";
import { createReader } from "./chain";
import { mapLimit } from "./util";
import { orientRange } from "./math/ticks";

export interface TokenAmountDTO {
  symbol: string;
  address: string;
  decimals: number;
  amountRaw: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
}

export interface RewardDTO {
  symbol: string;
  address: string;
  kind: "fee" | "emission";
  amountRaw: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
}

export interface RangeDTO {
  inRange: boolean;
  /** true = preços exibidos como token0/token1 (direção invertida p/ legibilidade) */
  inverted: boolean;
  lower: number;
  upper: number;
  current: number;
  /** rótulo do par na direção exibida, ex.: "USDC/WETH" */
  quoteLabel: string;
}

/** APR do POOL (propriedade do pool, não ganho pessoal) — fonte externa */
export interface AprDTO {
  current: number;
  base: number | null;
  reward: number | null;
  mean30d: number | null;
  source: string;
}

/** APR "rendendo agora" da POSIÇÃO (Receita C2) — 0 fora do range; null = "—" */
/** uma janela de medição de taxas, já em números de exibição */
export interface EarningWindowDTO {
  /** duração real medida, em segundos (a UI escreve "15 min" / "24 h") */
  windowSec: number;
  /** % ao ano das taxas nesta janela */
  feePct: number;
  /** quanto a posição ganhou em taxas DENTRO da janela, em US$ */
  feeUsd: number;
}

export interface EarningDTO {
  /** taxas + emissões que ESTA posição rende agora; 0 fora do range */
  nowPct: number;
  /** componente de taxas de swap; null = sem dado confiável */
  feePct: number | null;
  /** componente de emissões do gauge (staked); null = não se aplica */
  emissionPct: number | null;
  /**
   * Cada janela medida (24 h e 15 min), da mais longa para a mais curta.
   * Vazio = nenhuma medição no contrato — `feePct` então veio da estimativa
   * antiga, ou não há número. O percentual sozinho engana quem opera no dia:
   * anualizar 15 minutos multiplica por 35.040, então a tela mostra SEMPRE o
   * valor em dólar ao lado.
   */
  windows: EarningWindowDTO[];
  /** em range, porém mais nova que a menor janela — a tela avisa em vez de
   *  deixar um vazio mudo */
  tooNew: boolean;
}

export interface PositionDTO {
  protocol: string;
  chainId: number;
  poolAddress: string;
  poolSymbol: string;
  kind: PositionKind;
  positionId: string | null;
  staked: boolean;
  managedByAlm: string | null;
  token0: TokenAmountDTO;
  token1: TokenAmountDTO;
  rewards: RewardDTO[];
  valueUsd: number | null;
  rewardsUsd: number | null;
  range: RangeDTO | null;
  /** null = sem dado confiável (UI mostra "—"); nunca chutamos */
  apr: AprDTO | null;
  /** APR "rendendo agora" da posição (Receita C2); null = "—" ou não se aplica */
  earning: EarningDTO | null;
}

/** recompensa pendente de um lock: rebase ou voto (taxas + incentivos) */
export interface LockRewardDTO {
  kind: "rebase" | "vote";
  symbol: string;
  address: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
}

/** lock de governança veAERO/veVELO — ver `LockPosition` em core/types.ts */
export interface LockDTO {
  protocol: string;
  chainId: number;
  lockId: string;
  token: { symbol: string; address: string; decimals: number; amount: number; priceUsd: number | null };
  /** valor do que está travado; null = token sem preço confiável */
  valueUsd: number | null;
  /** poder de voto atual, em unidades do token (decai até o vencimento) */
  votingPower: number;
  /** unix segundos; 0 = sem vencimento */
  expiresAt: number;
  permanent: boolean;
  /** depositado neste lock gerenciado (relay); null = não está */
  managedId: string | null;
  /** passou do vencimento: o token está LIBERADO para saque, sem poder de voto */
  expired: boolean;
  rewards: LockRewardDTO[];
  /** soma das recompensas; null se alguma não tiver preço */
  rewardsUsd: number | null;
}

export interface PositionsResponseDTO {
  address: string;
  /** redes varridas nesta resposta (cada posição diz a sua via chainId) */
  chains: string[];
  /** protocolos varridos nesta resposta (cada posição diz o seu) */
  protocols: string[];
  fetchedAt: string;
  scanMs: number;
  totals: {
    valueUsd: number;
    /** recompensas a receber — das posições E dos locks */
    rewardsUsd: number;
    positionsWithoutPrice: number;
    /** recompensas (itens) fora de `rewardsUsd` por falta de preço */
    rewardsWithoutPrice: number;
    /** valor travado em veAERO/veVELO (separado de `valueUsd`, que é só pools) */
    lockedUsd: number;
  };
  /** total real de posições; `positions` traz no máximo as top N por valor */
  totalPositions: number;
  positions: PositionDTO[];
  /** locks de governança, maiores primeiro */
  locks: LockDTO[];
  /** log interno, em português — para CLI e depuração, NUNCA para a tela */
  warnings: string[];
  /** o que o visitante precisa saber da varredura; a tela escreve o texto */
  notices: ScanNotice[];
}

/**
 * Aviso de varredura para o VISITANTE, em forma de dado (texto em
 * `app/ui/notices.ts`). O que importa em cada tipo é se recarregar ajuda:
 * falha de leitura sim; limite conhecido (teto de NFTs, hook, RPC sem
 * histórico) não — dizer "Refresh to retry" ali é mandar a pessoa tentar à toa.
 */
export type ScanNotice =
  /** o adapter caiu inteiro: as posições daquela rede/protocolo faltam */
  | { kind: "source"; protocol: string; chainId: number }
  /** parte da leitura falhou: pode faltar posição ou recompensa */
  | { kind: "partial"; protocol: string; chainId: number }
  | { kind: "locks"; protocol: string; chainId: number }
  /** a fonte de preços não respondeu para um lote */
  | { kind: "prices" }
  /** APR de pool (DefiLlama) não carregou */
  | { kind: "apr" }
  /** taxa medida no contrato indisponível: o card mostra estimativa */
  | { kind: "fees"; positions: number }
  | ({ protocol: string; chainId: number } & AdapterNotice);

/** Carteiras-lixeira acumulam dezenas de milhares de posições de spam
 * (achado da Fase 5: 0x…0001 tem 27.786). Resposta traz só as top N por
 * valor — os TOTAIS continuam calculados sobre todas. */
const MAX_POSITIONS_IN_RESPONSE = 200;

function human(raw: bigint, decimals: number): number {
  return Number(formatUnits(raw, decimals));
}

/** chave de preço multi-rede: o MESMO endereço pode existir em duas chains
 * (ex.: WETH é 0x4200…0006 na Base E na Optimism) → chave = chainId:endereço */
export function priceKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function priceOf(prices: Map<string, number>, chainId: number, address: string): number | null {
  const p = prices.get(priceKey(chainId, address));
  return p === undefined ? null : p;
}

/** Puro: posições normalizadas + preços → DTO. Testável offline. */
export function buildResponse(params: {
  address: string;
  normalized: LpPosition[];
  prices: Map<string, number>;
  scanMs: number;
  warnings: string[];
  notices?: ScanNotice[];
  maxPositions?: number;
  protocols?: string[];
  chains?: string[];
  yields?: YieldsIndex | null;
  /** janelas de feeGrowth por posição — fee APR medido no contrato
   *  (Receita G). Ausente = cai no apyBase da DefiLlama. */
  feeWindows?: FeeWindowsResult;
  /** locks veAERO/veVELO; ausente = nenhum */
  locks?: LockPosition[];
  /** relógio injetável: decide se um lock venceu (testes fixam o valor) */
  nowSec?: number;
}): PositionsResponseDTO {
  const {
    address,
    normalized,
    prices,
    scanMs,
    warnings,
    notices = [],
    maxPositions = MAX_POSITIONS_IN_RESPONSE,
    protocols = ["aerodrome"],
    chains = ["base"],
    yields = null,
    feeWindows,
    locks: locksRaw = [],
    nowSec = Math.floor(Date.now() / 1000),
  } = params;

  const positions: PositionDTO[] = normalized.map((p) => {
    const p0 = priceOf(prices, p.chainId, p.token0.address);
    const p1 = priceOf(prices, p.chainId, p.token1.address);
    const a0 = human(p.amount0Raw, p.token0.decimals);
    const a1 = human(p.amount1Raw, p.token1.decimals);
    const v0 = p0 !== null ? a0 * p0 : null;
    const v1 = p1 !== null ? a1 * p1 : null;
    const valueUsd = v0 !== null && v1 !== null ? v0 + v1 : null;

    const rewards: RewardDTO[] = p.rewards.map((r) => {
      const pr = priceOf(prices, p.chainId, r.token.address);
      const amt = human(r.raw, r.token.decimals);
      return {
        symbol: r.token.symbol,
        address: r.token.address,
        kind: r.kind,
        amountRaw: r.raw.toString(),
        amount: amt,
        priceUsd: pr,
        valueUsd: pr !== null ? amt * pr : null,
      };
    });
    const rewardsComplete = rewards.every((r) => r.valueUsd !== null);
    const rewardsUsd = rewardsComplete ? rewards.reduce((s, r) => s + (r.valueUsd ?? 0), 0) : null;

    let range: RangeDTO | null = null;
    if (p.range) {
      const o = orientRange(p.range.priceLower, p.range.priceUpper, p.range.priceCurrent);
      range = {
        inRange: p.range.inRange,
        inverted: o.inverted,
        lower: o.lower,
        upper: o.upper,
        current: o.current,
        quoteLabel: o.inverted
          ? `${p.token0.symbol}/${p.token1.symbol}`
          : `${p.token1.symbol}/${p.token0.symbol}`,
      };
    }

    // APR do POOL (DefiLlama) — casa uma vez; reusado no "rendendo agora"
    const m = yields
      ? yields.match({
          chainId: p.chainId,
          protocol: p.protocol,
          kind: p.kind,
          poolSymbol: p.poolSymbol,
          token0: p.token0.address,
          token1: p.token1.address,
        })
      : null;
    const apr: AprDTO | null = m
      ? { current: m.current, base: m.base, reward: m.reward, mean30d: m.mean30d, source: m.source }
      : null;

    // APR "rendendo agora" da POSIÇÃO (Receita C2) — só concentradas
    let earning: EarningDTO | null = null;
    if (p.range) {
      const ei = p.earningInputs;
      const emToken = ei?.emissionToken ?? null;
      // taxas medidas NO CONTRATO quando houver janela (Receita G)
      const chave = feeWindowKey(p);
      /* TODAS as janelas medidas viram linha na tela (24 h e 15 min). A mais
         LONGA alimenta os campos antigos do DTO: é a menos ruidosa, e é ela
         que responde "quanto isto rende", enquanto a curta responde "está
         quente agora?". */
      const janelas: EarningWindowDTO[] = [];
      for (const win of feeWindows?.byTarget.get(chave) ?? []) {
        const r = computeOnchainFeeApr({
          delta0: win.delta0,
          delta1: win.delta1,
          posLiquidity: ei?.liquidity ?? null,
          windowSec: win.windowSec,
          decimals0: p.token0.decimals,
          decimals1: p.token1.decimals,
          price0Usd: p0,
          price1Usd: p1,
          positionValueUsd: valueUsd,
        });
        if (r) janelas.push({ windowSec: r.windowSec, feePct: r.pct, feeUsd: r.feesUsd });
      }
      /* mais CURTA primeiro: é a ordem da tela, e é a que responde "está quente
         agora?". Os campos antigos do DTO seguem com a janela mais LONGA, que
         é a menos ruidosa — trocar isso deixaria `nowPct` pulando. */
      janelas.sort((a, b) => a.windowSec - b.windowSec);
      const onchainFeeAprPct = janelas.length > 0 ? janelas[janelas.length - 1].feePct : null;
      const base = computeEarning({
        inRange: p.range.inRange,
        onchainFeeAprPct,
        valueUsd,
        poolFeeAprPct: m?.base ?? null,
        poolTvlUsd: m?.tvlUsd ?? null,
        posLiquidity: ei?.liquidity ?? null,
        activeLiquidity: ei?.activeLiquidity ?? null,
        staked: p.staked,
        rewardRatePerSec: ei?.emissionRatePerSec ?? null,
        posStakedLiquidity: ei?.stakedLiquidity ?? null,
        poolStakedLiquidity: ei?.poolStakedLiquidity ?? null,
        emissionPriceUsd: emToken ? priceOf(prices, p.chainId, emToken.address) : null,
        emissionDecimals: emToken?.decimals ?? 18,
      });
      const tooNew = feeWindows?.tooNew.has(chave) ?? false;
      if (base) {
        earning = { ...base, windows: janelas, tooNew };
      } else if (tooNew) {
        /* Em range e sem número por ser nova demais: a tela precisa DIZER isso.
           Um vazio mudo foi exatamente a queixa que abriu esta frente. */
        earning = { nowPct: 0, feePct: null, emissionPct: null, windows: [], tooNew: true };
      }
    }

    return {
      protocol: p.protocol,
      chainId: p.chainId,
      poolAddress: p.poolAddress,
      poolSymbol: p.poolSymbol,
      kind: p.kind,
      positionId: p.positionId,
      staked: p.staked,
      managedByAlm: p.managedByAlm,
      token0: {
        symbol: p.token0.symbol,
        address: p.token0.address,
        decimals: p.token0.decimals,
        amountRaw: p.amount0Raw.toString(),
        amount: a0,
        priceUsd: p0,
        valueUsd: v0,
      },
      token1: {
        symbol: p.token1.symbol,
        address: p.token1.address,
        decimals: p.token1.decimals,
        amountRaw: p.amount1Raw.toString(),
        amount: a1,
        priceUsd: p1,
        valueUsd: v1,
      },
      rewards,
      valueUsd,
      rewardsUsd,
      range,
      apr,
      earning,
    };
  });

  const locks = buildLockDTOs(locksRaw, prices, nowSec);

  /* Recompensas somam ITEM A ITEM, não card a card: antes, um único token sem
     preço (AA, na Robinhood) zerava o card inteiro na soma do topo, e os
     US$ 50 em USDG ao lado dele sumiam calados. Agora o que tem preço entra,
     e o que não tem é contado à parte para a tela avisar. */
  const allRewards = [...positions.flatMap((p) => p.rewards), ...locks.flatMap((l) => l.rewards)];

  // totais sobre TODAS as posições, antes de qualquer corte
  const totals = {
    valueUsd: positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0),
    rewardsUsd: allRewards.reduce((s, r) => s + (r.valueUsd ?? 0), 0),
    positionsWithoutPrice: positions.filter((p) => p.valueUsd === null).length,
    rewardsWithoutPrice: allRewards.filter((r) => r.valueUsd === null).length,
    lockedUsd: locks.reduce((s, l) => s + (l.valueUsd ?? 0), 0),
  };

  // maiores valores primeiro; sem preço por último
  positions.sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1));

  return {
    address,
    chains,
    protocols,
    fetchedAt: new Date().toISOString(),
    scanMs,
    totals,
    totalPositions: positions.length,
    positions: positions.length > maxPositions ? positions.slice(0, maxPositions) : positions,
    locks,
    warnings,
    notices: dedupeNotices(notices),
  };
}

/** mesmo aviso repetido (dez leituras falhas do mesmo adapter) vira um só; e
 *  se o adapter caiu inteiro, o "faltou um pedaço" dele é redundante */
function dedupeNotices(list: ScanNotice[]): ScanNotice[] {
  const caiu = new Set(list.filter((n) => n.kind === "source").map((n) => `${n.protocol}@${n.chainId}`));
  const vistos = new Set<string>();
  return list.filter((n) => {
    if (n.kind === "partial" && caiu.has(`${n.protocol}@${n.chainId}`)) return false;
    const k = JSON.stringify(n);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** Locks crus + preços → DTO, maiores primeiro. PURO. */
export function buildLockDTOs(locks: LockPosition[], prices: Map<string, number>, nowSec: number): LockDTO[] {
  const out = locks.map((l): LockDTO => {
    const price = priceOf(prices, l.chainId, l.token.address);
    const amount = human(l.amountRaw, l.token.decimals);
    const rewards = l.rewards.map((r): LockRewardDTO => {
      const pr = priceOf(prices, l.chainId, r.token.address);
      const amt = human(r.raw, r.token.decimals);
      return { kind: r.kind, symbol: r.token.symbol, address: r.token.address, amount: amt, priceUsd: pr, valueUsd: pr !== null ? amt * pr : null };
    });
    return {
      protocol: l.protocol,
      chainId: l.chainId,
      lockId: l.lockId,
      token: { symbol: l.token.symbol, address: l.token.address, decimals: l.token.decimals, amount, priceUsd: price },
      valueUsd: price !== null ? amount * price : null,
      votingPower: human(l.votingPowerRaw, l.token.decimals),
      expiresAt: l.expiresAt,
      permanent: l.permanent,
      managedId: l.managedId,
      // lock permanente não vence; expiresAt 0 = sem data
      expired: !l.permanent && l.expiresAt > 0 && l.expiresAt <= nowSec,
      rewards,
      rewardsUsd: rewards.every((r) => r.valueUsd !== null) ? rewards.reduce((s, r) => s + (r.valueUsd ?? 0), 0) : null,
    };
  });
  return out.sort((a, b) => (b.valueUsd ?? -1) + (b.rewardsUsd ?? 0) - ((a.valueUsd ?? -1) + (a.rewardsUsd ?? 0)));
}

/**
 * Orquestração: roda TODOS os adapters do registry em paralelo, agrega,
 * busca preços e monta o DTO. Falha de um protocolo vira warning (resposta
 * parcial); só falha tudo se TODOS os protocolos falharem.
 */
export async function getWalletPositions(
  address: Address,
  adaptersOverride?: ProtocolAdapter[],
  /** fonte de preços; trocar de provedor não toca em mais nada (Receita H) */
  priceProvider: PriceProvider = defillamaPrices,
): Promise<PositionsResponseDTO> {
  const warnings: string[] = [];
  const notices: ScanNotice[] = [];
  const adapters =
    adaptersOverride ??
    buildAdapters({
      onWarn: (m, notice, src) => {
        warnings.push(m);
        if (notice === null) return; // só log interno
        const at = { protocol: src.protocol, chainId: src.chainId };
        notices.push(notice ? { ...at, ...notice } : { kind: "partial", ...at });
      },
    });

  const t0 = Date.now();
  // APR (DefiLlama) baixa em paralelo com a varredura on-chain; falha vira "—"
  const yieldsPromise = getYieldsIndex((m) => {
    warnings.push(m);
    notices.push({ kind: "apr" });
  });
  // locks correm JUNTO com as posições; adapter sem getLocks devolve vazio
  const [settled, settledLocks] = await Promise.all([
    Promise.allSettled(adapters.map((a) => a.getPositions(address))),
    Promise.allSettled(adapters.map((a) => (a.getLocks ? a.getLocks(address) : Promise.resolve([])))),
  ]);
  const scanMs = Date.now() - t0;

  // falha ao ler lock vira aviso — nunca derruba a resposta das posições
  const locks: LockPosition[] = [];
  settledLocks.forEach((r, i) => {
    if (r.status === "fulfilled") locks.push(...r.value);
    else {
      notices.push({ kind: "locks", protocol: adapters[i].protocol, chainId: adapters[i].chainId });
      warnings.push(
        `locks ${adapters[i].protocol}@${chainInfo(adapters[i].chainId).label} indisponíveis: ${(r.reason as Error)?.message?.split("\n")[0] ?? "erro"}`,
      );
    }
  });

  const normalized: LpPosition[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") normalized.push(...r.value);
    else {
      notices.push({ kind: "source", protocol: adapters[i].protocol, chainId: adapters[i].chainId });
      warnings.push(
        `${adapters[i].protocol}@${chainInfo(adapters[i].chainId).label} indisponível: ${(r.reason as Error)?.message?.split("\n")[0] ?? "erro"}`,
      );
    }
  });
  if (settled.length > 0 && settled.every((r) => r.status === "rejected")) {
    throw new Error(`todos os protocolos falharam: ${warnings.join(" | ")}`);
  }

  // preços por rede (o mesmo endereço pode existir em mais de uma chain)
  const byChain = new Map<number, Set<string>>();
  for (const p of normalized) {
    const set = byChain.get(p.chainId) ?? new Set<string>();
    set.add(p.token0.address);
    set.add(p.token1.address);
    for (const r of p.rewards) set.add(r.token.address);
    // token de emissão do gauge: pode não estar nos rewards (0 pendente) e é
    // necessário para o APR de emissões "rendendo agora"
    if (p.earningInputs?.emissionToken) set.add(p.earningInputs.emissionToken.address);
    byChain.set(p.chainId, set);
  }
  for (const l of locks) {
    const set = byChain.get(l.chainId) ?? new Set<string>();
    set.add(l.token.address);
    for (const r of l.rewards) set.add(r.token.address);
    byChain.set(l.chainId, set);
  }
  const prices = new Map<string, number>();
  await Promise.all(
    [...byChain.entries()].map(async ([chainId, addrs]) => {
      const slug = chainInfo(chainId).priceSlug;
      const chainPrices = await priceProvider.fetchUsdPrices(slug, [...addrs] as Address[], (m) => {
        warnings.push(m);
        notices.push({ kind: "prices" });
      });
      for (const [addr, price] of chainPrices) prices.set(priceKey(chainId, addr), price);
    }),
  );

  const feeWindows = await readFeeWindows(normalized, (m) => warnings.push(m));
  if (feeWindows.unmeasured > 0) notices.push({ kind: "fees", positions: feeWindows.unmeasured });

  return buildResponse({
    address,
    normalized,
    prices,
    scanMs,
    warnings,
    notices,
    protocols: [...new Set(adapters.map((a) => a.protocol))],
    chains: [...new Set(adapters.map((a) => chainInfo(a.chainId).priceSlug))],
    yields: await yieldsPromise,
    feeWindows,
    locks,
  });
}

/** teto de pools consultados por varredura — carteira-lixeira não pode
 *  transformar isto em centenas de chamadas de arquivo */
export const MAX_FEE_APR_POOLS = 40;

/**
 * Lê as janelas de feeGrowth dos pools concentrados (Receita G).
 *
 * NADA aqui pode derrubar a varredura: sem RPC com arquivo, o resultado é um
 * mapa vazio e o APR volta a sair da DefiLlama. Por isso tudo está dentro de
 * try/catch e o teto acima existe.
 */
/**
 * Chave da janela de fee APR. É POR FAIXA, não por pool: a medição depende dos
 * ticks da posição (Receita G v2), e duas posições na mesma faixa do mesmo
 * pool compartilham o mesmo resultado.
 */
function feeWindowKey(p: LpPosition): string {
  return `${p.chainId}:${p.poolAddress.toLowerCase()}:${p.range?.tickLower ?? ""}:${p.range?.tickUpper ?? ""}`;
}

async function readFeeWindows(
  positions: LpPosition[],
  onWarn: (msg: string) => void,
): Promise<FeeWindowsResult> {
  const out: FeeWindowsResult = { byTarget: new Map(), tooNew: new Set(), unmeasured: 0 };
  const porRede = new Map<number, FeeWindowTarget[]>();

  for (const p of positions) {
    if (p.kind !== "concentrated" || !p.range?.inRange) continue; // fora do range rende 0, não precisa medir
    /* Protocolo sem layout de pool conhecido não é "dado faltando", é pergunta
       sem sentido — o Uniswap v4 não tem contrato de pool (o `poolAddress` é o
       singleton PoolManager), então medir ali sempre revertia e gerava um
       aviso alarmante na tela por um caso perfeitamente normal. */
    if (!poolLayout(p.protocol)) continue;

    const alvos = porRede.get(p.chainId) ?? [];
    const key = feeWindowKey(p);
    if (!alvos.some((a) => a.key === key)) {
      alvos.push({
        key,
        protocol: p.protocol,
        pool: p.poolAddress,
        tickLower: p.range.tickLower,
        tickUpper: p.range.tickUpper,
        inside0Last: p.earningInputs?.feeGrowthInside0LastX128 ?? null,
      });
    }
    porRede.set(p.chainId, alvos);
  }
  if (porRede.size === 0) return out;

  let orcamento = MAX_FEE_APR_POOLS;
  await Promise.all(
    [...porRede.entries()].map(async ([chainId, alvos]) => {
      const info = chainInfo(chainId);
      try {
        const reader = createReader(chainId);
        const bloco = await reader.getBlockNumber?.();
        if (bloco === undefined) return;
        const fatia = alvos.slice(0, Math.max(0, orcamento));
        orcamento -= fatia.length;
        const r = await readPositionFeeWindows(reader, fatia, bloco, info.secPerBlock, onWarn);
        for (const [k, v] of r.byTarget) out.byTarget.set(k, v);
        for (const k of r.tooNew) out.tooNew.add(k);
        // os que passaram do teto também ficam na estimativa
        out.unmeasured += r.unmeasured + (alvos.length - fatia.length);
      } catch (e) {
        out.unmeasured += alvos.length;
        onWarn(`fee APR on-chain indisponível em ${info.label}: ${(e as Error).message.split("\n")[0].slice(0, 60)}`);
      }
    }),
  );
  return out;
}
