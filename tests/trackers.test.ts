/**
 * Páginas por corretora (`app/trackers.ts`, 12/11/2026).
 *
 * O que este teste impede de envelhecer calado:
 *  - página citando protocolo que saiu de `COVERAGE` (a tabela de redes da
 *    página quebraria no ar);
 *  - título ou descrição acima do que o Google mostra;
 *  - slug que colide com idioma ou com rota que já existe (o segmento
 *    dinâmico `[tracker]` perderia para a pasta, e a página sumiria).
 */

import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, LOCALE_CODES } from "../app/i18n/config";
import { getMessages } from "../app/i18n/get";
import { DESCRIPTION_MAX, TITLE_MAX } from "../app/i18n/seo";
import { COVERAGE, SITE_NAME } from "../app/site";
import { TRACKER_PAGES, trackerCoverage } from "../app/trackers";

describe("páginas por corretora", () => {
  it("slugs e chaves únicos, em kebab-case", () => {
    const slugs = TRACKER_PAGES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(TRACKER_PAGES.map((t) => t.key)).size).toBe(TRACKER_PAGES.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("nenhum slug colide com idioma nem com rota existente", () => {
    for (const { slug } of TRACKER_PAGES) {
      expect(LOCALE_CODES as readonly string[]).not.toContain(slug);
      expect(existsSync(`app/[lang]/${slug}`), `já existe a pasta app/[lang]/${slug}`).toBe(false);
    }
  });

  it("todo protocolo citado existe em COVERAGE e tem rede", () => {
    const conhecidos = COVERAGE.map((c) => c.protocol as string);
    for (const t of TRACKER_PAGES) {
      for (const p of t.protocols) expect(conhecidos, `${t.key}: ${p}`).toContain(p);
      for (const row of trackerCoverage(t)) expect(row.networks.length, row.protocol).toBeGreaterThan(0);
    }
  });

  it("nenhum protocolo aparece em duas páginas", () => {
    const todos = TRACKER_PAGES.flatMap((t) => t.protocols);
    expect(new Set(todos).size).toBe(todos.length);
  });

  describe.each(LOCALES.map((l) => l.code))("textos em %s", (code) => {
    const paginas = getMessages(code).pages.trackers.pages;

    it.each(TRACKER_PAGES.map((t) => t.key))("%s: título e descrição cabem no Google", (key) => {
      const m = paginas[key];
      expect(`${m.title} — ${SITE_NAME}`.length, m.title).toBeLessThanOrEqual(TITLE_MAX);
      expect(m.description.length, m.description).toBeLessThanOrEqual(DESCRIPTION_MAX);
    });

    it.each(TRACKER_PAGES.map((t) => t.key))("%s: tem o que lê, o que não faz e perguntas", (key) => {
      const m = paginas[key];
      expect(m.reads.length).toBeGreaterThanOrEqual(3);
      expect(m.limits.length).toBeGreaterThanOrEqual(2);
      expect(m.faq.length).toBeGreaterThanOrEqual(2);
    });

    it("nenhuma promessa de retorno (regra editorial do site)", () => {
      const texto = JSON.stringify(paginas);
      expect(texto).not.toMatch(/earn up to|guaranteed|garantid|ganhe até|lucro garantido/i);
    });
  });
});
