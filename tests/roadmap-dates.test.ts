/**
 * Guarda contra a data do /roadmap envelhecer.
 *
 * O rodapé "Last updated" era escrito à mão e mentia calado: ficou em
 * "August 2026" mesmo depois do deploy de 15/09/2026. Agora ele sai da maior
 * data de `SHIPPED`, e estes testes travam essa ligação.
 */

import { describe, expect, it } from "vitest";
import { fmtDate, LAST_UPDATED, SHIPPED } from "../app/roadmap/shipped";

describe("datas do /roadmap", () => {
  it("todas as datas estão em ISO (AAAA-MM-DD) e são datas de verdade", () => {
    for (const [nome, d] of Object.entries(SHIPPED)) {
      for (const iso of [d.since, "updated" in d ? d.updated : undefined]) {
        if (iso === undefined) continue;
        expect(iso, nome).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(iso).toISOString().slice(0, 10), nome).toBe(iso);
      }
    }
  });

  it("nenhum item foi 'melhorado' antes de ir ao ar", () => {
    for (const [nome, d] of Object.entries(SHIPPED)) {
      if ("updated" in d && d.updated) expect(d.updated >= d.since, nome).toBe(true);
    }
  });

  it("o rodapé é a data MAIS RECENTE da página — não dá para ficar para trás", () => {
    const todas = Object.values(SHIPPED).flatMap((d) => ("updated" in d ? [d.since, d.updated] : [d.since]));
    for (const iso of todas) expect(LAST_UPDATED >= (iso as string)).toBe(true);
    expect(todas).toContain(LAST_UPDATED);
  });

  it("nada é datado no futuro (data de deploy, não de promessa)", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(LAST_UPDATED <= hoje).toBe(true);
  });

  it("formata em inglês, sem depender do locale de quem renderiza", () => {
    expect(fmtDate("2026-09-15")).toBe("15 Sep 2026");
    expect(fmtDate("2026-07-10")).toBe("10 Jul 2026");
    expect(fmtDate("2026-08-02")).toBe("2 Aug 2026");
  });
});
