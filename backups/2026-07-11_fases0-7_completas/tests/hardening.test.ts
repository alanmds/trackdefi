import { describe, expect, it } from "vitest";
import { Semaphore } from "../core/guards";
import { cleanSymbol } from "../core/adapters/aerodrome/index";

describe("Semaphore", () => {
  it("permite até o máximo e nega o excedente; release reabre vaga", () => {
    const s = new Semaphore(2);
    expect(s.tryAcquire()).toBe(true);
    expect(s.tryAcquire()).toBe(true);
    expect(s.tryAcquire()).toBe(false);
    s.release();
    expect(s.tryAcquire()).toBe(true);
  });

  it("release além do necessário não abre vagas extras", () => {
    const s = new Semaphore(1);
    s.release();
    s.release();
    expect(s.tryAcquire()).toBe(true);
    expect(s.tryAcquire()).toBe(false);
  });
});

describe("cleanSymbol (símbolos vindos de contratos de terceiros)", () => {
  // construídos por codepoint para o teste ser inequívoco no código-fonte
  const BELL = String.fromCharCode(0x07); // controle
  const ZWSP = String.fromCharCode(0x200b); // zero-width space
  const RTL = String.fromCharCode(0x202e); // right-to-left override

  it("mantém símbolos normais", () => {
    expect(cleanSymbol("WETH", "x")).toBe("WETH");
    expect(cleanSymbol("cbBTC", "x")).toBe("cbBTC");
  });

  it("remove caracteres de controle e invisíveis", () => {
    expect(cleanSymbol(`WE${BELL}TH`, "x")).toBe("WETH");
    expect(cleanSymbol(`US${ZWSP}DC`, "x")).toBe("USDC");
    expect(cleanSymbol(`${RTL}ABC`, "x")).toBe("ABC");
  });

  it("limita o tamanho e usa fallback quando sobra nada", () => {
    expect(cleanSymbol("A".repeat(100), "x").length).toBe(24);
    expect(cleanSymbol(` ${ZWSP} `, "0x1234")).toBe("0x1234");
  });
});
