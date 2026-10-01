/**
 * Guarda dos textos que as IAs leem sobre o trackdefi FORA das páginas: o
 * README (o arquivo mais lido sobre o projeto fora do site) e o `/llms.txt`.
 *
 * Por que existe (GEO, 30/09/2026): o site estava blindado pela regra "nome de
 * rede nunca à mão", mas o README não — dizia "ten networks" com 15 no ar, e a
 * tabela da Velodrome tinha 6 das 11 redes. Uma IA (Perplexity) repetiu os
 * "10 networks" ao recomendar o site. Agora rede nova sem atualizar o README
 * quebra o teste, não a reputação.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { llmsTxt } from "../app/llms";
import { COVERAGE, NETWORK_NAMES, NO_TOKEN, PROTOCOL_FAMILIES, SITE_URL } from "../app/site";

const README = readFileSync(join(__dirname, "..", "README.md"), "utf8");

/** linhas da tabela "| Exchange | Networks |" do README → protocolo: redes */
function readmeCoverage(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const secao = README.split(/^## Coverage\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  for (const linha of secao.split("\n")) {
    const m = linha.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (!m || /^-+$/.test(m[1]) || m[1] === "Exchange") continue;
    out.set(m[1], m[2].split(",").map((s) => s.trim()));
  }
  return out;
}

/** "ten networks", "15 networks"… — número de rede escrito à mão */
const CONTAGEM_A_MAO = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+networks?\b/i;

describe("README (o que as IAs leem no GitHub)", () => {
  it("a tabela de cobertura bate com COVERAGE, protocolo por protocolo", () => {
    const tabela = readmeCoverage();
    expect([...tabela.keys()].sort()).toEqual(COVERAGE.map((c) => c.protocol).sort());
    for (const c of COVERAGE) {
      expect([...(tabela.get(c.protocol) ?? [])].sort(), c.protocol).toEqual([...c.networks].sort());
    }
  });

  it("não escreve o número de redes à mão (foi assim que ficou em 'ten')", () => {
    expect(README).not.toMatch(CONTAGEM_A_MAO);
  });

  it("diz que não há token", () => {
    expect(README).toContain(NO_TOKEN);
  });
});

describe("/llms.txt", () => {
  const txt = llmsTxt();

  it("cita todas as redes e todos os protocolos", () => {
    for (const n of NETWORK_NAMES) expect(txt, n).toContain(n);
    for (const p of PROTOCOL_FAMILIES) expect(txt, p).toContain(p);
    for (const c of COVERAGE) expect(txt, c.protocol).toContain(`- ${c.protocol}:`);
  });

  it("aponta para o domínio canônico e diz que não há token", () => {
    expect(txt).toContain(SITE_URL);
    expect(txt).toContain(NO_TOKEN);
  });

  it("diz o que o site NÃO faz (sem isso a IA nos atribui P&L)", () => {
    expect(txt).toMatch(/## What it does not do/);
    expect(txt).toMatch(/No profit and loss/);
  });

  it("começa no formato do llms.txt: título e resumo em citação", () => {
    expect(txt).toMatch(/^# trackdefi\n\n> /);
  });
});
