/**
 * Reserva de RPCs que divide a carga (core/rpc-pool.ts) e orçamento diário da
 * Alchemy (core/alchemy-budget.ts). Sem rede: o envio HTTP é trocado por um falso.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { base } from "viem/chains";
import { alchemyBudgetLeft, alchemySpentToday, chargeAlchemy, resetAlchemyBudget } from "../core/alchemy-budget";
import { planRpcs, poolTransport, type PlannedRpc } from "../core/rpc-pool";

const ALC = "https://base-mainnet.g.alchemy.com/v2/k";
const A = "https://a.example/rpc";
const B = "https://b.example/rpc";
const PUB = "https://publico.example";

beforeEach(() => {
  delete process.env.ALCHEMY_DAILY_CU;
  resetAlchemyBudget();
});

type Behavior = (url: string) => unknown | Promise<unknown>;

function make(plan: PlannedRpc[], behavior: Behavior, clock = { t: 1_000_000 }) {
  const calls: string[] = [];
  const t = poolTransport(base, plan, {
    now: () => clock.t,
    makeSend: (url) => async () => {
      calls.push(url);
      return behavior(url);
    },
  })({ chain: base, retryCount: 0 });
  const ask = () => t.request({ method: "eth_blockNumber" } as never);
  return { ask, calls, clock };
}

const outage = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe("planRpcs", () => {
  it("separa dedicados, Alchemy e públicos, sem repetir", () => {
    const plan = planRpcs([A, ALC, A], [PUB, A]);
    expect(plan).toEqual([
      { url: A, tier: "dedicated" },
      { url: ALC, tier: "alchemy" },
      { url: PUB, tier: "public" },
    ]);
  });
});

describe("poolTransport", () => {
  it("dedicados revezam entre si e a Alchemy fica de reserva", async () => {
    const { ask, calls } = make(planRpcs([ALC, A, B], [PUB]), () => "0x1");
    for (let i = 0; i < 6; i++) await ask();
    expect(calls.filter((u) => u === A)).toHaveLength(3);
    expect(calls.filter((u) => u === B)).toHaveLength(3);
    expect(calls).not.toContain(ALC);
    expect(calls).not.toContain(PUB);
  });

  it("só com a Alchemy configurada, ela continua sendo a primeira", async () => {
    const { ask, calls } = make(planRpcs([ALC], [PUB]), () => "0x1");
    await ask();
    expect(calls).toEqual([ALC]);
  });

  it("provedor que falha passa a vez, esfria e volta depois", async () => {
    let aDown = true;
    const { ask, calls, clock } = make(planRpcs([A, B], []), (u) => {
      if (u === A && aDown) throw outage(429);
      return "0x1";
    });
    await ask(); // A falha (429) → B responde
    expect(calls).toEqual([A, B]);
    calls.length = 0;
    await ask();
    await ask(); // A esfriando: ninguém tenta A
    expect(calls).not.toContain(A);
    aDown = false;
    clock.t += 130_000; // passou o resfriamento
    calls.length = 0;
    await ask();
    await ask();
    expect(calls).toContain(A);
  });

  it("revert do contrato volta direto, sem trocar de provedor nem punir ninguém", async () => {
    const revert = Object.assign(new Error("execution reverted"), { code: 3 });
    const { ask, calls } = make(planRpcs([A, B], []), () => {
      throw revert;
    });
    await expect(ask()).rejects.toThrow(/reverted/);
    expect(calls).toHaveLength(1);
    await expect(ask()).rejects.toThrow(/reverted/);
    expect(calls).toHaveLength(2); // A não ficou em resfriamento: o revert não é culpa dele
  });

  it("erro de método/estado só passa para o próximo, sem esfriar", async () => {
    const semHistorico = new Error("missing trie node");
    const { ask, calls } = make(planRpcs([A, B], []), (u) => {
      if (u === A) throw semHistorico;
      return "0x1";
    });
    await ask();
    await ask();
    await ask();
    expect(calls.filter((u) => u === A).length).toBeGreaterThan(1); // a vez de A volta: não esfriou
  });

  it("todos falhando: devolve o erro", async () => {
    const { ask } = make(planRpcs([A], [PUB]), () => {
      throw outage(503);
    });
    await expect(ask()).rejects.toThrow(/503/);
  });

  it("orçamento do dia acabou: a Alchemy sai da leitura comum e os públicos assumem", async () => {
    process.env.ALCHEMY_DAILY_CU = "50";
    const { ask, calls } = make(planRpcs([ALC], [PUB]), () => "0x1");
    await ask(); // gasta 10 CU
    for (let i = 0; i < 6; i++) await ask(); // 70 CU no total: passou de 50
    expect(calls.slice(0, 5).every((u) => u === ALC)).toBe(true);
    expect(calls[calls.length - 1]).toBe(PUB);
  });
});

describe("alchemy-budget", () => {
  it("conta CU por método e zera na virada do dia (UTC)", () => {
    const d1 = Date.UTC(2026, 10, 17, 23, 59);
    chargeAlchemy("alchemy_getAssetTransfers", d1);
    chargeAlchemy("eth_call", d1);
    expect(alchemySpentToday(d1)).toBe(146);
    expect(alchemySpentToday(d1 + 120_000)).toBe(0); // 18/11
  });

  it("respeita ALCHEMY_DAILY_CU", () => {
    process.env.ALCHEMY_DAILY_CU = "100";
    expect(alchemyBudgetLeft()).toBe(true);
    chargeAlchemy("alchemy_getAssetTransfers");
    expect(alchemyBudgetLeft()).toBe(false);
  });
});
