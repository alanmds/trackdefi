/**
 * Guarda contra texto de interface envelhecido.
 *
 * `app/site.ts` mantém a lista `NETWORKS` à mão (componentes client não podem
 * importar `core/chains.ts` sem arrastar o viem para o bundle). Este arquivo é
 * o que impede a lista de divergir do registro real de redes.
 *
 * Se algo aqui quebrar ao adicionar uma rede: atualize `NETWORKS` em
 * `app/site.ts`. Os textos do site (home, rodapé, /how-it-works, card de
 * compartilhamento) saem dali sozinhos — só o /roadmap e o README continuam
 * escritos à mão, de propósito.
 */

import { describe, expect, it } from "vitest";
import { CHAINS } from "../core/chains";
import {
  COVERAGE,
  humanList,
  NETWORK_COUNT,
  NETWORK_NAMES,
  NETWORKS,
  SITE_DESCRIPTION,
  coverageSentence,
  networksSentence,
} from "../app/site";

describe("rótulos de rede da UI", () => {
  it("NETWORKS cobre exatamente as redes registradas em CHAINS", () => {
    const doRegistro = Object.values(CHAINS).map((c) => c.label).sort();
    const daUi = NETWORKS.map((n) => n.label).sort();
    expect(daUi).toEqual(doRegistro);
  });

  it("NETWORK_COUNT é o número real de redes", () => {
    expect(NETWORK_COUNT).toBe(Object.keys(CHAINS).length);
  });

  it("networksSentence() lista todas as redes em frase legível", () => {
    const frase = networksSentence();
    for (const nome of NETWORK_NAMES) expect(frase).toContain(nome);
    expect(frase).toContain(" and ");
  });

  it("humanList() liga o último item com o conector pedido", () => {
    expect(humanList(["A"])).toBe("A");
    expect(humanList(["A", "B"])).toBe("A and B");
    expect(humanList(["A", "B", "C"], "&")).toBe("A, B & C");
  });
});

describe("frase de cobertura", () => {
  it("cita todos os protocolos e nenhuma rede desconhecida", () => {
    const frase = coverageSentence();
    for (const c of COVERAGE) {
      expect(frase).toContain(c.protocol);
      for (const rede of c.networks) expect(NETWORK_NAMES).toContain(rede);
    }
  });

  it("a união da cobertura alcança todas as redes", () => {
    // rede nova que entre em CHAINS mas não em COVERAGE nenhuma quebra aqui:
    // seria uma rede varrida pelo motor e invisível nos textos do site.
    const cobertas = new Set(COVERAGE.flatMap((c) => [...c.networks]));
    expect([...cobertas].sort()).toEqual([...NETWORK_NAMES].sort());
  });
});

describe("meta description", () => {
  it("cabe no limite do Google (~160 caracteres)", () => {
    // se quebrar: encurtar o texto, não aumentar o limite. Descrição truncada
    // vira "…" no resultado de busca.
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it("não fixa o número de redes à mão", () => {
    expect(SITE_DESCRIPTION).toContain(`${NETWORK_COUNT} networks`);
  });
});
