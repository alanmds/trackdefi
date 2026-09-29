/**
 * Uniswap v4: varredura de `Transfer` em faixas (parte ao meio quando o RPC
 * recusa, repete faixa curta) e o aviso quando nada funciona.
 */

import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { UniswapV4Adapter } from "../core/adapters/uniswap-v4/index";
import type { ChainReader } from "../core/types";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;

interface Stub {
  reader: ChainReader;
  ranges: [bigint, bigint][];
  ownerOfIds: bigint[];
}

/** `refuse(from, to, chamada)` decide se o RPC recusa aquela faixa */
function makeStub(head: bigint, refuse: (from: bigint, to: bigint, call: number) => boolean): Stub {
  const ranges: [bigint, bigint][] = [];
  const ownerOfIds: bigint[] = [];
  const reader = {
    async readContract() {
      throw new Error("inesperado");
    },
    async multicall({ contracts }: { contracts: readonly { functionName: string; args?: readonly unknown[] }[] }) {
      return contracts.map((c) => {
        if (c.functionName === "ownerOf") {
          ownerOfIds.push(c.args![0] as bigint);
          return { status: "success" as const, result: "0x2222222222222222222222222222222222222222" }; // não é o dono
        }
        return { status: "failure" as const, error: new Error("inesperado") };
      });
    },
    async getBlockNumber() {
      return head;
    },
    async getLogs({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) {
      ranges.push([fromBlock, toBlock]);
      if (refuse(fromBlock, toBlock, ranges.length)) throw new Error("HTTP request failed.");
      // um NFT "recebido" em cada extremo da faixa pedida, para provar que nenhuma metade se perde
      return [{ args: { tokenId: fromBlock + 1n } }, { args: { tokenId: toBlock + 1n } }];
    },
  } as unknown as ChainReader;
  return { reader, ranges, ownerOfIds };
}

describe("UniswapV4Adapter — varredura de histórico", () => {
  it("faixa inteira aceita: uma única chamada", async () => {
    const s = makeStub(1_000_000n, () => false);
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { retryDelayMs: 0, onWarn: (m) => warnings.push(m) });
    await adapter.getPositions(OWNER);
    expect(s.ranges).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("RPC recusa faixa larga: parte ao meio e junta as duas metades", async () => {
    const head = 100_000_000n;
    const s = makeStub(head, (from, to) => to - from > 60_000_000n);
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { retryDelayMs: 0, onWarn: (m) => warnings.push(m) });
    await adapter.getPositions(OWNER);

    expect(warnings).toHaveLength(0);
    expect(s.ranges.length).toBeGreaterThan(2);
    // as faixas aceitas cobrem 0..head sem buraco e sem sobreposição
    const aceitas = s.ranges.filter(([a, b]) => b - a <= 60_000_000n).sort((x, y) => Number(x[0] - y[0]));
    expect(aceitas[0][0]).toBe(0n);
    expect(aceitas[aceitas.length - 1][1]).toBe(head);
    for (let i = 1; i < aceitas.length; i++) expect(aceitas[i][0]).toBe(aceitas[i - 1][1] + 1n);
    // NFTs das duas metades chegaram até a conferência de dono
    expect(s.ownerOfIds).toContain(1n);
    expect(s.ownerOfIds).toContain(head + 1n);
  });

  it("falha passageira numa faixa curta: repete e segue sem aviso", async () => {
    const s = makeStub(1_000n, (_f, _t, call) => call === 1);
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { retryDelayMs: 0, onWarn: (m) => warnings.push(m) });
    await adapter.getPositions(OWNER);
    expect(s.ranges).toHaveLength(2);
    expect(warnings).toHaveLength(0);
  });

  it("RPC nunca responde: avisa e devolve vazio, sem lista parcial", async () => {
    const s = makeStub(1_000n, () => true);
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { retryDelayMs: 0, onWarn: (m) => warnings.push(m) });
    expect(await adapter.getPositions(OWNER)).toHaveLength(0);
    expect(warnings.some((w) => w.includes("recusou a varredura"))).toBe(true);
    expect(s.ownerOfIds).toHaveLength(0);
  });

  it("não martela o RPC: para no teto de chamadas", async () => {
    const s = makeStub(10_000_000_000_000n, () => true);
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { retryDelayMs: 0, onWarn: (m) => warnings.push(m) });
    await adapter.getPositions(OWNER);
    expect(s.ranges.length).toBeLessThanOrEqual(200);
    expect(warnings.some((w) => w.includes("recusou a varredura"))).toBe(true);
  });
});
