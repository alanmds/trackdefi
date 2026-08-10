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
import { AERODROME_BASE, VELODROME_LEAF_CHAINS, VELODROME_OPTIMISM } from "../core/adapters/aerodrome/config";
import { UNISWAP_V3_CHAINS } from "../core/adapters/uniswap-v3/config";
import { UNISWAP_V4_CHAINS } from "../core/adapters/uniswap-v4/config";
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

  /**
   * O teste acima só garante que a UNIÃO fecha — ele passaria com os
   * protocolos trocados entre si. Estes comparam protocolo a protocolo com o
   * registry de verdade, que é o que o motor realmente varre.
   *
   * Até 10/08/2026 não fazia falta: o Uniswap v3 rodava em todas as redes e a
   * tabela dizia `NETWORK_NAMES`. Com as leaf chains da Superchain isso
   * quebrou (a Velodrome roda nelas, o Uniswap não) e a tabela virou lista à
   * mão — que é exatamente o tipo de coisa que envelhece calada.
   */
  const nomeDaRede = (chainId: number): string => {
    const label = CHAINS[chainId].label;
    const rede = NETWORKS.find((n) => n.label === label);
    if (!rede) throw new Error(`rede ${chainId} (${label}) não está em NETWORKS`);
    return rede.name;
  };
  const redesDe = (protocolo: string) => {
    const c = COVERAGE.find((c) => c.protocol === protocolo);
    if (!c) throw new Error(`protocolo ${protocolo} sumiu de COVERAGE`);
    return [...c.networks].sort();
  };

  it("Aerodrome cobre exatamente as redes do seu config", () => {
    expect(redesDe("Aerodrome")).toEqual([nomeDaRede(AERODROME_BASE.chainId)].sort());
  });

  it("Velodrome cobre a Optimism mais todas as leaf chains da Superchain", () => {
    const doRegistro = [VELODROME_OPTIMISM, ...VELODROME_LEAF_CHAINS].map((c) => nomeDaRede(c.chainId)).sort();
    expect(redesDe("Velodrome")).toEqual(doRegistro);
  });

  it("Uniswap v3 cobre exatamente as redes do seu config", () => {
    expect(redesDe("Uniswap v3")).toEqual(UNISWAP_V3_CHAINS.map((c) => nomeDaRede(c.chainId)).sort());
  });

  it("Uniswap v4 cobre exatamente as redes do seu config", () => {
    // hoje só a Robinhood Chain: o v4 depende de RPC que aceite varredura de
    // histórico, e o público da Base não aceita. Rede nova entra na config e
    // ESTE teste cobra o texto do site.
    expect(redesDe("Uniswap v4")).toEqual(UNISWAP_V4_CHAINS.map((c) => nomeDaRede(c.chainId)).sort());
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
