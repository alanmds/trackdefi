/**
 * Guarda dos anúncios (`app/ads.ts` + `app/ui/AdSlot.tsx`).
 *
 * O que se protege aqui é a promessa do site, não o anúncio: nada de script
 * de terceiro na página, nada de anúncio com cara de posição, e um jeito de
 * desligar tudo sem mexer no código.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AD_SANDBOX, AADS_UNIT_ID, adSrc, adsEnabled } from "../app/ads";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("interruptor", () => {
  it("sem id de espaço, nenhum anúncio", () => {
    expect(adsEnabled(null, undefined)).toBe(false);
  });

  it("com id válido, liga", () => {
    expect(adsEnabled("2448856", undefined)).toBe(true);
  });

  it("NEXT_PUBLIC_ADS=off desliga mesmo com id (emergência pelo painel)", () => {
    expect(adsEnabled("2448856", "off")).toBe(false);
    expect(adsEnabled("2448856", " OFF ")).toBe(false);
  });

  it("id que não é só dígitos não liga nada", () => {
    expect(adsEnabled("abc", undefined)).toBe(false);
    expect(adsEnabled("12 34", undefined)).toBe(false);
  });

  it("o id configurado, se houver, é só dígitos", () => {
    if (AADS_UNIT_ID !== null) expect(AADS_UNIT_ID).toMatch(/^\d+$/);
  });
});

describe("iframe da A-ADS", () => {
  it("usa o formato da ajuda oficial (conferido em 14/10/2026)", () => {
    expect(adSrc("2448856")).toBe("https://acceptable.a-ads.com/2448856/?size=Adaptive");
  });

  it("recusa id que poderia montar outra URL", () => {
    expect(() => adSrc("1/../../evil")).toThrow();
  });

  it("o anúncio não pode trocar a nossa página por outra", () => {
    expect(AD_SANDBOX).not.toMatch(/allow-top-navigation/);
    expect(AD_SANDBOX).toMatch(/allow-popups/);
  });

  it("mantém o data-aa (o robô da A-ADS acha o anúncio por ele) e não manda o caminho da URL", () => {
    const slot = read("app/ui/AdSlot.tsx");
    expect(slot).toMatch(/data-aa=\{AADS_UNIT_ID\}/);
    expect(slot).toMatch(/referrerPolicy="strict-origin"/);
    expect(slot).toMatch(/sandbox=\{AD_SANDBOX\}/);
  });

  it("nenhum script de rede de anúncio no código do site", () => {
    for (const f of ["app/ui/AdSlot.tsx", "app/[lang]/layout.tsx", "app/ui/PositionsView.tsx"]) {
      expect(read(f), f).not.toMatch(/<script[^>]*src=|a-ads\.com\/.*\.js|adsbygoogle/);
    }
  });
});

describe("onde o anúncio NÃO entra", () => {
  it("nunca dentro de um card de posição ou de lock", () => {
    for (const f of ["app/ui/PositionCard.tsx", "app/ui/LockCard.tsx"]) {
      expect(read(f), f).not.toMatch(/AdSlot/);
    }
  });

  it("na carteira, nunca na tela de erro e só depois da lista de posições", () => {
    const v = read("app/ui/PositionsView.tsx");
    const erro = v.slice(v.indexOf('state.phase === "error" && ('), v.indexOf("w.tryAgain"));
    expect(erro).not.toMatch(/AdSlot/);
    // o anúncio do fim vem DEPOIS do map das posições, nunca entre totais e lista
    const lista = v.lastIndexOf("state.data.positions.map(");
    const fim = v.lastIndexOf('placement="wallet-end"');
    expect(lista).toBeGreaterThan(0);
    expect(fim).toBeGreaterThan(lista);
  });

  it("o anúncio de página mora no layout, uma vez só, e nenhuma página o repete", () => {
    expect(read("app/[lang]/layout.tsx").match(/<PageAd/g)?.length).toBe(1);
    const paginas = [
      "app/[lang]/page.tsx",
      "app/[lang]/how-it-works/page.tsx",
      "app/[lang]/changelog/page.tsx",
      "app/[lang]/feedback/page.tsx",
      "app/[lang]/glossary/page.tsx",
      "app/[lang]/roadmap/page.tsx",
      "app/[lang]/tools/page.tsx",
      "app/[lang]/tools/apr-simulator/page.tsx",
      "app/[lang]/tools/pairs/page.tsx",
    ];
    for (const f of paginas) expect(read(f), f).not.toMatch(/AdSlot|PageAd/);
  });

  it("a carteira fica fora do anúncio do layout (tem os próprios, que conhecem o erro)", () => {
    const pageAd = read("app/ui/PageAd.tsx");
    expect(pageAd).toContain("^\\/w(");
    expect(pageAd).toMatch(/return null/);
  });
});
