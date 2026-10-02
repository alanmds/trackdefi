/**
 * Trava contra RPC que IGNORA o bloco pedido (visto em 02/10/2026 no RPC
 * oficial da HyperEVM): ele aceita o `blockNumber`, não dá erro e devolve o
 * estado atual. Sem a trava, "antes" e "agora" saem iguais e a janela de fee
 * APR vira um 0% falso. Com ela, a leitura do passado prova o bloco pelo
 * horário (`Multicall3.getCurrentBlockTimestamp()`) e, se não bater, a janela
 * sai como "sem medição" — nunca como número. Horário, e não número do bloco:
 * na Arbitrum e na Robinhood (Orbit), `block.number` é o da rede-mãe.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { readPositionFeeWindows, type FeeWindowTarget } from "../core/yields/onchain";
import type { ChainReader } from "../core/types";

const POOL = "0x00000000000000000000000000000000000000b1" as Address;
const HEAD = 1_000_000n;
const ALVO: FeeWindowTarget = { key: "k", protocol: "uniswap-v3", pool: POOL, tickLower: -100, tickUpper: 100, inside0Last: null };

/** Pool fictício: o acumulador global cresce 1.000 por bloco; tick 0, dentro da faixa. */
function makeReader(modo: "honesto" | "ignora-bloco" | "sem-multicall3"): ChainReader {
  return {
    async readContract() {
      throw new Error("não usado");
    },
    async multicall({ contracts, blockNumber }) {
      const bloco = blockNumber ?? HEAD;
      // o RPC "ignora-bloco" responde sempre com o estado do bloco atual
      const efetivo = modo === "ignora-bloco" ? HEAD : bloco;
      return contracts.map((c) => {
        const ok = (result: unknown) => ({ status: "success" as const, result });
        switch (c.functionName) {
          case "feeGrowthGlobal0X128":
          case "feeGrowthGlobal1X128":
            return ok(efetivo * 1000n);
          case "slot0":
            return ok([79228162514264337593543950336n, 0, 0, 0, 0, 0, true]);
          case "ticks":
            return ok([1n, 0n, 0n, 0n, 0n, 0n, 0, true]);
          case "getCurrentBlockTimestamp": // 1 s por bloco
            return modo === "sem-multicall3" ? { status: "failure" as const, error: new Error("sem multicall3") } : ok(efetivo);
          default:
            return { status: "failure" as const, error: new Error(c.functionName) };
        }
      });
    },
    async getBlockNumber() {
      return HEAD;
    },
  };
}

describe("fee APR on-chain — prova do bloco", () => {
  it("RPC honesto: as janelas são medidas", async () => {
    const r = await readPositionFeeWindows(makeReader("honesto"), [ALVO], HEAD, 1);
    const janelas = r.byTarget.get("k") ?? [];
    expect(janelas.length).toBeGreaterThan(0);
    expect(janelas.every((w) => w.delta0 > 0n)).toBe(true);
    expect(r.unmeasured).toBe(0);
  });

  it("RPC que ignora o bloco: nenhuma janela (e nada de 0% falso)", async () => {
    const avisos: string[] = [];
    const r = await readPositionFeeWindows(makeReader("ignora-bloco"), [ALVO], HEAD, 1, (m) => avisos.push(m));
    expect(r.byTarget.get("k")).toBeUndefined();
    expect(r.unmeasured).toBe(1);
    expect(avisos.some((m) => m.includes("indisponível"))).toBe(true);
  });

  it("sem horário (Multicall3 ausente): não dá para provar nem negar — mede", async () => {
    const r = await readPositionFeeWindows(makeReader("sem-multicall3"), [ALVO], HEAD, 1);
    expect((r.byTarget.get("k") ?? []).length).toBeGreaterThan(0);
  });
});
