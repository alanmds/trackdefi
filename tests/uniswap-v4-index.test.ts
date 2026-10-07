/**
 * Uniswap v4 onde a varredura de histórico NÃO cabe no RPC.
 *
 * Medido em 06/10/2026 (`poc/probe-v4-bnb-varredura.ts`): na BNB Chain o RPC
 * público aceita 2.000 blocos por chamada e a chain tem 126M — a varredura de
 * `Transfer` seria dezenas de milhares de chamadas contra o teto de 200. Foi
 * por isso que posições v4 da BNB não apareciam: a rede nem estava no
 * registry.
 *
 * O que este arquivo trava: a rede com `enumeration: "index"` enumera pela API
 * indexada do próprio RPC (`alchemy_getAssetTransfers`) SEM varrer bloco a
 * bloco, e o aviso honesto só aparece quando as DUAS fontes falham.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { UniswapV4Adapter } from "../core/adapters/uniswap-v4/index";
import type { UniV4ChainConfig } from "../core/adapters/uniswap-v4/config";
import type { ChainReader } from "../core/types";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;

const BSC: UniV4ChainConfig = {
  chainId: 56,
  positionManager: "0x7a4a5c919ae2541aed11041a1aeee68f1287f95b",
  stateView: "0x0000000000000000000000000000000000000001",
  poolManager: "0x0000000000000000000000000000000000000002",
  enumeration: "index",
};

const ALCHEMY = "https://bnb-mainnet.g.alchemy.com/v2/chave-de-teste";

/** ids hex que o índice devolve (valores de exemplo) */
const IDS = ["0x1568e2", "0x15c1dd", "0x161058"];

/**
 * Reader que ANOTA o que foi chamado. `ownerOf` devolve um endereço que não é
 * a carteira: queremos provar a enumeração, então o caminho termina logo depois
 * (lista vazia, sem aviso) — sem precisar de estado de pool no stub.
 */
function stubReader(comLogs: boolean) {
  const donos: bigint[] = [];
  let varreduras = 0;
  const reader = {
    async readContract() {
      throw new Error("inesperado");
    },
    async multicall({ contracts }: { contracts: readonly { functionName: string; args?: readonly unknown[] }[] }) {
      return contracts.map((c) => {
        if (c.functionName === "ownerOf") {
          donos.push(c.args![0] as bigint);
          return { status: "success" as const, result: "0x9999999999999999999999999999999999999999" };
        }
        return { status: "failure" as const, error: new Error("inesperado") };
      });
    },
    async getBlockNumber() {
      return 126_000_000n;
    },
    async getLogs() {
      varreduras++;
      if (!comLogs) throw new Error("este teste não tem varredura de histórico");
      return [];
    },
  } as unknown as ChainReader;
  return { reader, donos, varreduras: () => varreduras };
}

/** grava o corpo de cada chamada ao índice, para conferir a pergunta feita */
function stubFetch(paginas: string[]) {
  const corpos: Array<{ method?: string; params?: Record<string, unknown>[] }> = [];
  vi.stubGlobal("fetch", async (_url: string, init?: { body?: string }) => {
    corpos.push(JSON.parse(init?.body ?? "{}"));
    const i = corpos.length - 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          transfers: (JSON.parse(paginas[i]) as string[]).map((tokenId) => ({ tokenId })),
          ...(i + 1 < paginas.length ? { pageKey: `p${i + 1}` } : {}),
        },
      }),
    } as Response;
  });
  return corpos;
}

let envAnterior: string | undefined;

beforeEach(() => {
  envAnterior = process.env.BSC_RPC_URLS;
  process.env.BSC_RPC_URLS = ALCHEMY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (envAnterior === undefined) delete process.env.BSC_RPC_URLS;
  else process.env.BSC_RPC_URLS = envAnterior;
});

describe("UniswapV4Adapter — enumeração por índice (onde não cabe varredura)", () => {
  it("enumera pela API indexada, paginada, sem varrer bloco a bloco", async () => {
    const s = stubReader(false);
    const corpos = stubFetch([JSON.stringify([IDS[0], IDS[1]]), JSON.stringify([IDS[2]])]);
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { config: BSC, retryDelayMs: 0, onWarn: (m) => warnings.push(m) });

    await adapter.getPositions(OWNER);

    // os três candidatos chegaram ao ownerOf — em hex, como o índice devolve
    expect(s.donos).toEqual([0x1568e2n, 0x15c1ddn, 0x161058n]);
    // e a varredura de histórico nem foi tentada: a fonte escolhida é o índice
    expect(s.varreduras()).toBe(0);
    expect(warnings).toHaveLength(0);

    // a pergunta certa: ERC-721 recebidos POR esta carteira, DESTE PositionManager
    const p1 = corpos[0].params![0];
    expect(corpos[0].method).toBe("alchemy_getAssetTransfers");
    expect(p1.toAddress).toBe(OWNER);
    expect(p1.contractAddresses).toEqual([BSC.positionManager]);
    expect(p1.fromBlock).toBe("0x0");
    // segunda página entrou com a chave que a primeira devolveu
    expect(corpos[1].params![0].pageKey).toBe("p1");
  });

  it("índice fora do ar e sem varredura: avisa honestamente e devolve vazio", async () => {
    const s = stubReader(false);
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 500, json: async () => null }) as Response);
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { config: BSC, retryDelayMs: 0, onWarn: (m) => warnings.push(m) });

    expect(await adapter.getPositions(OWNER)).toHaveLength(0);
    expect(warnings.some((w) => w.includes("índice do RPC respondeu HTTP 500"))).toBe(true);
    expect(warnings.some((w) => w.includes("posições v4 não listadas"))).toBe(true);
    expect(s.donos).toHaveLength(0);
  });

  it("sem chave Alchemy: o motivo está no aviso, não um erro mudo", async () => {
    delete process.env.BSC_RPC_URLS;
    const s = stubReader(false);
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { config: BSC, retryDelayMs: 0, onWarn: (m) => warnings.push(m) });

    await adapter.getPositions(OWNER);
    expect(warnings.join(" ")).toContain("BSC_RPC_URLS");
    expect(warnings.some((w) => w.includes("posições v4 não listadas"))).toBe(true);
  });

  it("índice caiu, mas a varredura ainda serve: recupera sem deixar aviso", async () => {
    const s = stubReader(true);
    vi.stubGlobal("fetch", async () => {
      throw new Error("rede fora");
    });
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { config: BSC, retryDelayMs: 0, onWarn: (m) => warnings.push(m) });

    await adapter.getPositions(OWNER);
    expect(s.varreduras()).toBeGreaterThan(0);
    expect(warnings).toHaveLength(0);
  });

  it("rede que prefere varredura (Robinhood) não toca no índice, mesmo com chave", async () => {
    const s = stubReader(true);
    const corpos: unknown[] = [];
    vi.stubGlobal("fetch", async () => {
      corpos.push(1);
      throw new Error("não deveria ser chamado");
    });
    const warnings: string[] = [];
    const adapter = new UniswapV4Adapter(s.reader, { retryDelayMs: 0, onWarn: (m) => warnings.push(m) });

    await adapter.getPositions(OWNER);
    expect(s.varreduras()).toBe(1);
    expect(corpos).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
