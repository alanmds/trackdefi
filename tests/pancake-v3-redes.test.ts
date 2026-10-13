/**
 * PancakeSwap v3 nas QUATRO redes — o teste que impede trocar o MasterChef ou o
 * CAKE de uma rede pelo de outra.
 *
 * Por que existe: em 02/10/2026 o playbook anotou que "Arbitrum e Base têm NFPM
 * e MasterChef próprios". A doc oficial, relida em 12/10/2026, diz o contrário
 * sobre o NFPM (é o mesmo nas quatro) e o MasterChef v3 continua próprio em
 * Arbitrum e Base. Um erro de cópia entre configurações vizinhas aqui não daria
 * erro em runtime: o MasterChef errado responde às mesmas funções, e o CAKE
 * errado (todos "Cake", 18 casas) apareceria como número válido na tela. Só um
 * teste que amarra os dois endereços à rede certa pega isso.
 *
 * Números redondos, inventados — nada de posição real (repo público).
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { PancakeV3Adapter } from "../core/adapters/pancake-v3/index";
import {
  PANCAKE_V3_ARBITRUM,
  PANCAKE_V3_BASE,
  PANCAKE_V3_BSC,
  PANCAKE_V3_CHAINS,
  PANCAKE_V3_ETHEREUM,
} from "../core/adapters/pancake-v3/config";
import { getSqrtRatioAtTick } from "../core/math/tickmath";
import type { ChainReader } from "../core/types";

const OWNER = "0x00000000000000000000000000000000000000aa" as Address;
const USDT = "0x55d398326f99059fF775485246999027B3197955" as Address;
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as Address;
const POOL = "0x00000000000000000000000000000000000000b1" as Address;
const LM = "0x00000000000000000000000000000000000000b2" as Address;

const TICK_LOWER = -1000;
const TICK_UPPER = 1000;
const TICK_CUR = 0;
const LIQ = 1_000_000n;
const BOOST = 1_500_000n;
const LM_LIQ = 30_000_000n;
const CAKE_PER_SEC_RAW = 10n ** 16n * 10n ** 12n; // 0,01 CAKE/s × precisão 1e12
const NOW = 1_800_000_000;

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Endereços CONFORME a doc oficial, lida em 12/10/2026 (ver o PoC). */
const DOC = [
  {
    rede: "BNB Chain",
    cfg: PANCAKE_V3_BSC,
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    masterChef: "0x556B9306565093C855AEA9AE92A594704c2Cd59e",
    cake: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  },
  {
    rede: "Ethereum",
    cfg: PANCAKE_V3_ETHEREUM,
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    masterChef: "0x556B9306565093C855AEA9AE92A594704c2Cd59e",
    cake: "0x152649eA73beAb28c5b49B26eb48f7EAD6d4c898",
  },
  {
    rede: "Base",
    cfg: PANCAKE_V3_BASE,
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    masterChef: "0xC6A2Db661D5a5690172d8eB0a7DEA2d3008665A3",
    cake: "0x3055913c90Fcc1A6CE9a358911721eEb942013A1",
  },
  {
    rede: "Arbitrum",
    cfg: PANCAKE_V3_ARBITRUM,
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    masterChef: "0x5e09ACf80C0296740eC5d6F643005a4ef8DaA694",
    cake: "0x1b896893dfc86bb67Cf57767298b9073D2c1bA2c",
  },
];

function rawPosition() {
  return [0n, "0x0000000000000000000000000000000000000000", USDT, WBNB, 2500, TICK_LOWER, TICK_UPPER, LIQ, 0n, 0n, 0n, 0n];
}

/**
 * Reader-stub de UMA rede: só responde ao NFPM e ao MasterChef da config
 * recebida. Se o adapter chamar o MasterChef de outra rede, a chamada cai no
 * `default` e vem como falha — a posição em stake fica sem CAKE e o teste
 * quebra. `chamadas` guarda o endereço de cada chamada para as asserções.
 */
function makeReader(cfg: (typeof DOC)[number]["cfg"], coletas: Array<{ address: string; tokenId: bigint }>) {
  const chamadas: Array<{ address: string; functionName: string }> = [];
  const reader: ChainReader = {
    async readContract({ address, functionName }) {
      chamadas.push({ address, functionName });
      if (functionName === "balanceOf") return eq(address, cfg.nfpm) || eq(address, cfg.masterChef) ? 1n : 0n;
      throw new Error(`inesperado: ${functionName}`);
    },
    async multicall({ contracts }) {
      return contracts.map((c) => {
        chamadas.push({ address: c.address, functionName: c.functionName });
        const ok = (result: unknown) => ({ status: "success" as const, result });
        switch (c.functionName) {
          case "tokenOfOwnerByIndex":
            return ok(eq(c.address, cfg.masterChef) ? 222n : 111n); // #111 na carteira, #222 em stake
          case "positions":
            return ok(rawPosition());
          case "getPool":
            return ok(POOL);
          case "slot0":
            return ok([getSqrtRatioAtTick(TICK_CUR), TICK_CUR, 0, 0, 0, 209718400, true]);
          case "liquidity":
            return ok(50_000_000n);
          case "symbol":
            return ok(eq(c.address, USDT) ? "USDT" : "WBNB");
          case "decimals":
            return ok(18);
          case "userPositionInfos":
            return ok([LIQ, BOOST, TICK_LOWER, TICK_UPPER, 0n, 0n, OWNER, 7n, 1_500_000_000_000n]);
          case "pendingCake":
            return ok(5n * 10n ** 18n);
          case "getLatestPeriodInfo":
            return ok([CAKE_PER_SEC_RAW, BigInt(NOW + 3600)]);
          case "lmPool":
            return ok(LM);
          case "lmLiquidity":
            return ok(LM_LIQ);
          default:
            return { status: "failure" as const, error: new Error(`inesperado: ${c.functionName}`) };
        }
      });
    },
    async simulateContract({ address, args }) {
      chamadas.push({ address, functionName: "collect" });
      const { tokenId } = args![0] as { tokenId: bigint };
      coletas.push({ address, tokenId });
      return { result: [10n, 20n] };
    },
  };
  return { reader, chamadas };
}

describe("PancakeSwap v3 — endereços por rede contra a doc oficial", () => {
  for (const { rede, cfg, factory, nfpm, masterChef, cake } of DOC) {
    it(`${rede}: factory, NFPM, MasterChef e CAKE são os documentados`, () => {
      expect(cfg.factory, `${rede} factory`).toBe(factory);
      expect(cfg.nfpm, `${rede} nfpm`).toBe(nfpm);
      expect(cfg.masterChef, `${rede} masterChef`).toBe(masterChef);
      expect(cfg.cake, `${rede} cake`).toEqual({ address: cake, symbol: "Cake", decimals: 18 });
    });
  }

  it("o registry tem as quatro redes, cada uma com o seu chainId", () => {
    expect(PANCAKE_V3_CHAINS.map((c) => c.chainId)).toEqual([56, 1, 8453, 42161]);
  });

  it("MasterChef e CAKE não se repetem onde não devem (troca entre vizinhas é detectável)", () => {
    const [bsc, eth, base, arb] = DOC.map((d) => d.cfg);
    // CAKE: um endereço por rede, sem exceção
    const cakes = DOC.map((d) => d.cfg.cake.address.toLowerCase());
    expect(new Set(cakes).size).toBe(4);
    // MasterChef: a doc diz que BSC e ETH dividem o mesmo; Base e Arbitrum têm
    // o seu. Se alguém copiar o de Arbitrum para a Base (ou o da BNB para a
    // Base), este teste quebra.
    expect(eth.masterChef.toLowerCase()).toBe(bsc.masterChef.toLowerCase());
    expect(base.masterChef.toLowerCase()).not.toBe(bsc.masterChef.toLowerCase());
    expect(arb.masterChef.toLowerCase()).not.toBe(bsc.masterChef.toLowerCase());
    expect(base.masterChef.toLowerCase()).not.toBe(arb.masterChef.toLowerCase());
    // NFPM: o mesmo nas quatro, de propósito — o adapter não pode "corrigir"
    // para um endereço canônico da Uniswap
    const nfpms = DOC.map((d) => d.cfg.nfpm.toLowerCase());
    expect(new Set(nfpms).size).toBe(1);
  });
});

describe("PancakeSwap v3 — o adapter usa a config da rede que recebeu", () => {
  for (const { rede, cfg } of DOC) {
    it(`${rede}: enumera, cobra taxas e paga CAKE no MasterChef da própria rede`, async () => {
      const coletas: Array<{ address: string; tokenId: bigint }> = [];
      const { reader, chamadas } = makeReader(cfg, coletas);
      const avisos: string[] = [];
      const ps = await new PancakeV3Adapter(reader, { config: cfg, onWarn: (m) => avisos.push(m), nowSec: () => NOW }).getPositions(OWNER);

      // as duas posições: a da carteira e a em stake no MasterChef DESTA rede
      expect(ps.map((p) => [p.positionId, p.staked])).toEqual([
        ["111", false],
        ["222", true],
      ]);
      expect(ps.every((p) => p.protocol === "pancakeswap-v3" && p.chainId === cfg.chainId)).toBe(true);
      expect(avisos).toEqual([]);

      // CAKE a receber + insumos de emissão vêm do MasterChef e do CAKE da rede
      const st = ps.find((p) => p.staked)!;
      expect(st.rewards).toContainEqual({ token: cfg.cake, raw: 5n * 10n ** 18n, kind: "emission" });
      expect(st.earningInputs).toMatchObject({
        stakedLiquidity: BOOST,
        poolStakedLiquidity: LM_LIQ,
        emissionRatePerSec: 10n ** 16n,
        emissionToken: cfg.cake,
      });

      // cada função é chamada nos endereços certos: o que é do MasterChef vai
      // para o MasterChef DESTA rede (e não para o de outra), e o que é do NFPM
      // continua no NFPM — que é o mesmo endereço nas quatro redes.
      const nfpmOk = cfg.nfpm.toLowerCase();
      const mcOk = cfg.masterChef.toLowerCase();
      const factoryOk = cfg.factory.toLowerCase();
      const esperado: Record<string, string[]> = {
        balanceOf: [nfpmOk, mcOk],
        tokenOfOwnerByIndex: [nfpmOk, mcOk],
        positions: [nfpmOk],
        getPool: [factoryOk],
        collect: [nfpmOk, mcOk],
        userPositionInfos: [mcOk],
        pendingCake: [mcOk],
        getLatestPeriodInfo: [mcOk],
      };
      for (const [fn, alvos] of Object.entries(esperado)) {
        const vistos = [...new Set(chamadas.filter((c) => c.functionName === fn).map((c) => c.address.toLowerCase()))];
        expect(vistos.length, `${rede}: ${fn} deveria ter sido chamado`).toBeGreaterThan(0);
        expect(vistos.sort(), `${rede}: ${fn} em endereço errado`).toEqual([...alvos].sort());
      }
      // o collect da posição em stake é simulado NO MasterChef (e não no NFPM)
      expect(coletas.find((c) => c.tokenId === 222n)!.address.toLowerCase()).toBe(mcOk);
    });
  }
});
