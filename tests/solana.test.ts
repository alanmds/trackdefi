/**
 * Solana · Orca (14/10/2026): endereço base58, o adapter (partes puras, sem
 * internet), o casamento de APR pelo TVL e o service separando as famílias
 * de endereço. Os mints usados são de tokens públicos (wSOL, USDC) — nunca
 * carteira de teste (essas ficam em privado/).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import type { Position, Tick, Whirlpool } from "@orca-so/whirlpools-client";
import { parseWalletAddress, isSolanaAddress, shortAddress } from "../core/address";
import {
  metaplexSymbol,
  mintDecimals,
  orcaPoolSymbol,
  token2022Symbol,
  tokenAccountAmount,
  toLpPosition,
} from "../core/adapters/orca/index";
import { SOLANA_CHAIN_ID } from "../core/chains";
import { fetchUsdPrices } from "../core/prices/defillama";
import type { PriceProvider } from "../core/prices/types";
import { getWalletPositions } from "../core/service";
import type { LpPosition, ProtocolAdapter, TokenInfo } from "../core/types";
import { YieldsIndex, type LlamaRow } from "../core/yields/defillama";

const WSOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

describe("endereço de carteira", () => {
  it("aceita EVM e devolve com checksum", () => {
    const r = parseWalletAddress("0x4200000000000000000000000000000000000006");
    expect(r).toEqual({ kind: "evm", address: "0x4200000000000000000000000000000000000006" });
  });

  it("aceita base58 de 32 bytes e NÃO mexe na caixa", () => {
    expect(parseWalletAddress(`  ${USDC} `)).toEqual({ kind: "solana", address: USDC });
    expect(isSolanaAddress(WSOL)).toBe(true);
    expect(isSolanaAddress("11111111111111111111111111111111")).toBe(true); // 32 zeros
  });

  it("recusa caractere fora do base58, tamanho errado e 0x quebrado", () => {
    expect(parseWalletAddress(USDC.replace("E", "0"))).toBeNull(); // 0 não existe no base58
    expect(parseWalletAddress(USDC.replace("P", "O"))).toBeNull(); // nem O, I e l
    expect(parseWalletAddress(USDC.slice(0, 30))).toBeNull();
    expect(parseWalletAddress("0x1234")).toBeNull();
    expect(parseWalletAddress("")).toBeNull();
    // 44 caracteres válidos mas que decodificam em mais de 32 bytes
    expect(isSolanaAddress("z".repeat(44))).toBe(false);
  });

  it("encurta as duas famílias", () => {
    expect(shortAddress("0x4200000000000000000000000000000000000006")).toBe("0x4200…0006");
    expect(shortAddress(USDC)).toBe("EPjF…Dt1v");
  });
});

describe("Orca — leitura de contas (puro)", () => {
  /** string borsh: u32 LE de tamanho + bytes */
  const borsh = (s: string) => {
    const b = new TextEncoder().encode(s);
    return [b.length & 0xff, 0, 0, 0, ...b];
  };

  it("símbolo do metadado da Metaplex, sem o preenchimento de \\0", () => {
    const data = Uint8Array.from([4, ...new Array(64).fill(7), ...borsh("USD Coin\0\0\0"), ...borsh("USDC\0\0\0\0\0\0")]);
    expect(metaplexSymbol(data)).toBe("USDC");
  });

  it("símbolo embutido num mint Token-2022 (extensão 19)", () => {
    const corpo = [...new Array(64).fill(1), ...borsh("PayPal USD"), ...borsh("PYUSD")];
    const data = Uint8Array.from([
      ...new Array(166).fill(0),
      // uma extensão qualquer antes (tipo 1, 2 bytes), depois a de metadado
      1, 0, 2, 0, 9, 9,
      19, 0, corpo.length & 0xff, corpo.length >> 8, ...corpo,
    ]);
    expect(token2022Symbol(data)).toBe("PYUSD");
    expect(token2022Symbol(new Uint8Array(82))).toBeNull(); // mint clássico
  });

  it("decimais do mint e saldo da conta de token", () => {
    const mint = new Uint8Array(82);
    mint[44] = 9;
    expect(mintDecimals(mint)).toBe(9);
    const conta = new Uint8Array(165);
    conta.set([0x00, 0x10, 0xa5, 0xd4, 0xe8, 0, 0, 0], 64); // 1e12, u64 LE
    expect(tokenAccountAmount(conta)).toBe(1_000_000_000_000n);
  });

  it("símbolo do pool com a taxa da Orca (centésimos de bp)", () => {
    expect(orcaPoolSymbol("SOL", "USDC", 400)).toBe("SOL/USDC 0.04%");
    expect(orcaPoolSymbol("SOL", "ORCA", 1600)).toBe("SOL/ORCA 0.16%");
    expect(orcaPoolSymbol("A", "B", 10000)).toBe("A/B 1%");
  });
});

describe("Orca — posição normalizada (matemática do SDK oficial)", () => {
  const tA: TokenInfo = { address: WSOL as Address, symbol: "SOL", decimals: 9 };
  const tB: TokenInfo = { address: USDC as Address, symbol: "USDC", decimals: 6 };
  const tick: Tick = {
    initialized: true,
    liquidityNet: 0n,
    liquidityGross: 0n,
    feeGrowthOutsideA: 0n,
    feeGrowthOutsideB: 0n,
    rewardGrowthsOutside: [0n, 0n, 0n],
  };
  const vazio = { mint: "11111111111111111111111111111111", vault: "11111111111111111111111111111111" };
  const whirlpool = (tickCurrentIndex: number, sqrtPrice: bigint) =>
    ({
      feeTierIndexSeed: new Uint8Array([64, 0]),
      protocolFeeRate: 1300,
      tickSpacing: 64,
      feeRate: 400,
      liquidity: 4_000_000_000n,
      sqrtPrice,
      tickCurrentIndex,
      tokenMintA: WSOL,
      tokenMintB: USDC,
      tokenVaultA: WSOL,
      tokenVaultB: USDC,
      feeGrowthGlobalA: 0n,
      feeGrowthGlobalB: 0n,
      rewardLastUpdatedTimestamp: 0n,
      rewardInfos: [0, 1, 2].map(() => ({ ...vazio, extension: new Uint8Array(32), emissionsPerSecondX64: 0n, growthGlobalX64: 0n })),
    }) as unknown as Whirlpool;
  const position = {
    whirlpool: "pool",
    positionMint: "NFTmint",
    liquidity: 1_000_000_000n,
    tickLowerIndex: -128,
    tickUpperIndex: 128,
    feeGrowthCheckpointA: 0n,
    feeOwedA: 5_000n,
    feeGrowthCheckpointB: 0n,
    feeOwedB: 0n,
    rewardInfos: [0, 1, 2].map(() => ({ growthInsideCheckpoint: 0n, amountOwed: 0n })),
  } as unknown as Position;

  const montar = (w: Whirlpool, ticks: boolean) =>
    toLpPosition({
      position,
      whirlpool: w,
      poolAddress: "pool",
      tokenA: tA,
      tokenB: tB,
      rewardTokens: [null, null, null],
      tickLower: ticks ? tick : null,
      tickUpper: ticks ? tick : null,
      nowSec: 0n,
      reserves: { amount0Raw: 1n, amount1Raw: 2n },
    });

  it("no tick 0: na faixa, os dois tokens, taxa a receber como fee", () => {
    const p = montar(whirlpool(0, 1n << 64n), true); // sqrtPrice Q64.64 = 1 → tick 0
    expect(p.chainId).toBe(SOLANA_CHAIN_ID);
    expect(p.protocol).toBe("orca");
    expect(p.poolSymbol).toBe("SOL/USDC 0.04%");
    expect(p.range?.inRange).toBe(true);
    expect(p.amount0Raw > 0n && p.amount1Raw > 0n).toBe(true);
    expect(p.rewards).toEqual([{ token: tA, raw: 5_000n, kind: "fee" }]);
    expect(p.earningInputs?.liquidity).toBe(1_000_000_000n);
    expect(p.earningInputs?.activeLiquidity).toBe(4_000_000_000n);
    expect(p.poolReserves).toEqual({ amount0Raw: 1n, amount1Raw: 2n });
    expect(p.staked).toBe(false);
  });

  it("acima da faixa: fora, e o principal vira todo token B", () => {
    const p = montar(whirlpool(1000, 2n << 64n), true);
    expect(p.range?.inRange).toBe(false);
    expect(p.amount0Raw).toBe(0n);
    expect(p.amount1Raw > 0n).toBe(true);
  });

  it("sem os ticks das pontas: posição sai, sem inventar taxa", () => {
    const p = montar(whirlpool(0, 1n << 64n), false);
    expect(p.rewards).toEqual([]);
    expect(p.amount0Raw > 0n).toBe(true);
  });
});

describe("APR do pool da Orca: casamento pelo TVL", () => {
  const linha = (tvlUsd: number, apy: number): LlamaRow => ({
    chain: "Solana",
    project: "orca-dex",
    tvlUsd,
    apy,
    apyBase: apy,
    apyReward: null,
    apyMean30d: null,
    poolMeta: null,
    underlyingTokens: [WSOL, USDC],
  });
  // o mesmo par em três pools, como no dataset real (9 pools SOL/USDC)
  const index = new YieldsIndex([linha(27_000_000, 76), linha(220_000, 7), linha(55_000, 72)]);
  const q = (poolTvlUsd: number | null) => ({
    chainId: SOLANA_CHAIN_ID,
    protocol: "orca",
    kind: "concentrated" as const,
    poolSymbol: "SOL/USDC 0.04%",
    token0: WSOL as Address,
    token1: USDC as Address,
    poolTvlUsd,
  });

  it("acha o pool cujo TVL bate com o lido nos cofres", () => {
    expect(index.match(q(26_000_000))?.current).toBe(76);
    expect(index.match(q(200_000))?.current).toBe(7);
  });

  it('sem TVL dos cofres, ou sem linha perto dele: "—" (nunca o APR do vizinho)', () => {
    expect(index.match(q(null))).toBeNull();
    expect(index.match(q(1_000_000))).toBeNull();
  });
});

describe("preço de mint da Solana", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("é pedido na caixa original (em minúsculas a DefiLlama não acha) e volta com chave minúscula", async () => {
    const pedidas: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      pedidas.push(url);
      return new Response(JSON.stringify({ coins: { [`solana:${USDC}`]: { price: 1 } } }));
    });
    const r = await fetchUsdPrices("solana", [USDC as Address]);
    expect(pedidas[0]).toContain(`solana:${USDC}`);
    expect(r.get(USDC.toLowerCase())).toBe(1);
  });
});

describe("service: cada endereço vai só para a sua família de adapters", () => {
  const precos: PriceProvider = { name: "teste", fetchUsdPrices: async () => new Map() };
  const espiao = (addressKind: "evm" | "solana" | undefined, chamadas: string[]): ProtocolAdapter => ({
    protocol: addressKind === "solana" ? "orca" : "uniswap-v3",
    chainId: addressKind === "solana" ? SOLANA_CHAIN_ID : 8453,
    ...(addressKind ? { addressKind } : {}),
    getPositions: async (a: string): Promise<LpPosition[]> => {
      chamadas.push(`${addressKind ?? "evm"}:${a}`);
      return [];
    },
  });

  it("base58 → só a Solana; 0x → só as EVM", async () => {
    const chamadas: string[] = [];
    const adapters = [espiao(undefined, chamadas), espiao("solana", chamadas)];
    const sol = await getWalletPositions(USDC, adapters, precos, async () => null, null);
    expect(chamadas).toEqual([`solana:${USDC}`]);
    expect(sol.chains).toEqual(["solana"]);

    chamadas.length = 0;
    await getWalletPositions("0x4200000000000000000000000000000000000006", adapters, precos, async () => null, null);
    expect(chamadas).toEqual(["evm:0x4200000000000000000000000000000000000006"]);
  });
});

describe("cabeçalho da carteira: redes da família do endereço", () => {
  it("Solana mostra só a Solana; EVM mostra todas menos ela", async () => {
    const { networksDotted, NETWORKS } = await import("../app/site");
    expect(networksDotted("solana")).toBe("Solana");
    expect(networksDotted("evm")).not.toContain("Solana");
    expect(networksDotted("evm").split(" · ")).toHaveLength(NETWORKS.length - 1);
  });
});
