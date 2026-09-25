/**
 * Guarda da linha de doação (`app/donate.ts`).
 *
 * Duas coisas aqui valem dinheiro de outras pessoas: o endereço (trocado em
 * silêncio, desvia as doações) e o tom das frases (pedido de cripto com cara
 * de golpe afasta justamente quem confia no site).
 */

import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { DONATION_ADDRESS, DONATION_PHRASES, nextPhrase, parseBag } from "../app/donate";
import { NETWORKS } from "../app/site";

/** gerador determinístico, para os testes de rotação não piscarem */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("endereço de doação", () => {
  it("é exatamente o confirmado pelo Alan em 25/09/2026", () => {
    // trocar este valor exige trocar app/donate.ts JUNTO — é de propósito
    expect(DONATION_ADDRESS).toBe("0x0a7629b2B98270D824e7aa23e8F5B0BBD88d8228");
  });

  it("tem checksum válido (maiúsculas e minúsculas conferem)", () => {
    expect(getAddress(DONATION_ADDRESS.toLowerCase())).toBe(DONATION_ADDRESS);
  });
});

describe("banco de frases", () => {
  it("tem variedade suficiente para quem volta sempre", () => {
    expect(DONATION_PHRASES.length).toBeGreaterThanOrEqual(20);
  });

  it("não repete frase", () => {
    const norm = DONATION_PHRASES.map((p) => p.toLowerCase().trim());
    expect(new Set(norm).size).toBe(norm.length);
  });

  it("cada frase cabe em duas linhas no celular (até 90 caracteres)", () => {
    for (const p of DONATION_PHRASES) {
      expect(p.length, p).toBeLessThanOrEqual(90);
      expect(p.length, p).toBeGreaterThanOrEqual(20);
      expect(p, p).toBe(p.trim());
    }
  });

  it("nenhuma frase soa como golpe cripto", () => {
    const golpe =
      /\b(airdrop|giveaway|double|guarantee\w*|profit\w*|rewards?|earn\w*|returns?|yield\w*|connect\w*|seed|verify|private key|send|urgent|last chance|now or never)\b/i;
    for (const p of DONATION_PHRASES) expect(p, p).not.toMatch(golpe);
  });

  it("nenhuma frase escreve nome de rede à mão nem conta redes", () => {
    const nomes = new Set<string>(NETWORKS.flatMap((n) => [n.label, n.name]));
    for (const p of DONATION_PHRASES) {
      for (const nome of nomes) expect(p, `"${nome}" em: ${p}`).not.toMatch(new RegExp(`\\b${nome}\\b`));
      expect(p, p).not.toMatch(/\d+\s+(networks|chains|blockchains)/i);
    }
  });
});

describe("rotação das frases (saco embaralhado)", () => {
  const N = DONATION_PHRASES.length;

  it("num ciclo, mostra todas as frases uma vez antes de repetir qualquer uma", () => {
    const rnd = seeded(7);
    let bag: unknown = null;
    const vistas: number[] = [];
    for (let i = 0; i < N; i++) {
      const r = nextPhrase(bag, N, rnd);
      vistas.push(r.index);
      bag = r.bag;
    }
    expect([...vistas].sort((a, b) => a - b)).toEqual(Array.from({ length: N }, (_, i) => i));
  });

  it("nunca mostra a mesma frase duas vezes seguidas, nem na virada de ciclo", () => {
    for (const seed of [1, 2, 3, 42, 1234]) {
      const rnd = seeded(seed);
      let bag: unknown = null;
      let anterior = -1;
      for (let i = 0; i < N * 40; i++) {
        const r = nextPhrase(bag, N, rnd);
        expect(r.index, `seed ${seed}, visita ${i}`).not.toBe(anterior);
        anterior = r.index;
        bag = JSON.parse(JSON.stringify(r.bag)); // o caminho real passa pelo localStorage
      }
    }
  });

  it("sobrevive a dado corrompido ou velho no navegador", () => {
    const lixo: unknown[] = [null, undefined, "x", 42, [], {}, { queue: "abc" }, { queue: [999, -1, 1.5, "2"], last: 9999 }];
    for (const raw of lixo) {
      const r = nextPhrase(raw, N, seeded(3));
      expect(r.index).toBeGreaterThanOrEqual(0);
      expect(r.index).toBeLessThan(N);
    }
  });

  it("descarta índices que não existem mais e duplicados", () => {
    expect(parseBag({ queue: [2, 2, 50, 1], last: 50 }, 5)).toEqual({ queue: [2, 1], last: null });
  });

  it("continua a fila salva em vez de sortear de novo", () => {
    const r = nextPhrase({ queue: [4, 0, 2], last: 1 }, 5, seeded(9));
    expect(r.index).toBe(4);
    expect(r.bag).toEqual({ queue: [0, 2], last: 4 });
  });

  it("funciona com uma frase só e recusa banco vazio", () => {
    expect(nextPhrase({ queue: [], last: 0 }, 1).index).toBe(0);
    expect(() => nextPhrase(null, 0)).toThrow();
  });
});
