/**
 * Adapter Orca Whirlpools (Solana) — a primeira rede não-EVM do site.
 *
 * PoC: poc/solana/orca-positions.mjs (26/09/2026, refeito em 14/10/2026 com
 * posição dentro e fora da faixa). Achados em poc/solana/NOTAS.md.
 *
 * Programa oficial (github.com/orca-so/whirlpools):
 *   whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc — o SDK usa este por padrão.
 *
 * Estratégia:
 * - Enumeração pelo SDK oficial (`fetchPositionsForOwner`): acha os NFTs de
 *   posição nos dois programas de token (clássico e Token-2022) e dentro de
 *   bundles. Nenhuma varredura de pool.
 * - Quantidades, taxas e recompensas pela matemática do SDK (wasm, o mesmo
 *   código Rust do programa) — não reimplementamos nada aqui.
 * - Casas decimais e símbolo lidos no próprio mint (Token-2022 com metadado
 *   embutido) ou na conta de metadado da Metaplex. Sem símbolo, o começo do
 *   mint — nunca um nome inventado.
 * - A Orca não tem gauge nem stake: `staked` sempre false. As "rewards" do
 *   pool (até 3 tokens) entram como emissão a receber.
 * - "Earning now" sai só como ESTIMATIVA (APR do pool na DefiLlama × fatia da
 *   liquidez ativa): a medição em janela (24 h / 15 min) das redes EVM não
 *   existe pronta na Solana. Decisão do Alan, 14/10/2026.
 *
 * Endereços aqui são base58. O tipo `Address` do core é o do viem (0x…);
 * eles passam por ele com cast — o core só os usa como texto (chave de
 * preço, DTO, link do explorer). Ver `core/address.ts`.
 */

import type { Address as EvmAddress } from "viem";
import { address as solAddress, getAddressEncoder, getProgramDerivedAddress, type Address } from "@solana/kit";
import { fetchPositionsForOwner } from "@orca-so/whirlpools";
import {
  fetchAllMaybeTickArray,
  fetchAllMaybeWhirlpool,
  getTickArrayAddress,
  type Position,
  type Tick,
  type Whirlpool,
} from "@orca-so/whirlpools-client";
import {
  collectFeesQuote,
  collectRewardsQuote,
  decreaseLiquidityQuote,
  getTickArrayStartTickIndex,
  getTickIndexInArray,
  sqrtPriceToPrice,
  tickIndexToPrice,
} from "@orca-so/whirlpools-core";
import { SOLANA_CHAIN_ID } from "../../chains";
import type { SolanaReader } from "../../solana";
import type { LpPosition, ProtocolAdapter, RewardAmount, TokenInfo, WarnSink } from "../../types";
import { chunks } from "../../util";
import { cleanSymbol } from "../aerodrome/index";

/** slot de recompensa vazio no pool */
const EMPTY = "11111111111111111111111111111111";
const METAPLEX = solAddress("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
/** getMultipleAccounts aceita no máximo 100 contas por chamada */
const BATCH = 100;
/** carteira-lixeira não pode virar centenas de leituras */
export const MAX_ORCA_POSITIONS = 200;

const asCore = (a: string) => a as EvmAddress;

/** lê uma string borsh (u32 LE de tamanho + bytes), sem os \0 de preenchimento */
function borshString(buf: Uint8Array, at: number): { value: string; next: number } | null {
  if (at + 4 > buf.length) return null;
  const len = buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16) | (buf[at + 3] << 24);
  if (len < 0 || at + 4 + len > buf.length) return null;
  const value = new TextDecoder().decode(buf.subarray(at + 4, at + 4 + len)).replace(/\0/g, "");
  return { value, next: at + 4 + len };
}

/** símbolo na conta de metadado da Metaplex: key(1) + autoridade(32) + mint(32) + name + symbol */
export function metaplexSymbol(data: Uint8Array): string | null {
  const name = borshString(data, 65);
  if (!name) return null;
  return borshString(data, name.next)?.value.trim() || null;
}

/**
 * Símbolo embutido num mint Token-2022 (extensão TokenMetadata, tipo 19).
 * Layout: mint base (82 bytes) preenchido até 165 + 1 byte de tipo de conta,
 * depois TLV [tipo u16][tamanho u16][dado].
 */
export function token2022Symbol(data: Uint8Array): string | null {
  let at = 166;
  while (at + 4 <= data.length) {
    const type = data[at] | (data[at + 1] << 8);
    const len = data[at + 2] | (data[at + 3] << 8);
    const body = at + 4;
    if (type === 19) {
      const name = borshString(data, body + 64);
      if (!name) return null;
      return borshString(data, name.next)?.value.trim() || null;
    }
    if (type === 0 && len === 0) return null;
    at = body + len;
  }
  return null;
}

/** decimais do mint: byte 44 no layout de Mint, igual nos dois programas */
export function mintDecimals(data: Uint8Array): number | null {
  return data.length > 44 ? data[44] : null;
}

/** "SOL/USDC 0.04%" — o feeRate da Orca é em centésimos de bp (400 = 0,04%) */
export function orcaPoolSymbol(symA: string, symB: string, feeRate: number): string {
  return `${symA}/${symB} ${Number((feeRate / 10_000).toFixed(4))}%`;
}

/** posição + pool + ticks das pontas → LpPosition. PURO (testável offline). */
export function toLpPosition(args: {
  position: Position;
  whirlpool: Whirlpool;
  poolAddress: string;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  rewardTokens: (TokenInfo | null)[];
  tickLower: Tick | null;
  tickUpper: Tick | null;
  nowSec: bigint;
  /** saldo dos cofres A e B do pool; ausente = não lido */
  reserves?: { amount0Raw: bigint; amount1Raw: bigint };
}): LpPosition {
  const { position: p, whirlpool: w, tokenA, tokenB } = args;
  const q = decreaseLiquidityQuote(p.liquidity, 0, w.sqrtPrice, p.tickLowerIndex, p.tickUpperIndex);

  const rewards: RewardAmount[] = [];
  if (args.tickLower && args.tickUpper) {
    const fees = collectFeesQuote(w, p, args.tickLower, args.tickUpper);
    if (fees.feeOwedA > 0n) rewards.push({ token: tokenA, raw: fees.feeOwedA, kind: "fee" });
    if (fees.feeOwedB > 0n) rewards.push({ token: tokenB, raw: fees.feeOwedB, kind: "fee" });
    const recs = collectRewardsQuote(w, p, args.tickLower, args.tickUpper, args.nowSec);
    args.rewardTokens.forEach((token, i) => {
      const raw = recs.rewards[i]?.rewardsOwed ?? 0n;
      if (token && raw > 0n) rewards.push({ token, raw, kind: "emission" });
    });
  }

  const tickCurrent = w.tickCurrentIndex;
  return {
    protocol: "orca",
    chainId: SOLANA_CHAIN_ID,
    poolAddress: asCore(args.poolAddress),
    poolSymbol: orcaPoolSymbol(tokenA.symbol, tokenB.symbol, w.feeRate),
    kind: "concentrated",
    positionId: p.positionMint,
    staked: false,
    managedByAlm: null,
    token0: tokenA,
    token1: tokenB,
    amount0Raw: q.tokenEstA,
    amount1Raw: q.tokenEstB,
    rewards,
    range: {
      tickLower: p.tickLowerIndex,
      tickUpper: p.tickUpperIndex,
      tickCurrent,
      inRange: tickCurrent >= p.tickLowerIndex && tickCurrent < p.tickUpperIndex,
      // token B por 1 token A = token1 por token0, a mesma orientação do core
      priceLower: tickIndexToPrice(p.tickLowerIndex, tokenA.decimals, tokenB.decimals),
      priceUpper: tickIndexToPrice(p.tickUpperIndex, tokenA.decimals, tokenB.decimals),
      priceCurrent: sqrtPriceToPrice(w.sqrtPrice, tokenA.decimals, tokenB.decimals),
    },
    // só o insumo da ESTIMATIVA (fatia da liquidez ativa); o resto não existe aqui
    earningInputs: {
      liquidity: p.liquidity,
      activeLiquidity: w.liquidity,
      stakedLiquidity: null,
      poolStakedLiquidity: null,
      emissionRatePerSec: null,
      emissionToken: null,
      feeGrowthInside0LastX128: null,
    },
    ...(args.reserves ? { poolReserves: args.reserves } : {}),
  };
}

/** saldo de uma conta de token (u64 LE no byte 64, igual nos dois programas) */
export function tokenAccountAmount(data: Uint8Array): bigint | null {
  if (data.length < 72) return null;
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(data[64 + i]);
  return v;
}

export interface OrcaOptions {
  onWarn?: WarnSink;
  maxPositions?: number;
}

export class OrcaAdapter implements ProtocolAdapter {
  readonly protocol = "orca";
  readonly chainId = SOLANA_CHAIN_ID;
  readonly addressKind = "solana" as const;
  private readonly warn: WarnSink;
  private readonly maxPositions: number;

  constructor(
    private readonly rpc: SolanaReader,
    opts: OrcaOptions = {},
  ) {
    this.warn = opts.onWarn ?? (() => {});
    this.maxPositions = opts.maxPositions ?? MAX_ORCA_POSITIONS;
  }

  async getPositions(account: string): Promise<LpPosition[]> {
    const owner = solAddress(account);
    const raw = await fetchPositionsForOwner(this.rpc, owner);
    let positions: Position[] = raw.flatMap((p) => (p.isPositionBundle ? p.positions : [p])).map((p) => p.data);
    if (positions.length === 0) return [];
    if (positions.length > this.maxPositions) {
      this.warn(`orca: carteira tem ${positions.length} posições; lendo só ${this.maxPositions}`, {
        kind: "capped",
        checked: this.maxPositions,
      });
      positions = positions.slice(0, this.maxPositions);
    }

    // pools
    const poolAddrs = [...new Set(positions.map((p) => p.whirlpool))];
    const pools = new Map<string, Whirlpool>();
    for (const group of chunks(poolAddrs, BATCH)) {
      for (const acc of await fetchAllMaybeWhirlpool(this.rpc, group)) {
        if (acc.exists) pools.set(acc.address, acc.data);
      }
    }

    // tokens (dos pares e das recompensas)
    const mints = new Set<Address>();
    for (const w of pools.values()) {
      mints.add(w.tokenMintA);
      mints.add(w.tokenMintB);
      for (const r of w.rewardInfos) if (r.mint !== EMPTY) mints.add(r.mint);
    }
    const tokens = await this.loadTokens([...mints]);

    // ticks das pontas — necessários para taxas e recompensas a receber
    const ticks = await this.loadTicks(positions, pools);

    // cofres dos pools: o TVL deles é o que identifica o pool no dataset de APR
    const reserves = new Map<string, { amount0Raw: bigint; amount1Raw: bigint }>();
    try {
      const lista = [...pools.entries()];
      const dados = await this.accountsData(lista.flatMap(([, w]) => [w.tokenVaultA, w.tokenVaultB]));
      lista.forEach(([addr], i) => {
        const a = dados[2 * i] && tokenAccountAmount(dados[2 * i]!);
        const b = dados[2 * i + 1] && tokenAccountAmount(dados[2 * i + 1]!);
        if (typeof a === "bigint" && typeof b === "bigint") reserves.set(addr, { amount0Raw: a, amount1Raw: b });
      });
    } catch (e) {
      // sem cofres o APR do pool sai "—"; a posição em si não depende disso
      this.warn(`orca: cofres dos pools não lidos (${(e as Error).message.split("\n")[0]}) — APR do pool "—"`, null);
    }

    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const out: LpPosition[] = [];
    let semTick = 0;
    for (const p of positions) {
      const w = pools.get(p.whirlpool);
      const tokenA = w && tokens.get(w.tokenMintA);
      const tokenB = w && tokens.get(w.tokenMintB);
      if (!w || !tokenA || !tokenB) {
        this.warn(`orca: pool ${p.whirlpool} ou seus tokens não puderam ser lidos — posição omitida`);
        continue;
      }
      const tickLower = ticks.get(`${p.whirlpool}:${p.tickLowerIndex}`) ?? null;
      const tickUpper = ticks.get(`${p.whirlpool}:${p.tickUpperIndex}`) ?? null;
      if (!tickLower || !tickUpper) semTick++;
      out.push(
        toLpPosition({
          position: p,
          whirlpool: w,
          poolAddress: p.whirlpool,
          tokenA,
          tokenB,
          rewardTokens: w.rewardInfos.map((r) => (r.mint === EMPTY ? null : (tokens.get(r.mint) ?? null))),
          tickLower,
          tickUpper,
          nowSec,
          reserves: reserves.get(p.whirlpool),
        }),
      );
    }
    if (semTick > 0) this.warn(`orca: ticks de ${semTick} posição(ões) não lidos — taxas a receber ausentes`);
    return out;
  }

  private async loadTokens(mints: Address[]): Promise<Map<string, TokenInfo>> {
    const out = new Map<string, TokenInfo>();
    if (mints.length === 0) return out;
    const enc = getAddressEncoder();
    const metaPdas = await Promise.all(
      mints.map(async (m) => {
        const [pda] = await getProgramDerivedAddress({
          programAddress: METAPLEX,
          seeds: ["metadata", enc.encode(METAPLEX), enc.encode(m)],
        });
        return pda;
      }),
    );
    const mintData = await this.accountsData(mints);
    const metaData = await this.accountsData(metaPdas);
    mints.forEach((m, i) => {
      const data = mintData[i];
      const decimals = data ? mintDecimals(data) : null;
      if (decimals === null) return; // sem decimais não há quantidade honesta
      const meta = metaData[i];
      const sym = (meta && metaplexSymbol(meta)) || (data && token2022Symbol(data)) || "";
      out.set(m, { address: asCore(m), symbol: cleanSymbol(sym, `${m.slice(0, 4)}…`, 12), decimals });
    });
    return out;
  }

  private async loadTicks(positions: Position[], pools: Map<string, Whirlpool>): Promise<Map<string, Tick>> {
    const wanted = new Map<string, { pool: string; start: number }>();
    for (const p of positions) {
      const w = pools.get(p.whirlpool);
      if (!w) continue;
      for (const t of [p.tickLowerIndex, p.tickUpperIndex]) {
        const start = getTickArrayStartTickIndex(t, w.tickSpacing);
        wanted.set(`${p.whirlpool}:${start}`, { pool: p.whirlpool, start });
      }
    }
    const keys = [...wanted.keys()];
    const addrs = await Promise.all(
      keys.map(async (k) => (await getTickArrayAddress(solAddress(wanted.get(k)!.pool), wanted.get(k)!.start))[0]),
    );
    const arrays = new Map<string, Tick[]>();
    for (const [gi, group] of chunks(addrs, BATCH).entries()) {
      const accs = await fetchAllMaybeTickArray(this.rpc, group);
      accs.forEach((acc, j) => {
        if (acc.exists) arrays.set(keys[gi * BATCH + j], acc.data.ticks);
      });
    }
    const out = new Map<string, Tick>();
    for (const p of positions) {
      const w = pools.get(p.whirlpool);
      if (!w) continue;
      for (const t of [p.tickLowerIndex, p.tickUpperIndex]) {
        const start = getTickArrayStartTickIndex(t, w.tickSpacing);
        const tick = arrays.get(`${p.whirlpool}:${start}`)?.[getTickIndexInArray(t, start, w.tickSpacing)];
        if (tick) out.set(`${p.whirlpool}:${t}`, tick);
      }
    }
    return out;
  }

  /** dados crus das contas, na ordem pedida; null = conta não existe */
  private async accountsData(addrs: Address[]): Promise<(Uint8Array | null)[]> {
    const out: (Uint8Array | null)[] = [];
    for (const group of chunks(addrs, BATCH)) {
      const res = await this.rpc.getMultipleAccounts(group, { encoding: "base64" }).send();
      for (const acc of res.value) out.push(acc ? Uint8Array.from(Buffer.from(acc.data[0], "base64")) : null);
    }
    return out;
  }
}
