/**
 * Testa a montagem do DTO (buildResponse) com as posições reais congeladas da
 * carteira demo (de terceiro — ver tests/demo-fixture.ts), na Base e na
 * Optimism, e preços FIXOS — determinístico e offline.
 */

import { describe, expect, it } from "vitest";
import { buildResponse, priceKey } from "../core/service";
import { DEMO_ACCOUNT, normalized, token } from "./demo-fixture";

const todas = () => [...normalized("base"), ...normalized("optimism")];

/* preços fixos, com chave multi-rede chainId:endereço (WETH tem o MESMO
   endereço na Base e na Optimism — a chave é o que separa). member, CREATOR e
   KAITO ficam de fora de propósito: são os casos "sem preço". */
const PRICES = new Map<string, number>([
  [priceKey(8453, token("base", "WETH").address), 3000],
  [priceKey(8453, token("base", "AERO").address), 1],
  [priceKey(8453, token("base", "DEGEN").address), 0.005],
  [priceKey(8453, token("base", "DOG").address), 0.002],
  [priceKey(8453, token("base", "TYBG").address), 0.00001],
  [priceKey(10, token("optimism", "WETH").address), 3000],
  [priceKey(10, token("optimism", "USDC").address), 1],
  [priceKey(10, token("optimism", "VELO").address), 0.05],
  [priceKey(10, token("optimism", "OP").address), 1.5],
  [priceKey(10, token("optimism", "wstETH").address), 3600],
  [priceKey(10, token("optimism", "oUSDT").address), 1],
]);

/* Estes três não têm preço na fonte (member, CREATOR, KAITO), mas o outro lado
   do par (WETH) tem: desde 27/09/2026 o preço que falta sai do PRÓPRIO pool. */
const SEM_PRECO = ["vAMM-WETH/member", "vAMM-CREATOR/WETH", "CL100-WETH/KAITO"];

/** mesmos preços, sem o AERO — cria recompensa sem preço que o pool NÃO cobre
 *  (emissão AERO numa posição cujo par não tem AERO) */
const SEM_AERO = new Map([...PRICES].filter(([k]) => k !== priceKey(8453, token("base", "AERO").address)));

/** preço do token0 em token1 num tick — fórmula própria, independente do código */
const precoNoTick = (tick: number, d0: number, d1: number) => 1.0001 ** tick * 10 ** (d0 - d1);

describe("buildResponse", () => {
  const dto = buildResponse({
    address: DEMO_ACCOUNT,
    normalized: todas(),
    prices: PRICES,
    scanMs: 1234,
    warnings: [],
    protocols: ["aerodrome", "velodrome"],
    chains: ["base", "optimism"],
  });
  const bySymbol = (s: string) => dto.positions.find((p) => p.poolSymbol === s)!;

  it("metadados básicos e as 12 posições das duas redes", () => {
    expect(dto.chains).toEqual(["base", "optimism"]);
    expect(dto.protocols).toEqual(["aerodrome", "velodrome"]);
    expect(dto.scanMs).toBe(1234);
    expect(dto.positions).toHaveLength(12);
    expect(dto.totalPositions).toBe(12);
  });

  it("ordena por valor: maiores primeiro, sem preço por último", () => {
    const valores = dto.positions.map((p) => p.valueUsd);
    const comPreco = valores.filter((v): v is number => v !== null);
    expect(comPreco).toEqual([...comPreco].sort((a, b) => b - a));
    expect(valores.slice(comPreco.length).every((v) => v === null)).toBe(true);
  });

  it("token sem preço na fonte, com o par precificado → preço do PRÓPRIO pool, marcado como tal", () => {
    for (const s of SEM_PRECO) {
      const p = bySymbol(s);
      expect(p.valueUsd, s).not.toBeNull();
      const derivado = p.token0.priceSource === "pool" ? p.token0 : p.token1;
      expect(derivado.priceSource, s).toBe("pool");
      expect(derivado.priceUsd, s).toBeGreaterThan(0);
    }
    expect(dto.totals.positionsWithoutPrice).toBe(0);
  });

  it("clássica volátil: preço das reservas → os dois lados valem o mesmo (x·y=k)", () => {
    const p = bySymbol("vAMM-WETH/member"); // WETH (3000) é o token0
    expect(p.token1.priceUsd).toBeCloseTo((3000 * p.token0.amount) / p.token1.amount, 12);
    expect(p.token1.valueUsd).toBeCloseTo(p.token0.valueUsd!, 6);
  });

  it("concentrada: preço do tick atual do pool (KAITO = WETH ÷ KAITO-por-WETH)", () => {
    const p = bySymbol("CL100-WETH/KAITO");
    // faixa não invertida: `current` já é KAITO por 1 WETH, lido no tick do pool
    expect(p.range!.inverted).toBe(false);
    expect(p.token1.priceUsd).toBeCloseTo(3000 / p.range!.current, 9);
    expect(p.token1.priceSource).toBe("pool");
  });

  it("taxa paga no token precificado pelo pool usa o mesmo preço, marcada como pool", () => {
    const p = bySymbol("vAMM-WETH/member");
    const taxa = p.rewards.find((r) => r.symbol === "member")!;
    expect(taxa.priceSource).toBe("pool");
    expect(taxa.priceUsd).toBe(p.token1.priceUsd);
    expect(p.rewardsUsd).not.toBeNull();
  });

  it("sem preço em NENHUM lado do par, não há de onde tirar: continua '—'", () => {
    const nada = buildResponse({ address: DEMO_ACCOUNT, normalized: todas(), prices: new Map(), scanMs: 1, warnings: [] });
    expect(nada.totals.positionsWithoutPrice).toBe(12);
    expect(nada.positions.every((p) => p.token0.priceUsd === null && p.token1.priceUsd === null)).toBe(true);
  });

  it("clássica ESTÁVEL não usa a proporção das reservas: a curva não é x·y=k", () => {
    const estavel = todas().map((p) => (p.poolSymbol === "vAMM-WETH/member" ? { ...p, kind: "v2-stable" as const } : p));
    const d = buildResponse({ address: DEMO_ACCOUNT, normalized: estavel, prices: PRICES, scanMs: 1, warnings: [] });
    const p = d.positions.find((x) => x.poolSymbol === "vAMM-WETH/member")!;
    expect(p.token1.priceUsd).toBeNull();
    expect(p.valueUsd).toBeNull();
  });

  it("tick do pool desconhecido (leitura falhou) não vira preço", () => {
    const semTick = todas().map((p) =>
      p.poolSymbol === "CL100-WETH/KAITO" ? { ...p, range: { ...p.range!, currentKnown: false } } : p,
    );
    const d = buildResponse({ address: DEMO_ACCOUNT, normalized: semTick, prices: PRICES, scanMs: 1, warnings: [] });
    expect(d.positions.find((x) => x.poolSymbol === "CL100-WETH/KAITO")!.valueUsd).toBeNull();
  });

  it("posição precificada = quantidade × preço de cada token", () => {
    const p = bySymbol("CL100-USDC/WETH");
    expect(p.chainId).toBe(10);
    expect(p.valueUsd).toBeCloseTo((185532 / 1e6) * 1 + (7298240095488 / 1e18) * 3000, 9);
    expect(p.token1.priceUsd).toBe(3000);
  });

  it("faixa de USDC/WETH é invertida para 'USDC por WETH', legível", () => {
    const p = bySymbol("CL100-USDC/WETH");
    expect(p.range!.inverted).toBe(true);
    expect(p.range!.quoteLabel).toBe("USDC/WETH");
    expect(p.range!.lower).toBeCloseTo(1 / precoNoTick(201200, 6, 18), 6);
    expect(p.range!.upper).toBeCloseTo(1 / precoNoTick(197000, 6, 18), 6);
    expect(p.range!.lower).toBeGreaterThan(1000); // o ETH do dia cabe aqui
    expect(p.range!.upper).toBeLessThan(5000);
    expect(p.range!.inRange).toBe(true);
  });

  it("faixa que já é legível não é invertida (WETH/AERO → AERO por WETH)", () => {
    const p = bySymbol("CL200-WETH/AERO");
    expect(p.range!.inverted).toBe(false);
    expect(p.range!.quoteLabel).toBe("AERO/WETH");
  });

  it("totals.valueUsd = soma apenas das posições precificadas", () => {
    const esperado = dto.positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);
    expect(dto.totals.valueUsd).toBeCloseTo(esperado, 9);
    expect(dto.totals.valueUsd).toBeGreaterThan(0);
  });

  it("emissões precificadas pelo token da rede (VELO na Optimism)", () => {
    const p = bySymbol("CL100-USDC/WETH");
    const emissao = p.rewards.find((r) => r.kind === "emission");
    expect(emissao?.symbol).toBe("VELO");
    expect(emissao?.valueUsd).toBeCloseTo((emissao?.amount ?? 0) * 0.05, 9);
    expect(p.rewardsUsd).not.toBeNull();
  });

  it("recompensas somam item a item: token sem preço não apaga o resto do card (26/09/2026)", () => {
    // sem o preço do AERO: vAMM-WETH/DEGEN tem taxas em WETH (com preço) E
    // emissão AERO (sem — e o par dele não tem AERO para o pool resolver).
    // Antes, o card inteiro virava null e o WETH sumia do total do topo.
    // e sem NENHUM pool de AERO na rede (senão o preço sairia dele — ver o teste seguinte)
    const semPoolDeAero = todas().filter((p) => p.poolSymbol !== "CL200-WETH/AERO");
    const d = buildResponse({ address: DEMO_ACCOUNT, normalized: semPoolDeAero, prices: SEM_AERO, scanMs: 1, warnings: [] });
    const misto = d.positions.find((p) => p.poolSymbol === "vAMM-WETH/DEGEN")!;
    expect(misto.rewardsUsd).toBeNull();
    expect(misto.rewards.find((r) => r.symbol === "WETH")!.valueUsd).toBeGreaterThan(0);

    const todasRec = d.positions.flatMap((p) => p.rewards);
    const comPreco = todasRec.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
    expect(d.totals.rewardsUsd).toBeCloseTo(comPreco, 9);
    expect(d.totals.rewardsWithoutPrice).toBe(todasRec.filter((r) => r.valueUsd === null).length);
    // emissão AERO nas 3 clássicas em stake (DOG, DEGEN, TYBG)
    expect(d.totals.rewardsWithoutPrice).toBe(3);
  });

  it("token sem preço na fonte ganha o preço que OUTRO pool da mesma rede deu a ele", () => {
    // sem AERO na fonte, mas com o pool CL200-WETH/AERO na carteira: a emissão
    // AERO das clássicas (cujo par não tem AERO) sai do preço desse pool
    const d = buildResponse({ address: DEMO_ACCOUNT, normalized: todas(), prices: SEM_AERO, scanMs: 1, warnings: [] });
    const clAero = d.positions.find((p) => p.poolSymbol === "CL200-WETH/AERO")!;
    expect(clAero.token1.priceSource).toBe("pool");
    const emissao = d.positions.find((p) => p.poolSymbol === "vAMM-WETH/DEGEN")!.rewards.find((r) => r.kind === "emission")!;
    expect(emissao.priceUsd).toBe(clAero.token1.priceUsd);
    expect(emissao.priceSource).toBe("pool");
    expect(d.totals.rewardsWithoutPrice).toBe(0);
  });

  it("avisos para o visitante: repetidos viram um, e 'faltou um pedaço' some se o adapter caiu inteiro", () => {
    const d = buildResponse({
      address: DEMO_ACCOUNT,
      normalized: [],
      prices: PRICES,
      scanMs: 1,
      warnings: [],
      notices: [
        { kind: "partial", protocol: "uniswap-v4", chainId: 4663 },
        { kind: "partial", protocol: "uniswap-v4", chainId: 4663 },
        { kind: "partial", protocol: "aerodrome", chainId: 8453 },
        { kind: "source", protocol: "aerodrome", chainId: 8453 },
        { kind: "prices" },
        { kind: "prices" },
      ],
    });
    expect(d.notices).toEqual([
      { kind: "partial", protocol: "uniswap-v4", chainId: 4663 },
      { kind: "source", protocol: "aerodrome", chainId: 8453 },
      { kind: "prices" },
    ]);
  });

  it("DTO é 100% serializável — sem bigint vazando", () => {
    const round = JSON.parse(JSON.stringify(dto));
    expect(typeof round.positions[0].token0.amountRaw).toBe("string");
    expect(round.positions.find((p: { poolSymbol: string }) => p.poolSymbol === "CL100-USDC/WETH").positionId).toBe(
      "47980865",
    );
  });

  it("corte para carteiras-lixeira: top N por valor, totais sobre todas", () => {
    const cut = buildResponse({
      address: DEMO_ACCOUNT,
      normalized: todas(),
      prices: PRICES,
      scanMs: 1,
      warnings: [],
      maxPositions: 2,
    });
    expect(cut.totalPositions).toBe(12);
    expect(cut.positions).toHaveLength(2);
    expect(cut.positions[0].poolSymbol).toBe(dto.positions[0].poolSymbol);
    expect(cut.totals.valueUsd).toBeCloseTo(dto.totals.valueUsd, 6); // totais NÃO mudam
    expect(cut.totals.positionsWithoutPrice).toBe(dto.totals.positionsWithoutPrice); // conta até as cortadas
  });
});
