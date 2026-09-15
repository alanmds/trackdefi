/**
 * Guarda do log de atualizações (`app/changelog.ts`).
 *
 * Por que isto existe: o rodapé "Last updated" do /roadmap era escrito à mão e
 * mentia calado — ficou em "August 2026" mesmo depois do deploy de 15/09/2026.
 * Agora a home, o /changelog e aquele rodapé saem todos da MESMA lista, e o
 * que este arquivo trava é a lista continuar confiável.
 */

import { describe, expect, it } from "vitest";
import { CHANGELOG, fmtDate, KIND_LABEL, LATEST } from "../app/changelog";

describe("log de atualizações", () => {
  it("tem entrada desde o lançamento (10/07/2026)", () => {
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(10);
    expect(CHANGELOG[CHANGELOG.length - 1].date).toBe("2026-07-10");
  });

  it("todas as datas são ISO (AAAA-MM-DD) e existem no calendário", () => {
    for (const e of CHANGELOG) {
      expect(e.date, e.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(e.date).toISOString().slice(0, 10), e.title).toBe(e.date);
    }
  });

  it("está em ordem: mais recente primeiro", () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(CHANGELOG[i - 1].date >= CHANGELOG[i].date, `${CHANGELOG[i].title} fora de ordem`).toBe(true);
    }
  });

  it("nada é datado no futuro — é log do que foi AO AR, não promessa", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    for (const e of CHANGELOG) expect(e.date <= hoje, e.title).toBe(true);
  });

  it("a entrada da home é a mais recente da lista", () => {
    expect(LATEST).toBe(CHANGELOG[0]);
    for (const e of CHANGELOG) expect(LATEST.date >= e.date).toBe(true);
  });

  it("toda entrada tem título curto e corpo de verdade (a home mostra o título)", () => {
    for (const e of CHANGELOG) {
      expect(e.title.length, e.title).toBeLessThanOrEqual(70);
      expect(e.title.trim().length).toBeGreaterThan(0);
      expect(e.body.length, e.title).toBeGreaterThan(40);
    }
  });

  it("todo tipo usado tem rótulo para o selo", () => {
    for (const e of CHANGELOG) expect(KIND_LABEL[e.kind], e.title).toBeTruthy();
  });

  it("nenhuma entrada fala como commit (nome de arquivo, função ou hash)", () => {
    for (const e of CHANGELOG) {
      const texto = `${e.title} ${e.body}`;
      expect(texto, e.title).not.toMatch(/\.tsx?\b|\bcore\/|\bapp\/|\bcommit\b/i);
    }
  });

  it("formata a data em inglês, sem depender do locale de quem renderiza", () => {
    expect(fmtDate("2026-09-15")).toBe("15 Sep 2026");
    expect(fmtDate("2026-07-10")).toBe("10 Jul 2026");
    expect(fmtDate("2026-08-02")).toBe("2 Aug 2026");
  });
});
