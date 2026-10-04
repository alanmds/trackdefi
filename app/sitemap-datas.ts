/**
 * Datas de edição do TEXTO de cada página, para o `lastmod` do sitemap.
 * Fica fora de `app/sitemap.ts` porque aquele arquivo é especial para o Next
 * (só deve exportar o sitemap), e o teste `tests/sitemap.test.ts` precisa
 * ler estas datas.
 */

/**
 * Última mudança REAL de conteúdo de cada página (AAAA-MM-DD).
 *
 * ⚠️ Atualizar à mão quando o TEXTO da página mudar — não em todo deploy.
 * Desde 02/10/2026 `tests/sitemap.test.ts` guarda uma impressão digital do
 * texto de cada página: se o texto mudar e a data não, o teste quebra. Até
 * 27/09/2026 todas carimbavam a data do build: cada deploy dizia ao Google que
 * tudo tinha mudado, e um `lastmod` que muda sempre ele aprende a ignorar.
 * Não dá para tirar do git: a Vercel constrói sem o histórico completo.
 */
export const EDITADA_EM = {
  home: "2026-10-02",
  howItWorks: "2026-10-02",
  roadmap: "2026-10-04",
  glossary: "2026-10-02",
} as const;
