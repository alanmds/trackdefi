/**
 * Guarda contra texto de interface envelhecido.
 *
 * `app/site.ts` mantém `NETWORK_LABELS` à mão (componentes client não podem
 * importar `core/chains.ts` sem arrastar o viem para o bundle). Este teste é o
 * que impede a lista de divergir do registro real de redes.
 *
 * Se ele quebrar ao adicionar uma rede: atualize `NETWORK_LABELS` em
 * `app/site.ts` — e confira também os textos de cobertura da home, do rodapé,
 * do /how-it-works, do /roadmap e do README.
 */

import { describe, expect, it } from "vitest";
import { CHAINS } from "../core/chains";
import { NETWORK_LABELS, networksSentence } from "../app/site";

describe("rótulos de rede da UI", () => {
  it("NETWORK_LABELS cobre exatamente as redes registradas em CHAINS", () => {
    const doRegistro = Object.values(CHAINS).map((c) => c.label).sort();
    const daUi = [...NETWORK_LABELS].sort();
    expect(daUi).toEqual(doRegistro);
  });

  it("networksSentence() lista todas as redes em frase legível", () => {
    const frase = networksSentence();
    for (const label of NETWORK_LABELS) expect(frase).toContain(label);
    expect(frase).toContain(" and ");
  });
});
