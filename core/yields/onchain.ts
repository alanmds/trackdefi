/**
 * Fee APR da POSIÇÃO medido no próprio contrato — sem DefiLlama (Receita G).
 *
 * Decisão do Alan em 02/08/2026: sair da dependência para o APR. O motivo está
 * medido, não é gosto — o dataset grátis da DefiLlama não traz endereço de
 * pool, então o casamento é por par de tokens + tick spacing (9 candidatos
 * medidos para WETH/USDC na Base), o `apyReward` já apareceu como 6012% num
 * pool CL1, há linhas duplicadas mortas, e não há cobertura nenhuma de
 * Uniswap v3 na Robinhood Chain (reconferido em 15/09/2026: ZERO linhas).
 *
 * ===================== v2 (15/09/2026) — feeGrowth INSIDE ===================
 * A v1 usava `feeGrowthGlobal × L`, que atribui à posição as taxas do pool
 * INTEIRO — inclusive as geradas enquanto o preço estava FORA da faixa dela.
 * Numa faixa estreita isso infla sem limite: a posição USDG/HIMS (RWA) na
 * Robinhood marcou 971,94% em produção, com o teto de sanidade em 1.000% — e
 * quando o número passava do teto o site não mostrava APR NENHUM.
 *
 * A conta certa é a que o próprio pool usa para pagar a posição:
 *
 *   feeGrowthInside = fgGlobal − fgOutside(lower) − fgOutside(upper)
 *     (cada lado invertido conforme o tick corrente, aritmética mod 2^256)
 *   taxas_da_posição = Δ feeGrowthInside × L ÷ 2^128
 *
 * Medido no PoC `poc/probe-fee-inside.ts`: 971% pelo método velho contra 265%
 * pelo novo, na MESMA janela de 24 h da mesma posição.
 *
 * PROPRIEDADE QUE PROTEGE O QUE JÁ FUNCIONAVA: se o preço não cruzou nenhum
 * dos dois ticks da faixa durante a janela, `feeGrowthOutside` dos dois não
 * muda e Δinside == Δglobal — o número novo é IDÊNTICO ao velho onde a
 * premissa do velho valia (medido: razão 1.000 nas janelas de 1 h e 6 h). Só
 * corrige onde ela falhava (razão 0,273 na de 24 h, quando o preço saiu da
 * faixa). Ou seja: a calibração de 02/08 na Base continua de pé.
 *
 * JANELA x IDADE DA POSIÇÃO. Medir 24 h de uma posição aberta há 40 minutos
 * também infla — e isso não é caso raro, é o normal de quem acabou de abrir
 * (a posição RWA da Robinhood nem existia 1 h antes, provado no
 * `poc/probe-ticks-layout.ts`). Por isso a janela é escolhida POR POSIÇÃO,
 * descendo a escada 24 h → 6 h → 1 h → 15 min até caber na vida dela. O teste
 * de validade não custa chamada nenhuma e é à prova de wrap:
 *
 *   taxas desde o último toque  >=  taxas da janela
 *   wrapSub(inside_agora, inside_last) >= wrapSub(inside_agora, inside_antes)
 *
 * `inside_last` é o `feeGrowthInside0LastX128` que o NFPM grava na posição a
 * cada mint/collect/modify. Se ele não cobrir a janela, a posição nasceu (ou
 * mudou de L) DENTRO dela e a medição atribuiria taxas que não são suas.
 *
 * LAYOUT DO POOL É POR PROTOCOLO — provado on-chain em 15/09/2026
 * (`poc/probe-ticks-aero.ts`), não é suposição: o Slipstream (Aerodrome/
 * Velodrome) insere campos no `ticks()` e tira um do `slot0()`. Decodificar um
 * pool da Aerodrome com a ABI da Uniswap às vezes nem dá erro — devolve
 * `stakedLiquidityNet` no lugar de `feeGrowthOutside0X128`, ou seja, número
 * errado EM SILÊNCIO. Por isso o layout é explícito aqui.
 *
 * LIMITES (por que o resultado pode ser null)
 * - Exige RPC com ARQUIVO. Sem chave, o RPC público recusa estado histórico —
 *   a falha vira "sem dado", nunca número inventado.
 * - Aerodrome/Velodrome não expõem `feeGrowthInside0Last` (as posições vêm do
 *   Sugar) → nelas a janela não é validada contra a idade, como na v1.
 * - Preço ainda vem do PriceProvider (a Receita H trata disso).
 */

import { parseAbi, type Address } from "viem";
import type { ChainReader } from "../types";

const MOD256 = 2n ** 256n;
const Q128 = 2n ** 128n;
const YEAR_SEC = 365 * 24 * 3600;

/**
 * Subtração de uint256 COM WRAP — é assim que o Solidity acumula feeGrowth
 * (unchecked). Consequência prática: comparar dois feeGrowth com `<` é errado;
 * comparar DIFERENÇAS entre eles é certo.
 */
export function wrapSub(a: bigint, b: bigint): bigint {
  return (((a - b) % MOD256) + MOD256) % MOD256;
}

/** janela longa: dilui o ruído do fluxo de swaps sem exigir arquivo profundo. */
export const DEFAULT_WINDOW_HOURS = 24;

/**
 * As janelas que a tela mostra, da mais longa para a mais curta — TODAS as que
 * couberem na vida da posição são medidas, não só uma.
 *
 * Decisão do Alan em 15/09/2026, atendendo o perfil que opera no dia: com as
 * duas lado a lado o número deixa de mudar de significado em silêncio, e a
 * comparação entre elas vira SINAL — 15 min muito acima de 24 h é pool quente
 * agora; muito abaixo é movimento que já passou.
 */
export const MEASURED_WINDOWS_HOURS = [DEFAULT_WINDOW_HOURS, 0.25];

/**
 * Barreira de ABSURDO ARITMÉTICO — não é juízo de plausibilidade.
 *
 * O teto antigo (1.000% a.a.) julgava se o rendimento era "crível" e, com a
 * conta já corrigida, só escondia verdade: nos pools de RWA da Robinhood a
 * própria DefiLlama reporta 70–800% em pools vizinhos. Saiu.
 *
 * O que ficou existe para UM caso: leitura corrompida do RPC. Como os
 * acumuladores andam em aritmética mod 2^256, uma leitura inconsistente não
 * produz número "alto", produz 10^68 — e sem barreira o card exibiria
 * `Earning now 4,2e+70%`. Nenhum rendimento real deste mundo encosta aqui.
 */
export const ABSURD_APR_PCT = 100_000;

export const poolFeeGrowthAbi = parseAbi([
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
]);

// ------------------------------------------------ layout do pool, por protocolo

/** Onde cada número mora no retorno do pool. Ver PoC `probe-ticks-aero.ts`. */
export interface PoolLayout {
  slot0Abi: unknown;
  ticksAbi: unknown;
  /** índice de feeGrowthOutside0X128 no retorno de `ticks()` */
  fg0: number;
  fg1: number;
}

const UNISWAP_LAYOUT: PoolLayout = {
  slot0Abi: parseAbi([
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  ]),
  ticksAbi: parseAbi([
    "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
  ]),
  fg0: 2,
  fg1: 3,
};

/** Slipstream = fork da v3 com `stakedLiquidityNet` e `rewardGrowthOutsideX128`
 *  a mais no `ticks()`, e `slot0()` sem `feeProtocol`. */
const SLIPSTREAM_LAYOUT: PoolLayout = {
  slot0Abi: parseAbi([
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
  ]),
  ticksAbi: parseAbi([
    "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, int128 stakedLiquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, uint256 rewardGrowthOutsideX128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
  ]),
  fg0: 3,
  fg1: 4,
};

const LAYOUTS: Record<string, PoolLayout> = {
  "uniswap-v3": UNISWAP_LAYOUT,
  aerodrome: SLIPSTREAM_LAYOUT,
  velodrome: SLIPSTREAM_LAYOUT,
};

/**
 * null = protocolo cujo `poolAddress` não é um pool no estilo v3, ou cujo
 * layout ainda não foi PROVADO on-chain. Medir ali não é "dado faltando", é
 * pergunta sem sentido — o chamador pula, sem aviso alarmante na tela.
 * (Uniswap v4: o `poolAddress` é o singleton PoolManager, que não tem
 * `feeGrowthGlobal0X128` nenhum.)
 */
export function poolLayout(protocol: string): PoolLayout | null {
  return LAYOUTS[protocol] ?? null;
}

// ------------------------------------------------------------ a matemática (pura)

/** Os seis acumuladores que descrevem uma faixa num instante. */
export interface TickSnapshot {
  tick: number;
  global0: bigint;
  global1: bigint;
  outLower0: bigint;
  outLower1: bigint;
  outUpper0: bigint;
  outUpper1: bigint;
}

/**
 * `feeGrowthInside` do par (0,1) — a MESMA fórmula do Uniswap v3 `Pool.sol`.
 * PURA e testável.
 */
export function feeGrowthInside(s: TickSnapshot, tickLower: number, tickUpper: number): [bigint, bigint] {
  const below0 = s.tick >= tickLower ? s.outLower0 : wrapSub(s.global0, s.outLower0);
  const below1 = s.tick >= tickLower ? s.outLower1 : wrapSub(s.global1, s.outLower1);
  const above0 = s.tick < tickUpper ? s.outUpper0 : wrapSub(s.global0, s.outUpper0);
  const above1 = s.tick < tickUpper ? s.outUpper1 : wrapSub(s.global1, s.outUpper1);
  return [wrapSub(wrapSub(s.global0, below0), above0), wrapSub(wrapSub(s.global1, below1), above1)];
}

/**
 * A janela [passado, agora] cabe na vida da posição? PURA.
 *
 * As taxas acumuladas desde o último toque precisam COBRIR a janela inteira.
 * `inside0Last === null` (protocolo não expõe o dado) = não dá para negar,
 * então aceita — é o comportamento da v1.
 */
export function windowFitsPosition(insideNow0: bigint, insidePast0: bigint, inside0Last: bigint | null): boolean {
  if (inside0Last === null) return true;
  return wrapSub(insideNow0, inside0Last) >= wrapSub(insideNow0, insidePast0);
}

export interface OnchainFeeInputs {
  /** Δ feeGrowthInside0X128 na janela (agora − passado) */
  delta0: bigint;
  delta1: bigint;
  /** L da posição (liquidez crua), incluindo a parcela em stake */
  posLiquidity: bigint | null;
  /** duração real da janela, em segundos */
  windowSec: number;
  decimals0: number;
  decimals1: number;
  price0Usd: number | null;
  price1Usd: number | null;
  /** valor da posição em US$ — denominador do APR */
  positionValueUsd: number | null;
}

export interface OnchainFeeResult {
  /** % ao ano */
  pct: number;
  /** taxas que a posição ganhou DENTRO da janela, em US$ — é este número que
   *  dá escala ao percentual: "3.504%/yr" e "US$ 0,21" dizem coisas diferentes */
  feesUsd: number;
  /** duração real da janela medida, em segundos */
  windowSec: number;
}

/**
 * PURO e testável: dados os deltas, devolve o rendimento de taxas da posição.
 * null = não dá para afirmar nada com honestidade.
 */
export function computeOnchainFeeApr(i: OnchainFeeInputs): OnchainFeeResult | null {
  if (
    i.posLiquidity === null ||
    i.posLiquidity <= 0n ||
    i.positionValueUsd === null ||
    i.positionValueUsd <= 0 ||
    i.price0Usd === null ||
    i.price1Usd === null ||
    i.windowSec <= 0 ||
    i.delta0 < 0n ||
    i.delta1 < 0n
  ) {
    return null;
  }

  // acumulador só cresce; delta negativo seria leitura inconsistente (já barrado)
  const raw0 = (i.delta0 * i.posLiquidity) / Q128;
  const raw1 = (i.delta1 * i.posLiquidity) / Q128;
  const feesUsd = (Number(raw0) / 10 ** i.decimals0) * i.price0Usd + (Number(raw1) / 10 ** i.decimals1) * i.price1Usd;
  if (!Number.isFinite(feesUsd) || feesUsd < 0) return null;

  const pct = ((feesUsd / i.windowSec) * YEAR_SEC * 100) / i.positionValueUsd;
  if (!Number.isFinite(pct) || pct < 0 || pct > ABSURD_APR_PCT) return null;
  return { pct, feesUsd, windowSec: i.windowSec };
}

// -------------------------------------------------------------- leitura on-chain

export interface FeeGrowthWindow {
  delta0: bigint;
  delta1: bigint;
  windowSec: number;
}

/** Uma faixa a medir. Duas posições na mesma faixa do mesmo pool = um alvo só. */
export interface FeeWindowTarget {
  /** chave com que o chamador reencontra o resultado */
  key: string;
  protocol: string;
  pool: Address;
  tickLower: number;
  tickUpper: number;
  /** feeGrowthInside0LastX128 da posição; null = protocolo não expõe */
  inside0Last: bigint | null;
}

/**
 * Lê os 6 acumuladores de cada alvo num bloco (ou no atual, se `blockNumber`
 * for undefined). UM multicall só. Lança se o RPC recusar o bloco.
 */
async function readSnapshots(
  reader: ChainReader,
  targets: FeeWindowTarget[],
  blockNumber?: bigint,
): Promise<Map<string, TickSnapshot>> {
  // globals e slot0 são POR POOL; ticks são por faixa
  const pools = new Map<string, { pool: Address; layout: PoolLayout }>();
  for (const t of targets) {
    const layout = poolLayout(t.protocol);
    if (layout) pools.set(t.pool.toLowerCase(), { pool: t.pool, layout });
  }
  const poolList = [...pools.values()];
  const poolIndex = new Map([...pools.keys()].map((k, i) => [k, i] as const));

  const contracts = [
    ...poolList.flatMap((p) => [
      { address: p.pool, abi: poolFeeGrowthAbi, functionName: "feeGrowthGlobal0X128" },
      { address: p.pool, abi: poolFeeGrowthAbi, functionName: "feeGrowthGlobal1X128" },
      { address: p.pool, abi: p.layout.slot0Abi, functionName: "slot0" },
    ]),
    ...targets.flatMap((t) => {
      const layout = poolLayout(t.protocol);
      if (!layout) return [];
      return [
        { address: t.pool, abi: layout.ticksAbi, functionName: "ticks", args: [t.tickLower] },
        { address: t.pool, abi: layout.ticksAbi, functionName: "ticks", args: [t.tickUpper] },
      ];
    }),
  ];

  const res = await reader.multicall({
    contracts,
    allowFailure: true,
    ...(blockNumber === undefined ? {} : { blockNumber }),
  });

  const out = new Map<string, TickSnapshot>();
  const poolBase = poolList.length * 3;
  targets.forEach((t, i) => {
    const layout = poolLayout(t.protocol);
    const pi = poolIndex.get(t.pool.toLowerCase());
    if (!layout || pi === undefined) return;
    const g0 = res[pi * 3];
    const g1 = res[pi * 3 + 1];
    const slot0 = res[pi * 3 + 2];
    const tl = res[poolBase + i * 2];
    const tu = res[poolBase + i * 2 + 1];
    if ([g0, g1, slot0, tl, tu].some((r) => r === undefined || r.status !== "success")) return;
    const lower = tl.result as readonly unknown[];
    const upper = tu.result as readonly unknown[];
    out.set(t.key, {
      tick: Number((slot0.result as readonly unknown[])[1]),
      global0: g0.result as bigint,
      global1: g1.result as bigint,
      outLower0: lower[layout.fg0] as bigint,
      outLower1: lower[layout.fg1] as bigint,
      outUpper0: upper[layout.fg0] as bigint,
      outUpper1: upper[layout.fg1] as bigint,
    });
  });
  return out;
}

export interface FeeWindowsResult {
  /** janelas medidas por alvo — só as que couberam na vida da posição */
  byTarget: Map<string, FeeGrowthWindow[]>;
  /**
   * Alvos recusados por IDADE em todas as janelas: a posição é mais nova que
   * a menor delas. Diferente de "não consegui ler" — a tela diz ao usuário
   * que a medição começa em alguns minutos, em vez de deixar um vazio mudo.
   */
  tooNew: Set<string>;
}

/**
 * Mede TODAS as janelas de `MEASURED_WINDOWS_HOURS` para cada posição.
 *
 * Devolve só o que dá para afirmar: janela que não cabe na vida da posição
 * não entra (viraria taxa de antes de ela existir), e alvo que o RPC não
 * serviu simplesmente não aparece. `onWarn` recebe o motivo, separando
 * "posição nova" de "RPC sem arquivo" — misturar os dois vira aviso que mente.
 */
export async function readPositionFeeWindows(
  reader: ChainReader,
  targets: FeeWindowTarget[],
  currentBlock: bigint,
  secPerBlock: number,
  onWarn: (msg: string) => void = () => {},
): Promise<FeeWindowsResult> {
  const byTarget = new Map<string, FeeGrowthWindow[]>();
  const tooNew = new Set<string>();
  if (targets.length === 0) return { byTarget, tooNew };

  let agora: Map<string, TickSnapshot>;
  try {
    agora = await readSnapshots(reader, targets);
  } catch (e) {
    onWarn(`fee APR on-chain indisponível (leitura do pool falhou): ${(e as Error).message.split("\n")[0].slice(0, 60)}`);
    return { byTarget, tooNew };
  }

  const legiveis = targets.filter((t) => agora.has(t.key));
  const recusadaPorIdade = new Set<string>();
  let falhasDeLeitura = 0;

  for (const horas of MEASURED_WINDOWS_HOURS) {
    const blocos = BigInt(Math.max(1, Math.round((horas * 3600) / secPerBlock)));
    if (currentBlock <= blocos) continue; // rede jovem demais para esta janela

    let antes: Map<string, TickSnapshot>;
    try {
      antes = await readSnapshots(reader, legiveis, currentBlock - blocos);
    } catch {
      /* Uma janela pode falhar e a outra passar: um nó podado guarda poucos
         blocos, o que às vezes cobre 15 min e nunca cobre 24 h. Por isso cada
         janela é tentada por si, sem abortar as outras. */
      falhasDeLeitura++;
      continue;
    }

    for (const t of legiveis) {
      const a = agora.get(t.key)!;
      const b = antes.get(t.key);
      if (!b) continue;
      const [i0n, i1n] = feeGrowthInside(a, t.tickLower, t.tickUpper);
      const [i0o, i1o] = feeGrowthInside(b, t.tickLower, t.tickUpper);
      if (!windowFitsPosition(i0n, i0o, t.inside0Last)) {
        recusadaPorIdade.add(t.key); // posição mais nova que ESTA janela
        continue;
      }
      const lista = byTarget.get(t.key) ?? [];
      lista.push({
        delta0: wrapSub(i0n, i0o),
        delta1: wrapSub(i1n, i1o),
        windowSec: Number(blocos) * secPerBlock,
      });
      byTarget.set(t.key, lista);
    }
  }

  for (const t of legiveis) {
    if (!byTarget.has(t.key) && recusadaPorIdade.has(t.key)) tooNew.add(t.key);
  }
  const semNada = legiveis.filter((t) => !byTarget.has(t.key) && !tooNew.has(t.key)).length;
  if (tooNew.size > 0) {
    onWarn(`${tooNew.size} posição(ões) recém-aberta(s) — o fee APR aparece depois de alguns minutos de vida`);
  }
  if (semNada > 0 || (falhasDeLeitura > 0 && byTarget.size === 0)) {
    onWarn(`fee APR on-chain indisponível em ${semNada || legiveis.length} pool(s) — o RPC não devolveu o estado passado`);
  }
  return { byTarget, tooNew };
}
