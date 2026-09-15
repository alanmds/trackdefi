/**
 * Formatação da tela — os casos de borda que já causaram cara de defeito.
 *
 * `fmtUsdFine` e `fmtWindow` nasceram em 15/09/2026 com as duas janelas de
 * medição: numa janela de 15 min a taxa ganha é fração de centavo, e as duas
 * saídas ingênuas são ruins — "$0.00" parece bug e "$0.0000000006" é ruído.
 */

import { describe, expect, it } from "vitest";
import { fmtUsdFine, fmtWindow } from "../app/ui/format";

describe("fmtUsdFine (taxa ganha na janela)", () => {
  it("valor normal sai como dólar normal", () => {
    expect(fmtUsdFine(1.31)).toBe("$1.31");
    expect(fmtUsdFine(0.21)).toBe("$0.21");
    expect(fmtUsdFine(47.5)).toBe("$47.50");
  });

  it("no centavo exato ainda é dólar normal", () => {
    expect(fmtUsdFine(0.01)).toBe("$0.01");
  });

  it("abaixo de um centavo NÃO vira $0.00 nem dízima — vira '< $0.01'", () => {
    expect(fmtUsdFine(0.0039)).toBe("< $0.01");
    expect(fmtUsdFine(0.0000000006)).toBe("< $0.01");
  });

  it("zero de verdade é $0.00 — a posição não ganhou nada na janela", () => {
    expect(fmtUsdFine(0)).toBe("$0.00");
  });

  it("sem dado é travessão, nunca zero", () => {
    expect(fmtUsdFine(null)).toBe("—");
    expect(fmtUsdFine(undefined)).toBe("—");
    expect(fmtUsdFine(Number.NaN)).toBe("—");
  });
});

describe("fmtWindow (duração da janela)", () => {
  it("as duas janelas que a tela mostra", () => {
    expect(fmtWindow(900)).toBe("15 min");
    expect(fmtWindow(86_400)).toBe("24 h");
  });

  it("arredonda para minuto abaixo de uma hora e para hora acima", () => {
    expect(fmtWindow(3_600)).toBe("1 h");
    expect(fmtWindow(21_600)).toBe("6 h");
    expect(fmtWindow(1_800)).toBe("30 min");
  });

  it("janela inválida não inventa número", () => {
    expect(fmtWindow(0)).toBe("—");
    expect(fmtWindow(-5)).toBe("—");
  });
});
