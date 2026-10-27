/**
 * O globals.css é um arquivo só: uma chave sem fechar engole TUDO que vem
 * depois. Visto em 26/10/2026 — o commit dos anúncios cortou o bloco
 * `prefers-reduced-motion` no meio, e os estilos do espaço de anúncio (e o
 * que viesse depois) passaram a valer só para quem pede menos animação.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("globals.css", () => {
  it("toda chave aberta é fechada, e nenhuma fecha antes de abrir", () => {
    const css = readFileSync("app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    let depth = 0;
    for (const ch of css) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});
