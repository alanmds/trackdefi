import { describe, expect, it } from "vitest";
import { costLine, COST_TOTALS } from "../app/custos";
import ptBr from "../app/i18n/messages/pt-br/ui";

describe("faixa de custo do topo", () => {
  it("os totais gerados são números plausíveis", () => {
    expect(COST_TOTALS.horas).toBeGreaterThan(0);
    expect(COST_TOTALS.totalUsd).toBeGreaterThan(0);
    expect(COST_TOTALS.atualizadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("a frase arredonda as horas e formata o dólar", () => {
    expect(costLine("en", undefined, { horas: 29.5, totalUsd: 445 })).toBe(
      "So far this site has taken about 30 hours of work and US$ 445 to build and run.",
    );
    expect(costLine("en", undefined, { horas: 1, totalUsd: 1234 })).toContain("1 hour of work and US$ 1,234");
  });
});

describe("faixa de custo em outros idiomas", () => {
  it("português: plural, e o dólar com o separador brasileiro", () => {
    expect(costLine("pt-br", ptBr.costbar.line, { horas: 29.5, totalUsd: 1234 })).toBe(
      "Até agora, este site consumiu cerca de 30 horas de trabalho e US$ 1.234 para ser construído e mantido.",
    );
    expect(costLine("pt-br", ptBr.costbar.line, { horas: 1, totalUsd: 445 })).toContain("cerca de 1 hora de trabalho");
  });
});
