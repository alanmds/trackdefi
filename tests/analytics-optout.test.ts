/**
 * Guarda da porta de saída do Analytics (`app/analytics-optout.ts`): o link
 * `?notrack=1` tira o navegador da contagem, `?notrack=0` devolve, e visitante
 * comum continua sendo contado como antes.
 */

import { describe, expect, it } from "vitest";
import { optOutDecision, withoutOptOutParam } from "../app/analytics-optout";

const HOME = "https://trackdefi.app/";

describe("decisão de enviar ou não o evento", () => {
  it("visitante comum (sem marca, sem parâmetro) continua contado", () => {
    expect(optOutDecision(HOME, null)).toEqual({ send: true, store: null });
  });

  it("?notrack=1 grava a marca e já não conta essa própria visita", () => {
    expect(optOutDecision(`${HOME}?notrack=1`, null)).toEqual({ send: false, store: "set" });
  });

  it("com a marca gravada, nenhuma página conta — inclusive as de carteira", () => {
    expect(optOutDecision(HOME, "1").send).toBe(false);
    expect(optOutDecision("https://trackdefi.app/w/0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac", "1").send).toBe(false);
  });

  it("?notrack=0 apaga a marca e volta a contar", () => {
    expect(optOutDecision(`${HOME}?notrack=0`, "1")).toEqual({ send: true, store: "clear" });
  });

  it("valor desconhecido no parâmetro não muda nada", () => {
    expect(optOutDecision(`${HOME}?notrack=sim`, null)).toEqual({ send: true, store: null });
    expect(optOutDecision(`${HOME}?notrack=sim`, "1")).toEqual({ send: false, store: null });
  });

  it("aceita caminho relativo e não quebra com URL estranha", () => {
    expect(optOutDecision("/roadmap?notrack=1", null).send).toBe(false);
    expect(() => optOutDecision("http://[::bad", null)).not.toThrow();
  });
});

describe("limpeza da URL enviada ao painel", () => {
  it("tira só o notrack e preserva o resto", () => {
    expect(withoutOptOutParam(`${HOME}roadmap?a=1&notrack=0`)).toBe(`${HOME}roadmap?a=1`);
    expect(withoutOptOutParam(`${HOME}?notrack=0`)).toBe(HOME);
  });

  it("URL sem o parâmetro passa intacta", () => {
    const u = "https://trackdefi.app/w/0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";
    expect(withoutOptOutParam(u)).toBe(u);
  });
});
