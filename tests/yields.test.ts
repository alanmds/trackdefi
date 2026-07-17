/**
 * Receita C: casamento de APR com o dataset REAL congelado da DefiLlama
 * (tests/fixtures/yields-fixture.json, capturado em 15/07/2026; linhas
 * Velodrome/OP acrescentadas em 17/07/2026 — no dataset a chain se chama
 * "OP Mainnet", não "Optimism"). O fixture contém, do mundo real: o caso
 * limpo, o ambíguo, o dominante, o absurdo e a rede com nome divergente.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { MAX_SANE_APR, MIN_TVL_USD, YieldsIndex, type LlamaRow } from "../core/yields/defillama";
import fixture from "./fixtures/yields-fixture.json";

const WETH = "0x4200000000000000000000000000000000000006" as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const CBBTC = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as Address;
const USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
const WETH_ETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address;
const USDC_OP = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as Address;
const USDCE_OP = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607" as Address;

const rows = [
  ...fixture.aeroWethUsdc,
  ...fixture.aeroUsdcCbbtc,
  ...fixture.uniEthWethUsdc,
  ...fixture.veloOpWethUsdc,
] as LlamaRow[];
const index = new YieldsIndex(rows);

const q = (over: Partial<Parameters<YieldsIndex["match"]>[0]>) => ({
  chainId: 8453,
  protocol: "aerodrome",
  kind: "concentrated" as const,
  poolSymbol: "CL100-WETH/USDC",
  token0: WETH,
  token1: USDC,
  ...over,
});

describe("YieldsIndex.match — casos reais do fixture", () => {
  it("caso limpo: CL100 WETH/USDC único → APR 139,28 com taxas/emissões/média", () => {
    const m = index.match(q({}))!;
    expect(m.current).toBeCloseTo(139.27767, 4);
    expect(m.base).toBeCloseTo(7.70902, 4);
    expect(m.reward).toBeCloseTo(131.56865, 4);
    expect(m.mean30d).toBeCloseTo(66.29009, 4);
    expect(m.source).toBe("DefiLlama");
  });

  it("caso ambíguo: dois CL1 WETH/USDC com TVLs próximos (1,45x) → null", () => {
    expect(index.match(q({ poolSymbol: "CL1-WETH/USDC" }))).toBeNull();
  });

  it("caso absurdo: CL1 USDC/cbBTC dominante tem APR 5.081% → teto corta → null", () => {
    expect(index.match(q({ poolSymbol: "CL1-USDC/cbBTC", token0: USDC, token1: CBBTC }))).toBeNull();
  });

  it("v2 dominante: vAMM WETH/USDC (TVL 312x o gêmeo) → APR 10,59", () => {
    const m = index.match(q({ kind: "v2-volatile", poolSymbol: "vAMM-WETH/USDC" }))!;
    expect(m.current).toBeCloseTo(10.59059, 4);
  });

  it("uniswap na Ethereum: fee 0.05% casa com o poolMeta certo (APR 26,94)", () => {
    const m = index.match(
      q({
        chainId: 1,
        protocol: "uniswap-v3",
        poolSymbol: "USDC/WETH 0.05%",
        token0: USDC_ETH,
        token1: WETH_ETH,
      }),
    )!;
    expect(m.current).toBeCloseTo(26.94477, 4);
    expect(m.reward).toBeNull();
  });

  it("uniswap fee 1% → o pool de 1% (APR 5,20), não o de maior TVL", () => {
    const m = index.match(
      q({ chainId: 1, protocol: "uniswap-v3", poolSymbol: "USDC/WETH 1%", token0: USDC_ETH, token1: WETH_ETH }),
    )!;
    expect(m.current).toBeCloseTo(5.196, 3);
  });

  it("ordem dos tokens não importa (par normalizado)", () => {
    const a = index.match(q({}));
    const b = index.match(q({ token0: USDC, token1: WETH }));
    expect(a).toEqual(b);
  });

  it("velodrome na OP: casa apesar do nome 'OP Mainnet' no dataset (CL100 → 71,85)", () => {
    const m = index.match(
      q({ chainId: 10, protocol: "velodrome", poolSymbol: "CL100-USDC/WETH", token0: USDC_OP, token1: WETH }),
    )!;
    expect(m.current).toBeCloseTo(71.847, 2);
    expect(m.reward).toBeCloseTo(71.847, 2);
    expect(m.base).toBeNull();
    expect(m.mean30d).toBeCloseTo(62.974, 2);
  });

  it("velodrome CL50 → seleciona pelo spacing, não pelo maior TVL (239,75)", () => {
    const m = index.match(
      q({ chainId: 10, protocol: "velodrome", poolSymbol: "CL50-USDC/WETH", token0: USDC_OP, token1: WETH }),
    )!;
    expect(m.current).toBeCloseTo(239.75, 2);
  });

  it("velodrome v2: poolMeta 'volatile - 0.3%' passa no filtro de v2 (8,54)", () => {
    const m = index.match(
      q({
        chainId: 10,
        protocol: "velodrome",
        kind: "v2-volatile",
        poolSymbol: "vAMM-WETH/USDC",
        token0: WETH,
        token1: USDCE_OP,
      }),
    )!;
    expect(m.current).toBeCloseTo(8.538, 2);
  });

  it("uniswap-v3 na Base: lacuna REAL do dataset → null", () => {
    expect(index.match(q({ protocol: "uniswap-v3", poolSymbol: "WETH/USDC 0.05%" }))).toBeNull();
  });

  it("rede/par desconhecidos → null", () => {
    expect(index.match(q({ chainId: 42161 }))).toBeNull();
    expect(index.match(q({ token1: CBBTC }))).toBeNull(); // WETH/cbBTC não está no fixture
  });
});

describe("guardas de confiabilidade", () => {
  it("piso de TVL: candidato único abaixo do piso → null", () => {
    const tiny: LlamaRow = {
      chain: "Base",
      project: "aerodrome-slipstream",
      tvlUsd: MIN_TVL_USD - 1,
      apy: 50,
      apyBase: 50,
      apyReward: 0,
      apyMean30d: 40,
      poolMeta: "CL42 - 0.05%",
      underlyingTokens: [WETH, USDC],
    };
    const idx = new YieldsIndex([tiny]);
    expect(idx.match(q({ poolSymbol: "CL42-WETH/USDC" }))).toBeNull();
    // e passa quando o TVL cruza o piso
    const ok = new YieldsIndex([{ ...tiny, tvlUsd: MIN_TVL_USD }]);
    expect(ok.match(q({ poolSymbol: "CL42-WETH/USDC" }))?.current).toBe(50);
  });

  it("teto de sanidade exportado é 1.000% a.a.", () => {
    expect(MAX_SANE_APR).toBe(1000);
  });

  it("apy null no dataset → candidato descartado", () => {
    const noApy: LlamaRow = {
      chain: "Base",
      project: "aerodrome-slipstream",
      tvlUsd: 1_000_000,
      apy: null,
      apyBase: null,
      apyReward: null,
      apyMean30d: null,
      poolMeta: "CL7 - 0.01%",
      underlyingTokens: [WETH, USDC],
    };
    expect(new YieldsIndex([noApy]).match(q({ poolSymbol: "CL7-WETH/USDC" }))).toBeNull();
  });
});
