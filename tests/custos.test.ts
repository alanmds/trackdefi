import { describe, expect, it } from "vitest";
import { costLine, COST_TOTALS } from "../app/custos";

describe("faixa de custo do topo", () => {
  it("os totais gerados são números plausíveis", () => {
    expect(COST_TOTALS.horas).toBeGreaterThan(0);
    expect(COST_TOTALS.totalUsd).toBeGreaterThan(0);
    expect(COST_TOTALS.atualizadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("a frase arredonda as horas e formata o dólar", () => {
    expect(costLine({ horas: 29.5, totalUsd: 445 })).toBe(
      "So far this site has taken about 30 hours of work and US$ 445 to build and run.",
    );
    expect(costLine({ horas: 1, totalUsd: 1234 })).toContain("1 hour of work and US$ 1,234");
  });
});
